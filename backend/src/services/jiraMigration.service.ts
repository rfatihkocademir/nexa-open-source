import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import axios from 'axios';
import dns from 'node:dns/promises';
import net from 'node:net';

export interface JiraIssuePayload {
    key: string;
    fields: {
        summary: string;
        description?: any;
        issuetype?: { name: string };
        status?: { name: string };
        priority?: { name: string };
        assignee?: { emailAddress?: string; displayName?: string } | null;
        reporter?: { emailAddress?: string; displayName?: string } | null;
        created?: string;
        updated?: string;
        storyPoints?: number;
        customfield_10016?: number; // Jira Story points custom field
    };
}

export interface JiraExportPayload {
    issues: JiraIssuePayload[];
}

export interface MigrationSummary {
    totalParsed: number;
    epicsImported: number;
    storiesImported: number;
    bugsImported: number;
    tasksImported: number;
    skippedCount: number;
    importedKeys: string[];
}

export class JiraMigrationService {
    private async validateHostUrl(rawUrl: string): Promise<string> {
        let url: URL;
        try { url = new URL(rawUrl); } catch { throw new AppError('Geçerli bir Jira URL adresi girilmelidir.', 400); }
        if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
            throw new AppError('Jira URL yalnızca HTTPS kullanan site kök adresi olmalıdır.', 400);
        }

        const allowed = (process.env.JIRA_ALLOWED_DOMAINS || 'atlassian.net')
            .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
        const hostname = url.hostname.toLowerCase();
        if (!allowed.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
            throw new AppError('Jira alan adı izin verilen alan adları arasında değil.', 400);
        }

