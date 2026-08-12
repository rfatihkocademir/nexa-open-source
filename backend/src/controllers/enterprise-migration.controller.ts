import { Request, Response } from 'express';
import { enterpriseMigrationService } from '../services/enterprise-migration.service';
import { getAuditContext, getAuthorizedProjectActor, getAuthorizedProjectId } from '../utils/requestContext';
import { respondWithControllerError } from '../utils/controllerError';
import { sendResponse } from '../utils/apiResponse';
import { auditService } from '../services/audit.service';
import { integrationService } from '../services/integration.service';
import { jiraClientService } from '../services/jira-client.service';
import { xrayClientService } from '../services/xray-client.service';

export class EnterpriseMigrationController {
    static async testJira(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            const config = await integrationService.getJiraConfig(req.body.integrationId, actor.projectId);
            const result = await jiraClientService.test(config);
            await auditService.log({ context: getAuditContext(req, actor.projectId), entityType: 'Integration', entityId: req.body.integrationId, action: 'JIRA_CONNECTION_TESTED', after: { connected: true, accountId: result.accountId } }, true);
            sendResponse(res, 200, result, 'Jira bağlantısı başarılı.');
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async analyzeJira(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            const config = await integrationService.getJiraConfig(req.body.integrationId, actor.projectId);
            const payload = await jiraClientService.fetchIssues(config, { jql: req.body.jql, maxIssues: req.body.maxIssues });
            const result = await enterpriseMigrationService.analyze(actor.projectId, actor.userId, payload, req.body.mapping, `JIRA:${req.body.integrationId}`);
            await auditService.log({ context: getAuditContext(req, actor.projectId), entityType: 'MigrationJob', entityId: result.id, action: 'JIRA_LIVE_MIGRATION_ANALYZED', after: { integrationId: req.body.integrationId, jql: payload.jql, issueCount: payload.issues.length, truncated: payload.truncated, summary: result.summary } }, true);
            sendResponse(res, 201, result, 'Canlı Jira migration analizi oluşturuldu.');
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async testXray(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            const config = await integrationService.getXrayConfig(req.body.integrationId, actor.projectId);
            const result = await xrayClientService.test(config);
            await auditService.log({ context: getAuditContext(req, actor.projectId), entityType: 'Integration', entityId: req.body.integrationId, action: 'XRAY_CONNECTION_TESTED', after: { connected: true } }, true);
            sendResponse(res, 200, result, 'Xray Cloud bağlantısı başarılı.');
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async analyzeJiraXray(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            const jiraConfig = await integrationService.getJiraConfig(req.body.integrationId, actor.projectId);
            const xrayConfig = await integrationService.getXrayConfig(req.body.integrationId, actor.projectId);
            const [jiraPayload, xrayPayload] = await Promise.all([
                jiraClientService.fetchIssues(jiraConfig, { jql: req.body.jql, maxIssues: req.body.maxIssues }),
                xrayClientService.fetchExecutions(xrayConfig, { jql: req.body.xrayJql || req.body.jql, maxExecutions: req.body.maxExecutions }),
            ]);
            const issueById = new Map(jiraPayload.issues.map((issue) => [String(issue.id || ''), issue]));
            const runsByExecution = new Map<string, typeof xrayPayload.runs>();
            for (const run of xrayPayload.runs) {
                const executionId = String(run.testExecution?.issueId || '');
                if (!executionId) continue;
                runsByExecution.set(executionId, [...(runsByExecution.get(executionId) || []), run]);
            }
            const xrayExecutions = xrayPayload.executions.map((execution) => {
                const executionId = String(execution.issueId || '');
                const jiraIssue = issueById.get(executionId) as { key?: unknown; fields?: Record<string, any> } | undefined;
                return {
                    id: executionId,
                    key: String(jiraIssue?.key || executionId),
                    summary: String(jiraIssue?.fields?.summary || jiraIssue?.key || `Xray Execution ${executionId}`),
                    status: String(jiraIssue?.fields?.status?.name || ''),
                    startedAt: jiraIssue?.fields?.created,
                    completedAt: jiraIssue?.fields?.resolutiondate,
                    tests: (runsByExecution.get(executionId) || []).map((run) => {
                        const testId = String(run.test?.issueId || '');
                        return {
                            id: run.id,
                            testIssueKey: String((issueById.get(testId) as { key?: unknown } | undefined)?.key || testId),
                            status: run.status?.name,
                            stepResults: run.steps,
                        };
                    }),
                };
            });
            const payload = { ...jiraPayload, xrayExecutions };
            const result = await enterpriseMigrationService.analyze(actor.projectId, actor.userId, payload, req.body.mapping, `JIRA_XRAY:${req.body.integrationId}`);
            await auditService.log({
                context: getAuditContext(req, actor.projectId), entityType: 'MigrationJob', entityId: result.id, action: 'JIRA_XRAY_LIVE_MIGRATION_ANALYZED',
                after: { integrationId: req.body.integrationId, issueCount: jiraPayload.issues.length, executionCount: xrayExecutions.length, truncated: jiraPayload.truncated || xrayPayload.truncated, summary: result.summary },
            }, true);
            sendResponse(res, 201, result, 'Canlı Jira ve Xray migration analizi oluşturuldu.');
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async analyze(req: Request, res: Response) {
        try {
            const actor = getAuthorizedProjectActor(req, req.body.projectId);
            const result = await enterpriseMigrationService.analyze(actor.projectId, actor.userId, req.body.payload, req.body.mapping);
            await auditService.log({ context: getAuditContext(req, actor.projectId), entityType: 'MigrationJob', entityId: result.id, action: 'MIGRATION_ANALYZED', after: { source: result.source, summary: result.summary } }, true);
            sendResponse(res, 201, result, 'Migration analizi oluşturuldu.');
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async dryRun(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req, req.body.projectId);
            sendResponse(res, 200, await enterpriseMigrationService.dryRun(projectId, req.params.jobId), 'Dry-run tamamlandı.');
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async execute(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req, req.body.projectId);
            const result = await enterpriseMigrationService.execute(projectId, req.params.jobId);
            await auditService.log({ context: getAuditContext(req, projectId), entityType: 'MigrationJob', entityId: result.id, action: 'MIGRATION_EXECUTED', after: { source: result.source, status: result.status, summary: result.summary } }, true);
            sendResponse(res, 200, result, 'Migration tamamlandı.');
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async list(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req, req.query.projectId);
            sendResponse(res, 200, await enterpriseMigrationService.list(projectId));
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async get(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req, req.query.projectId);
            sendResponse(res, 200, await enterpriseMigrationService.get(projectId, req.params.jobId));
        } catch (error) { respondWithControllerError(res, error); }
    }
    static async report(req: Request, res: Response) {
        try {
            const projectId = getAuthorizedProjectId(req, req.query.projectId);
            const report = await enterpriseMigrationService.report(projectId, req.params.jobId);
            res.setHeader('Content-Disposition', `attachment; filename="nexa-migration-${report.id}.json"`);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.status(200).send(JSON.stringify(report, null, 2));
        } catch (error) { respondWithControllerError(res, error); }
    }
}
