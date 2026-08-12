import { AppError } from '../utils/AppError';

export type XrayConnectionConfig = {
    xrayClientId: string;
    xrayClientSecret: string;
};

type GraphqlResponse<T> = { data?: T; errors?: Array<{ message?: string }> };
type Page<T> = { total?: number; start?: number; limit?: number; results?: T[] };
type Execution = { issueId?: string };
type TestRun = {
    id?: string;
    status?: { name?: string };
    test?: { issueId?: string };
    testExecution?: { issueId?: string };
    steps?: Array<{ action?: string; data?: string; result?: string; status?: { name?: string } }>;
};

const AUTH_URL = 'https://xray.cloud.getxray.app/api/v2/authenticate';
const GRAPHQL_URL = 'https://xray.cloud.getxray.app/api/v2/graphql';

export class XrayClientService {
    constructor(private readonly fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch) {}

    validateConfig(config: Partial<XrayConnectionConfig>) {
        if (!config.xrayClientId?.trim() || !config.xrayClientSecret?.trim()) {
            throw new AppError('Xray Client ID ve Client Secret bilgileri zorunludur.', 400);
        }
    }

    private async request(url: string, init: RequestInit) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
            return await this.fetcher(url, { ...init, redirect: 'error', signal: controller.signal });
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') throw new AppError('Xray bağlantısı zaman aşımına uğradı.', 504);
            throw new AppError('Xray Cloud bağlantısı kurulamadı.', 502);
        } finally {
            clearTimeout(timeout);
        }
    }

    private async authenticate(config: XrayConnectionConfig) {
        this.validateConfig(config);
        const response = await this.request(AUTH_URL, {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: config.xrayClientId, client_secret: config.xrayClientSecret }),
        });
        if (response.status === 401 || response.status === 403) throw new AppError('Xray kimlik bilgileri reddedildi.', 401);
        if (!response.ok) throw new AppError(`Xray kimlik doğrulaması başarısız oldu (${response.status}).`, 502);
        const raw = (await response.text()).trim();
        let token = raw;
        try { token = JSON.parse(raw) as string; } catch { /* API bazı sürümlerde düz token döndürebilir. */ }
        if (!token || typeof token !== 'string' || token.length < 20) throw new AppError('Xray geçerli bir erişim tokenı döndürmedi.', 502);
        return token;
    }

    private async graphql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
        const response = await this.request(GRAPHQL_URL, {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ query, variables }),
        });
        if (response.status === 401 || response.status === 403) throw new AppError('Xray erişim tokenı reddedildi.', 401);
        if (!response.ok) throw new AppError(`Xray GraphQL isteği başarısız oldu (${response.status}).`, 502);
        const body = await response.json() as GraphqlResponse<T>;
        if (body.errors?.length) throw new AppError(`Xray sorgusu başarısız: ${body.errors[0]?.message || 'Bilinmeyen GraphQL hatası'}`, 502);
        if (!body.data) throw new AppError('Xray sorgusu veri döndürmedi.', 502);
        return body.data;
    }

    async test(config: XrayConnectionConfig) {
        const token = await this.authenticate(config);
        await this.graphql<{ getTestExecutions: Page<Execution> }>(
            token,
            'query TestConnection { getTestExecutions(limit: 1, start: 0) { total } }',
            {},
        );
        return { connected: true };
    }

    async fetchExecutions(config: XrayConnectionConfig, options: { jql?: string; maxExecutions?: number } = {}) {
        const token = await this.authenticate(config);
        const maxExecutions = Math.min(1000, Math.max(1, options.maxExecutions || 500));
        const executions: Execution[] = [];
        for (let start = 0; start < maxExecutions;) {
            const limit = Math.min(100, maxExecutions - start);
            const data = await this.graphql<{ getTestExecutions: Page<Execution> }>(
                token,
                `query Executions($jql: String, $limit: Int!, $start: Int!) {
                    getTestExecutions(jql: $jql, limit: $limit, start: $start) {
                        total start limit results { issueId }
                    }
                }`,
                { jql: options.jql?.trim() || undefined, limit, start },
            );
            const page = data.getTestExecutions;
            executions.push(...(page.results || []));
            start += page.results?.length || 0;
            if (!page.results?.length || start >= (page.total || 0)) break;
        }

        const executionIds = executions.map((entry) => entry.issueId).filter((id): id is string => Boolean(id));
        const runs: TestRun[] = [];
        for (const executionId of executionIds) {
            for (let start = 0; start < 5000;) {
                const data = await this.graphql<{ getTestRuns: Page<TestRun> }>(
                    token,
                    `query Runs($executionIds: [String], $start: Int!) {
                        getTestRuns(testExecIssueIds: $executionIds, limit: 100, start: $start) {
                            total start limit
                            results {
                                id status { name }
                                test { issueId }
                                testExecution { issueId }
                                steps { action data result status { name } }
                            }
                        }
                    }`,
                    { executionIds: [executionId], start },
                );
                const page = data.getTestRuns;
                runs.push(...(page.results || []));
                start += page.results?.length || 0;
                if (!page.results?.length || start >= (page.total || 0)) break;
            }
        }
        return { executions, runs, truncated: executions.length >= maxExecutions, fetchedAt: new Date().toISOString() };
    }
}

export const xrayClientService = new XrayClientService();
