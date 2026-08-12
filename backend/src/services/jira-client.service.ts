import dns from 'node:dns/promises';
import net from 'node:net';
import { AppError } from '../utils/AppError';

export type JiraConnectionConfig = {
    url: string;
    email: string;
    apiToken: string;
    projectKey?: string;
    xrayClientId?: string;
    xrayClientSecret?: string;
};

type JiraSearchResponse = {
    issues?: Array<Record<string, unknown>>;
    nextPageToken?: string;
    isLast?: boolean;
};

export class JiraClientService {
    constructor(
        private readonly fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch,
        private readonly resolver: (hostname: string) => Promise<Array<{ address: string }>> = (hostname) => dns.lookup(hostname, { all: true }),
    ) {}

    async validateConfig(config: JiraConnectionConfig) {
        if (!config.email?.trim() || !config.apiToken?.trim()) throw new AppError('Jira e-posta ve API token bilgileri zorunludur.', 400);
        await this.baseUrl(config.url);
    }

    private async baseUrl(rawUrl: string) {
        let url: URL;
        try { url = new URL(rawUrl); } catch { throw new AppError('Geçerli bir Jira URL adresi girilmelidir.', 400); }
        if (url.protocol !== 'https:') throw new AppError('Jira Cloud bağlantısı HTTPS kullanmalıdır.', 400);
        if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new AppError('Jira URL yalnızca site kök adresini içermelidir.', 400);
        const allowed = (process.env.JIRA_ALLOWED_DOMAINS || 'atlassian.net').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
        if (!allowed.some((domain) => url.hostname.toLowerCase() === domain || url.hostname.toLowerCase().endsWith(`.${domain}`))) {
            throw new AppError('Jira alan adı izin verilen alan adları arasında değil.', 400);
        }
        const addresses = net.isIP(url.hostname) ? [{ address: url.hostname }] : await this.resolver(url.hostname);
        const forbidden = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i;
        if (addresses.length === 0 || addresses.some(({ address }) => forbidden.test(address))) throw new AppError('Özel ağ adreslerine Jira bağlantısı kurulamaz.', 400);
        return url.origin;
    }

    private async request<T>(config: JiraConnectionConfig, path: string, init?: RequestInit): Promise<T> {
        const baseUrl = await this.baseUrl(config.url);
        if (!config.email?.trim() || !config.apiToken?.trim()) throw new AppError('Jira e-posta ve API token bilgileri zorunludur.', 400);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
            const response = await this.fetcher(`${baseUrl}${path}`, {
                ...init,
                redirect: 'error',
                signal: controller.signal,
                headers: {
                    Accept: 'application/json',
                    Authorization: `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`,
                    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
                    ...init?.headers,
                },
            });
            if (!response.ok) {
                if (response.status === 401) throw new AppError('Jira kimlik bilgileri reddedildi.', 401);
                if (response.status === 403) throw new AppError('Jira hesabının bu işlem için yetkisi yok.', 403);
                throw new AppError(`Jira API isteği başarısız oldu (${response.status}).`, 502);
            }
            return await response.json() as T;
        } catch (error) {
            if (error instanceof AppError) throw error;
            if (error instanceof Error && error.name === 'AbortError') throw new AppError('Jira bağlantısı zaman aşımına uğradı.', 504);
            throw new AppError('Jira bağlantısı kurulamadı.', 502);
        } finally { clearTimeout(timeout); }
    }

    async test(config: JiraConnectionConfig) {
        const user = await this.request<{ accountId: string; displayName: string; emailAddress?: string }>(config, '/rest/api/3/myself');
        return { connected: true, accountId: user.accountId, displayName: user.displayName, emailAddress: user.emailAddress };
    }

    async fetchIssues(config: JiraConnectionConfig, options: { jql?: string; maxIssues?: number } = {}) {
        const limit = Math.min(5000, Math.max(1, options.maxIssues || 1000));
        const projectKey = config.projectKey?.trim();
        const jql = options.jql?.trim() || (projectKey ? `project = "${projectKey.replace(/"/g, '\\"')}" ORDER BY key ASC` : '');
        if (!jql) throw new AppError('Jira projectKey veya JQL sorgusu zorunludur.', 400);
        const issues: Array<Record<string, unknown>> = [];
        let nextPageToken: string | undefined;
        do {
            const remaining = limit - issues.length;
            const page = await this.request<JiraSearchResponse>(config, '/rest/api/3/search/jql', {
                method: 'POST',
                body: JSON.stringify({
                    jql,
                    maxResults: Math.min(100, remaining),
                    nextPageToken,
                    fields: [
                        'summary', 'description', 'issuetype', 'status', 'priority', 'assignee', 'reporter',
                        'comment', 'attachment', 'issuelinks', 'parent', 'subtasks', 'sprint', 'labels',
                        'created', 'updated', 'resolutiondate', 'environment',
                    ],
                }),
            });
            issues.push(...(page.issues || []));
            nextPageToken = page.isLast || !page.nextPageToken || issues.length >= limit ? undefined : page.nextPageToken;
        } while (nextPageToken);
        return { issues, jql, truncated: issues.length >= limit, fetchedAt: new Date().toISOString() };
    }

    async downloadAttachment(config: JiraConnectionConfig, attachment: { id: string; filename: string; size?: number; mimeType?: string }) {
        const declaredSize = Number(attachment.size || 0);
        const maxSize = 25 * 1024 * 1024;
        if (declaredSize > maxSize) throw new AppError(`Jira eki 25 MB sınırını aşıyor: ${attachment.filename}`, 413);
        const baseUrl = await this.baseUrl(config.url);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);
        try {
            const response = await this.fetcher(`${baseUrl}/rest/api/3/attachment/content/${encodeURIComponent(attachment.id)}?redirect=false`, {
                redirect: 'error',
                signal: controller.signal,
                headers: {
                    Accept: 'application/octet-stream',
                    Authorization: `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`,
                },
            });
            if (!response.ok) throw new AppError(`Jira eki indirilemedi (${response.status}): ${attachment.filename}`, 502);
            const contentLength = Number(response.headers.get('content-length') || 0);
            if (contentLength > maxSize) throw new AppError(`Jira eki 25 MB sınırını aşıyor: ${attachment.filename}`, 413);
            const buffer = Buffer.from(await response.arrayBuffer());
            if (buffer.length > maxSize) throw new AppError(`Jira eki 25 MB sınırını aşıyor: ${attachment.filename}`, 413);
            return {
                buffer,
                filename: attachment.filename,
                mimetype: response.headers.get('content-type') || attachment.mimeType || 'application/octet-stream',
                size: buffer.length,
            };
        } catch (error) {
            if (error instanceof AppError) throw error;
            if (error instanceof Error && error.name === 'AbortError') throw new AppError(`Jira eki indirilirken zaman aşımı: ${attachment.filename}`, 504);
            throw new AppError(`Jira eki indirilemedi: ${attachment.filename}`, 502);
        } finally {
            clearTimeout(timeout);
        }
    }
}

export const jiraClientService = new JiraClientService();