        const addresses = net.isIP(hostname)
            ? [{ address: hostname }]
            : await dns.lookup(hostname, { all: true });
        const isPrivateAddress = (rawAddress: string) => {
            const address = rawAddress.toLowerCase().replace(/^\[|\]$/g, '');
            const mappedIpv4 = address.startsWith('::ffff:') ? address.slice(7) : address;
            if (net.isIP(mappedIpv4) === 4) {
                const octets = mappedIpv4.split('.').map(Number);
                return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || octets[0] === 169 && octets[1] === 254 ||
                    octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 || octets[0] === 192 && octets[1] === 168;
            }
            return address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:');
        };
        if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
            throw new AppError('Özel ağ adreslerine Jira bağlantısı kurulamaz.', 400);
        }
        return url.origin;
    }

    private mapIssueType(jiraType?: string): 'EPIC' | 'STORY' | 'BUG' | 'TASK' {
        if (!jiraType) return 'STORY';
        const normalized = jiraType.toUpperCase();
        if (normalized.includes('EPIC')) return 'EPIC';
        if (normalized.includes('BUG')) return 'BUG';
        if (normalized.includes('TASK')) return 'TASK';
        return 'STORY';
    }

    private mapStatus(jiraStatus?: string): 'TODO' | 'IN_PROGRESS' | 'QA' | 'DONE' | 'CLOSED' {
        if (!jiraStatus) return 'TODO';
        const normalized = jiraStatus.toUpperCase();
        if (normalized.includes('DONE') || normalized.includes('RESOLVED') || normalized.includes('COMPLETE')) return 'DONE';
        if (normalized.includes('CLOSED')) return 'CLOSED';
        if (normalized.includes('REVIEW') || normalized.includes('QA') || normalized.includes('TESTING')) return 'QA';
        if (normalized.includes('PROGRESS') || normalized.includes('DOING') || normalized.includes('DEV')) return 'IN_PROGRESS';
        return 'TODO';
    }

    private mapPriority(jiraPriority?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
        if (!jiraPriority) return 'MEDIUM';
        const normalized = jiraPriority.toUpperCase();
        if (normalized.includes('HIGHEST') || normalized.includes('BLOCKER') || normalized.includes('CRITICAL')) return 'CRITICAL';
        if (normalized.includes('HIGH')) return 'HIGH';
        if (normalized.includes('LOW')) return 'LOW';
        return 'MEDIUM';
    }

    private parseDescription(desc: any): string {
        if (!desc) return '';
        if (typeof desc === 'string') return desc;
        // If Jira ADF (Atlassian Document Format) JSON
        if (typeof desc === 'object' && Array.isArray(desc.content)) {
            try {
                return desc.content
                    .map((block: any) => (block.content || []).map((c: any) => c.text || '').join(''))
                    .filter(Boolean)
                    .join('\n');
            } catch {
                return JSON.stringify(desc);
            }
        }
        return String(desc);
    }

    async parseAndImportIssues(
        projectId: string,
        userId: string,
        issues: JiraIssuePayload[]
    ): Promise<MigrationSummary> {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            throw new AppError('Target project not found', 404);
        }
        if (!Array.isArray(issues) || issues.length === 0 || issues.length > 5000) {
            throw new AppError('issues 1-5000 kayıt arasında olmalıdır', 400);
        }

        const summary: MigrationSummary = {
            totalParsed: issues.length,
            epicsImported: 0,
            storiesImported: 0,
            bugsImported: 0,
            tasksImported: 0,
            skippedCount: 0,
            importedKeys: [],
        };

        const validIssueCount = issues.filter((issue) => typeof issue?.fields?.summary === 'string' && issue.fields.summary.trim().length > 0).length;
        await prisma.$transaction(async (tx) => {
            const counter = await tx.project.update({
                where: { id: projectId },
                data: { nextWorkItemNumber: { increment: validIssueCount } },
                select: { key: true, nextWorkItemNumber: true },
            });
            const maximum = await tx.workItem.aggregate({ where: { projectId }, _max: { sequenceNumber: true } });
            let nextNum = Math.max(counter.nextWorkItemNumber - validIssueCount, (maximum._max.sequenceNumber || 0) + 1);

            for (const issue of issues) {
                if (typeof issue?.fields?.summary !== 'string' || issue.fields.summary.trim().length === 0) {
                    summary.skippedCount++;
                    continue;
                }

                const itemType = this.mapIssueType(issue.fields.issuetype?.name);
                const status = this.mapStatus(issue.fields.status?.name);
                const priority = this.mapPriority(issue.fields.priority?.name);
                const title = issue.fields.summary.trim();
                const description = this.parseDescription(issue.fields.description);
                const storyPoints = issue.fields.storyPoints || issue.fields.customfield_10016 || undefined;
                const key = `${counter.key}-${nextNum}`;
                const createdItem = await tx.workItem.create({
                    data: {
                        key,
                        sequenceNumber: nextNum,
                        title,
                        description,
                        itemType,
                        status,
                        priority,
                        storyPoints,
                        projectId,
                        reporterId: userId,
                        assigneeId: userId,
                    },
                });
                summary.importedKeys.push(createdItem.key);
                nextNum++;

                if (itemType === 'EPIC') summary.epicsImported++;
                else if (itemType === 'STORY') summary.storiesImported++;
                else if (itemType === 'BUG') summary.bugsImported++;
                else summary.tasksImported++;
            }

            if (nextNum > counter.nextWorkItemNumber) {
                await tx.project.update({ where: { id: projectId }, data: { nextWorkItemNumber: nextNum } });
            }
        });

        return summary;
    }

    async fetchAndImportFromJiraApi(
        projectId: string,
        userId: string,
        credentials: { hostUrl: string; email: string; apiToken: string; jiraProjectKey: string }
    ): Promise<MigrationSummary> {
        const { hostUrl, email, apiToken, jiraProjectKey } = credentials;
        const normalizedHost = await this.validateHostUrl(hostUrl);
        const authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;

        try {
            const searchUrl = `${normalizedHost}/rest/api/3/search`;
            const response = await axios.get(searchUrl, {
                headers: {
                    Authorization: authHeader,
                    Accept: 'application/json',
                },
                params: {
                    jql: `project = "${jiraProjectKey}"`,
                    maxResults: 200,
                },
                timeout: 15_000,
                maxRedirects: 0,
            });

            const issues: JiraIssuePayload[] = response.data?.issues || [];
            return this.parseAndImportIssues(projectId, userId, issues);
        } catch (error: any) {
            const msg = error.response?.data?.errorMessages?.join(', ') || error.message;
            throw new AppError(`Failed to fetch from Jira API: ${msg}`, 400);
        }
    }
}

export const jiraMigrationService = new JiraMigrationService();
