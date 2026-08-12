import { createHash } from 'node:crypto';
import { Priority, ResultStatus, WorkItemStatus, WorkItemType } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { integrationService } from './integration.service';
import { jiraClientService } from './jira-client.service';
import { saveAttachment } from './storage.service';

type JiraIssue = {
    id?: string;
    key?: string;
    fields?: Record<string, any>;
    _xrayExecution?: XrayExecution;
};
type XrayExecution = {
    id?: string; key?: string; summary?: string; status?: string; startedAt?: string; completedAt?: string;
    tests?: Array<{ id?: string; testIssueKey?: string; status?: string; comment?: string; executedByAccountId?: string; duration?: number; stepResults?: unknown }>;
};

type MigrationMapping = {
    typeMap?: Record<string, string>;
    statusMap?: Record<string, string>;
    priorityMap?: Record<string, string>;
    userMap?: Record<string, string>;
};

type NormalizedEntity = {
    externalId: string;
    sourceKey: string;
    entityType: 'WORK_ITEM' | 'TEST_CASE' | 'TEST_EXECUTION';
    title: string;
    description: string | null;
    itemType?: WorkItemType;
    status?: WorkItemStatus;
    priority: Priority;
    steps?: unknown[];
    assigneeAccountId?: string;
    reporterAccountId?: string;
    comments: Array<{ id: string; body: string; authorAccountId?: string; authorName?: string; created?: string }>;
    links: Array<{ targetKey: string; type: 'BLOCKS' | 'DEPENDS_ON' | 'RELATED' }>;
    parentKey?: string;
    labels: string[];
    attachments: Array<{ id: string; filename: string; size?: number; mimeType?: string }>;
    sprint?: { id: string; name: string; state?: string; goal?: string; startDate?: string; endDate?: string };
    execution?: XrayExecution;
    checksum: string;
};

const DEFAULT_TYPE_MAP: Record<string, WorkItemType> = {
    epic: 'EPIC', story: 'STORY', task: 'TASK', subtask: 'TASK', 'sub-task': 'TASK',
    bug: 'BUG', defect: 'DEFECT', incident: 'INCIDENT', support: 'SUPPORT',
};
const DEFAULT_STATUS_MAP: Record<string, WorkItemStatus> = {
    backlog: 'BACKLOG', 'to do': 'TODO', todo: 'TODO', open: 'OPEN',
    analysis: 'IN_ANALYSIS', 'in analysis': 'IN_ANALYSIS', 'in progress': 'IN_PROGRESS',
    'ready for test': 'READY_FOR_TEST', qa: 'QA', retest: 'RETEST',
    done: 'DONE', closed: 'CLOSED', reopened: 'REOPENED',
};
const DEFAULT_PRIORITY_MAP: Record<string, Priority> = {
    lowest: 'LOW', low: 'LOW', medium: 'MEDIUM', high: 'HIGH',
    highest: 'CRITICAL', critical: 'CRITICAL', blocker: 'CRITICAL',
};

const text = (value: unknown): string | null => {
    if (typeof value === 'string') return value.trim() || null;
    if (value && typeof value === 'object') return JSON.stringify(value);
    return null;
};
const nameOf = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
        const record = value as { name?: unknown; displayName?: unknown };
        return String(record.name ?? record.displayName ?? '');
    }
    return '';
};
const adfText = (value: unknown): string | null => {
    if (typeof value === 'string') return value.trim() || null;
    if (!value || typeof value !== 'object') return null;
    const node = value as { text?: unknown; type?: unknown; content?: unknown[] };
    if (typeof node.text === 'string') return node.text;
    if (!Array.isArray(node.content)) return null;
    const separator = node.type === 'doc' || node.type === 'paragraph' || node.type === 'bulletList' || node.type === 'orderedList' ? '\n' : '';
    return node.content.map(adfText).filter(Boolean).join(separator).trim() || null;
};
const accountIdOf = (value: unknown): string | undefined => value && typeof value === 'object' && 'accountId' in value ? String((value as { accountId?: unknown }).accountId || '') || undefined : undefined;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const safeDate = (value?: string) => value && !Number.isNaN(Date.parse(value)) ? new Date(value) : undefined;
const publicJobSelect = {
    id: true, projectId: true, source: true, status: true, mode: true, summary: true, errors: true,
    createdById: true, startedAt: true, completedAt: true, createdAt: true, updatedAt: true,
} as const;

export class EnterpriseMigrationService {
    private issues(payload: unknown): JiraIssue[] {
        const raw = Array.isArray(payload) ? payload : (payload as { issues?: unknown })?.issues;
        if (!Array.isArray(raw)) throw new AppError('Jira dışa aktarımı issues dizisi içermelidir.', 400);
        const executions = !Array.isArray(payload) && Array.isArray((payload as { xrayExecutions?: unknown[] }).xrayExecutions)
            ? (payload as { xrayExecutions: XrayExecution[] }).xrayExecutions.map((execution) => ({ id: execution.id || execution.key, key: execution.key || execution.id, fields: { summary: execution.summary || execution.key || 'Xray Test Execution' }, _xrayExecution: execution }))
            : [];
        if (raw.length + executions.length === 0) throw new AppError('İçe aktarılacak kayıt bulunamadı.', 400);
        if (raw.length + executions.length > 5000) throw new AppError('Tek migration işi en fazla 5000 kayıt içerebilir.', 400);
        return [...raw.filter((issue): issue is JiraIssue => Boolean(issue && typeof issue === 'object')), ...executions];
    }

    private normalize(issue: JiraIssue, mapping: MigrationMapping): NormalizedEntity {
        const fields = issue.fields ?? {};
        const externalId = String(issue.id || issue.key || '').trim();
        const sourceKey = String(issue.key || issue.id || '').trim();
        const title = String(fields.summary || '').trim();
        if (!externalId || !title) throw new AppError('Her Jira kaydı id/key ve summary içermelidir.', 400);
        if (issue._xrayExecution) {
            const normalized = {
                externalId, sourceKey, title, description: null, priority: 'MEDIUM' as Priority,
                entityType: 'TEST_EXECUTION' as const, comments: [], links: [], labels: [], attachments: [], execution: issue._xrayExecution,
            };
            return { ...normalized, checksum: hash(normalized) };
        }
        const rawType = nameOf(fields.issuetype).trim();
        const typeKey = rawType.toLowerCase();
        const isXrayTest = typeKey === 'test' || typeKey === 'xray test';
        const mappedType = mapping.typeMap?.[rawType] || mapping.typeMap?.[typeKey] || DEFAULT_TYPE_MAP[typeKey] || 'TASK';
        const rawStatus = nameOf(fields.status).trim();
        const rawPriority = nameOf(fields.priority).trim();
        const status = (mapping.statusMap?.[rawStatus] || mapping.statusMap?.[rawStatus.toLowerCase()] || DEFAULT_STATUS_MAP[rawStatus.toLowerCase()] || 'TODO') as WorkItemStatus;
        const priority = (mapping.priorityMap?.[rawPriority] || mapping.priorityMap?.[rawPriority.toLowerCase()] || DEFAULT_PRIORITY_MAP[rawPriority.toLowerCase()] || 'MEDIUM') as Priority;
        if (!Object.values(WorkItemType).includes(mappedType as WorkItemType)) throw new AppError(`Geçersiz iş tipi eşlemesi: ${mappedType}`, 400);
        if (!Object.values(WorkItemStatus).includes(status)) throw new AppError(`Geçersiz durum eşlemesi: ${status}`, 400);
        if (!Object.values(Priority).includes(priority)) throw new AppError(`Geçersiz öncelik eşlemesi: ${priority}`, 400);
        const rawComments = fields.comment && typeof fields.comment === 'object' && Array.isArray((fields.comment as { comments?: unknown[] }).comments)
            ? (fields.comment as { comments: Array<Record<string, unknown>> }).comments : [];
        const comments = rawComments.map((comment, index) => ({
            id: String(comment.id || index),
            body: adfText(comment.body) || '',
            authorAccountId: accountIdOf(comment.author),
            authorName: nameOf(comment.author),
            created: typeof comment.created === 'string' ? comment.created : undefined,
        })).filter((comment) => comment.body);
        const rawLinks = Array.isArray(fields.issuelinks) ? fields.issuelinks as Array<Record<string, any>> : [];
        const links = rawLinks.map((link) => {
            const outward = link.outwardIssue?.key ? String(link.outwardIssue.key) : '';
            const inward = link.inwardIssue?.key ? String(link.inwardIssue.key) : '';
            const linkName = String(link.type?.name || '').toLowerCase();
            return {
                targetKey: outward || inward,
                type: linkName.includes('block') ? (outward ? 'BLOCKS' as const : 'DEPENDS_ON' as const) : 'RELATED' as const,
            };
        }).filter((link) => link.targetKey);
        const sprintValue = Array.isArray(fields.sprint) ? fields.sprint[fields.sprint.length - 1] : fields.sprint;
        const parentKey = fields.parent && typeof fields.parent === 'object'
            ? String((fields.parent as Record<string, unknown>).key || '').trim() || undefined
            : undefined;
        const labels = Array.isArray(fields.labels)
            ? [...new Set(fields.labels.map((label: unknown) => String(label).trim()).filter(Boolean))].slice(0, 100)
            : [];
        const attachments = Array.isArray(fields.attachment)
            ? fields.attachment.map((attachment: Record<string, unknown>) => ({
                id: String(attachment.id || '').trim(),
                filename: String(attachment.filename || 'jira-attachment').trim(),
                size: typeof attachment.size === 'number' ? attachment.size : undefined,
                mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType : undefined,
            })).filter((attachment: { id: string }) => attachment.id)
            : [];
        const sprint = sprintValue && typeof sprintValue === 'object' && (sprintValue as Record<string, unknown>).id
            ? {
                id: String((sprintValue as Record<string, unknown>).id),
                name: String((sprintValue as Record<string, unknown>).name || `Sprint ${(sprintValue as Record<string, unknown>).id}`),
                state: typeof (sprintValue as Record<string, unknown>).state === 'string' ? String((sprintValue as Record<string, unknown>).state) : undefined,
                goal: typeof (sprintValue as Record<string, unknown>).goal === 'string' ? String((sprintValue as Record<string, unknown>).goal) : undefined,
                startDate: typeof (sprintValue as Record<string, unknown>).startDate === 'string' ? String((sprintValue as Record<string, unknown>).startDate) : undefined,
                endDate: typeof (sprintValue as Record<string, unknown>).endDate === 'string' ? String((sprintValue as Record<string, unknown>).endDate) : undefined,
            } : undefined;
        const normalized = {
            externalId, sourceKey, title, description: adfText(fields.description) || text(fields.description), priority,
            entityType: isXrayTest ? 'TEST_CASE' as const : 'WORK_ITEM' as const,
            itemType: isXrayTest ? undefined : mappedType as WorkItemType,
            status: isXrayTest ? undefined : status,
            steps: isXrayTest && Array.isArray(fields.steps) ? fields.steps : undefined,
            assigneeAccountId: accountIdOf(fields.assignee),
            reporterAccountId: accountIdOf(fields.reporter),
            comments,
            links,
            parentKey,
            labels,
            attachments,
            sprint,
        };
        return { ...normalized, checksum: hash(normalized) };
    }

    async analyze(projectId: string, actorId: string, payload: unknown, mapping: MigrationMapping = {}, source = 'JIRA_XRAY_JSON') {
        const issues = this.issues(payload);
        const entities: NormalizedEntity[] = [];
        const errors: Array<{ index: number; key?: string; message: string }> = [];
        issues.forEach((issue, index) => {
            try { entities.push(this.normalize(issue, mapping)); }
            catch (error) { errors.push({ index, key: issue.key, message: error instanceof Error ? error.message : 'Geçersiz kayıt' }); }
        });
        const seen = new Set<string>();
        const uniqueEntities = entities.filter((entry, index) => {
            const identity = `${entry.entityType}:${entry.externalId}`;
            if (!seen.has(identity)) { seen.add(identity); return true; }
            errors.push({ index, key: entry.sourceKey, message: `Aynı dış kimlik dosyada birden fazla kez bulunuyor: ${entry.externalId}` });
            return false;
        });
        const duplicateCount = entities.length - uniqueEntities.length;
        const discoveredUsers = new Map<string, string>();
        for (const issue of issues) {
            for (const user of [issue.fields?.assignee, issue.fields?.reporter]) {
                const accountId = accountIdOf(user);
                if (accountId) discoveredUsers.set(accountId, nameOf(user) || accountId);
            }
            const rawComments = issue.fields?.comment?.comments;
            if (Array.isArray(rawComments)) {
                for (const comment of rawComments) {
                    const accountId = accountIdOf(comment?.author);
                    if (accountId) discoveredUsers.set(accountId, nameOf(comment.author) || accountId);
                }
            }
        }
        const summary = {
            total: issues.length,
            valid: uniqueEntities.length,
            invalid: errors.length,
            duplicates: duplicateCount,
            workItems: uniqueEntities.filter((entry) => entry.entityType === 'WORK_ITEM').length,
            testCases: uniqueEntities.filter((entry) => entry.entityType === 'TEST_CASE').length,
            testExecutions: uniqueEntities.filter((entry) => entry.entityType === 'TEST_EXECUTION').length,
            comments: uniqueEntities.reduce((total, entry) => total + entry.comments.length, 0),
            links: uniqueEntities.reduce((total, entry) => total + entry.links.length, 0),
            labels: new Set(uniqueEntities.flatMap((entry) => entry.labels)).size,
            hierarchyLinks: uniqueEntities.filter((entry) => entry.parentKey).length,
            attachments: uniqueEntities.reduce((total, entry) => total + entry.attachments.length, 0),
            discoveredUsers: [...discoveredUsers].map(([accountId, displayName]) => ({ accountId, displayName })),
            sprints: new Set(uniqueEntities.map((entry) => entry.sprint?.id).filter(Boolean)).size,
        };
        return prisma.migrationJob.create({
            data: {
                projectId, source, mapping: mapping as never,
                sourceData: uniqueEntities as never, summary, errors: errors as never, createdById: actorId,
            },
            select: { ...publicJobSelect, records: { take: 0 } },
        });
    }

    async dryRun(projectId: string, jobId: string) {
        const job = await prisma.migrationJob.findFirst({ where: { id: jobId, projectId } });
        if (!job) throw new AppError('Migration işi bulunamadı.', 404);
        if (job.status === 'RUNNING') throw new AppError('Çalışan migration işi analiz edilemez.', 409);
        const entities = job.sourceData as unknown as NormalizedEntity[];
        const identities = await prisma.migrationRecord.findMany({
            where: { projectId, source: job.source },
            select: { externalId: true, entityType: true, checksum: true, targetId: true },
        });
        const byKey = new Map(identities.map((entry) => [`${entry.entityType}:${entry.externalId}`, entry]));
        const actions = entities.map((entry) => {
            const existing = byKey.get(`${entry.entityType}:${entry.externalId}`);
            return { externalId: entry.externalId, sourceKey: entry.sourceKey, entityType: entry.entityType, action: !existing ? 'CREATE' : existing.checksum === entry.checksum ? 'UNCHANGED' : 'UPDATE', targetId: existing?.targetId };
        });
        const summary = {
            ...(job.summary as object),
            create: actions.filter((entry) => entry.action === 'CREATE').length,
            update: actions.filter((entry) => entry.action === 'UPDATE').length,
            unchanged: actions.filter((entry) => entry.action === 'UNCHANGED').length,
        };
        await prisma.migrationJob.update({ where: { id: job.id }, data: { status: 'READY', summary } });
        return { jobId, summary, actions };
    }

    async execute(projectId: string, jobId: string) {
        const claimed = await prisma.migrationJob.updateMany({
            where: { id: jobId, projectId, status: { in: ['ANALYZED', 'READY', 'FAILED', 'COMPLETED_WITH_ERRORS'] } },
            data: { status: 'RUNNING', startedAt: new Date(), completedAt: null },
        });
        if (claimed.count !== 1) throw new AppError('Migration işi bulunamadı veya zaten çalışıyor.', 409);
        const job = await prisma.migrationJob.findUniqueOrThrow({ where: { id: jobId } });
        const initialSummary = job.summary as { invalid?: number };
        if ((initialSummary.invalid ?? 0) > 0) {
            await prisma.migrationJob.update({ where: { id: jobId }, data: { status: 'ANALYZED', startedAt: null } });
            throw new AppError('Hatalı kayıtlar düzeltilmeden migration başlatılamaz.', 409);
        }
        const entities = job.sourceData as unknown as NormalizedEntity[];
        const mapping = job.mapping as unknown as MigrationMapping;
        const requestedUserIds = Object.values(mapping.userMap || {});
        const validMembers = requestedUserIds.length ? await prisma.projectMember.findMany({
            where: { projectId, userId: { in: requestedUserIds } },
            select: { userId: true },
        }) : [];
        const allowedUserIds = new Set(validMembers.map((member) => member.userId));
        const resolveUser = (accountId?: string) => {
            const userId = accountId ? mapping.userMap?.[accountId] : undefined;
            return userId && allowedUserIds.has(userId) ? userId : undefined;
        };
        let created = 0; let updated = 0; let unchanged = 0; let failed = 0;
        const errors: Array<{ externalId: string; message: string }> = [];
        let defaultSuiteId: string | undefined;
        if (entities.some((entry) => entry.entityType === 'TEST_CASE')) {
            let suite = await prisma.testSuite.findFirst({
                where: { projectId, name: 'Jira/Xray Migration', deletedAt: null },
            });
            suite ??= await prisma.testSuite.create({
                data: { projectId, name: 'Jira/Xray Migration', description: 'Jira/Xray taşıma merkezi tarafından oluşturuldu.' },
            });
            defaultSuiteId = suite.id;
        }

        for (const entity of entities.filter((entry) => entry.entityType !== 'TEST_EXECUTION')) {
            try {
                const result = await prisma.$transaction(async (tx) => {
                    const identity = await tx.migrationRecord.findUnique({
                        where: { projectId_source_entityType_externalId: { projectId, source: job.source, entityType: entity.entityType, externalId: entity.externalId } },
                    });
                    if (identity?.checksum === entity.checksum && identity.targetId) {
                        await tx.migrationRecord.update({ where: { id: identity.id }, data: { jobId, status: 'UNCHANGED', error: null } });
                        return 'UNCHANGED';
                    }
                    let targetId = identity?.targetId;
                    if (entity.entityType === 'WORK_ITEM') {
                        const data = {
                            title: entity.title, description: entity.description, priority: entity.priority, status: entity.status!, itemType: entity.itemType!,
                            assigneeId: resolveUser(entity.assigneeAccountId) || null,
                            reporterId: resolveUser(entity.reporterAccountId) || null,
                            customFields: {
                                jiraKey: entity.sourceKey,
                                migrationSource: job.source,
                                jiraAssigneeAccountId: entity.assigneeAccountId,
                                jiraReporterAccountId: entity.reporterAccountId,
                                jiraLabels: entity.labels,
                            },
                        };
                        if (targetId && await tx.workItem.findUnique({ where: { id: targetId }, select: { id: true } })) {
                            await tx.workItem.update({ where: { id: targetId }, data });
                        } else {
                            const project = await tx.project.update({ where: { id: projectId }, data: { nextWorkItemNumber: { increment: 1 } }, select: { key: true, nextWorkItemNumber: true } });
                            const sequenceNumber = project.nextWorkItemNumber - 1;
                            const item = await tx.workItem.create({ data: { ...data, projectId, sequenceNumber, key: `${project.key}-${sequenceNumber}` } });
                            targetId = item.id;
                        }
                    } else if (entity.entityType === 'TEST_CASE') {
                        if (!defaultSuiteId) throw new AppError('Xray test suite oluşturulamadı.', 500);
                        const data = { title: entity.title, description: entity.description, priority: entity.priority, steps: (entity.steps ?? []) as never };
                        if (targetId && await tx.testCase.findUnique({ where: { id: targetId }, select: { id: true } })) {
                            await tx.testCase.update({ where: { id: targetId }, data });
                        } else {
                            const project = await tx.project.update({ where: { id: projectId }, data: { nextTestCaseNumber: { increment: 1 } }, select: { key: true, nextTestCaseNumber: true } });
                            const sequenceNumber = project.nextTestCaseNumber - 1;
                            const testCase = await tx.testCase.create({ data: { ...data, suiteId: defaultSuiteId, authorId: job.createdById, sequenceNumber, key: `${project.key}-TC-${sequenceNumber}` } });
                            targetId = testCase.id;
                        }
                    } else throw new AppError('Unsupported migration entity', 400);
                    await tx.migrationRecord.upsert({
                        where: { projectId_source_entityType_externalId: { projectId, source: job.source, entityType: entity.entityType, externalId: entity.externalId } },
                        create: { jobId, projectId, source: job.source, entityType: entity.entityType, externalId: entity.externalId, targetId, checksum: entity.checksum, status: identity ? 'UPDATED' : 'CREATED' },
                        update: { jobId, targetId, checksum: entity.checksum, status: identity ? 'UPDATED' : 'CREATED', error: null },
                    });
                    return identity ? 'UPDATED' : 'CREATED';
                });
                if (result === 'CREATED') created++; else if (result === 'UPDATED') updated++; else unchanged++;
            } catch (error) {
                failed++;
                errors.push({ externalId: entity.externalId, message: error instanceof Error ? error.message : 'İçe aktarma hatası' });
            }
        }
        const workItemIdentities = await prisma.migrationRecord.findMany({
            where: { projectId, source: job.source, entityType: 'WORK_ITEM', externalId: { in: entities.filter((entry) => entry.entityType === 'WORK_ITEM').map((entry) => entry.externalId) } },
            select: { externalId: true, targetId: true },
        });
        const targetByExternalId = new Map(workItemIdentities.map((identity) => [identity.externalId, identity.targetId]));
        const externalBySourceKey = new Map(entities.map((entity) => [entity.sourceKey, entity.externalId]));
        const liveIntegrationMatch = /^JIRA(?:_XRAY)?:([^:]+)$/.exec(job.source);
        const jiraConfig = liveIntegrationMatch ? await integrationService.getJiraConfig(liveIntegrationMatch[1], projectId) : undefined;
        let transferredAttachmentBytes = 0;
        for (const entity of entities.filter((entry) => entry.entityType === 'WORK_ITEM')) {
            try {
                const workItemId = targetByExternalId.get(entity.externalId);
                if (!workItemId) continue;
                if (entity.parentKey) {
                    const parentExternalId = externalBySourceKey.get(entity.parentKey);
                    const parentId = parentExternalId ? targetByExternalId.get(parentExternalId) : undefined;
                    if (parentId && parentId !== workItemId) {
                        await prisma.workItem.update({ where: { id: workItemId }, data: { parentId } });
                    }
                }
                if (entity.sprint) {
                const identityKey = entity.sprint.id;
                let sprintRecord = await prisma.migrationRecord.findUnique({ where: { projectId_source_entityType_externalId: { projectId, source: job.source, entityType: 'SPRINT', externalId: identityKey } } });
                let sprintId = sprintRecord?.targetId;
                if (!sprintId) {
                    const sprint = await prisma.sprint.create({ data: {
                        projectId, name: entity.sprint.name, goal: entity.sprint.goal,
                        status: entity.sprint.state?.toLowerCase() === 'active' ? 'ACTIVE' : entity.sprint.state?.toLowerCase() === 'closed' ? 'CLOSED' : 'PLANNED',
                        startDate: safeDate(entity.sprint.startDate),
                        endDate: safeDate(entity.sprint.endDate),
                    } });
                    sprintId = sprint.id;
                    sprintRecord = await prisma.migrationRecord.create({ data: { jobId, projectId, source: job.source, entityType: 'SPRINT', externalId: identityKey, targetId: sprintId, checksum: hash(entity.sprint), status: 'CREATED' } });
                } else if (sprintRecord) {
                    const sprintChecksum = hash(entity.sprint);
                    if (sprintRecord.checksum !== sprintChecksum) await prisma.sprint.update({ where: { id: sprintId }, data: {
                        name: entity.sprint.name, goal: entity.sprint.goal,
                        status: entity.sprint.state?.toLowerCase() === 'active' ? 'ACTIVE' : entity.sprint.state?.toLowerCase() === 'closed' ? 'CLOSED' : 'PLANNED',
                        startDate: safeDate(entity.sprint.startDate), endDate: safeDate(entity.sprint.endDate),
                    } });
                    await prisma.migrationRecord.update({ where: { id: sprintRecord.id }, data: { jobId, checksum: sprintChecksum, status: sprintRecord.checksum === sprintChecksum ? 'UNCHANGED' : 'UPDATED' } });
                }
                await prisma.workItem.update({ where: { id: workItemId }, data: { sprintId } });
                }
                for (const sourceComment of entity.comments) {
                const externalId = `${entity.externalId}:${sourceComment.id}`;
                const checksum = hash(sourceComment);
                const identity = await prisma.migrationRecord.findUnique({ where: { projectId_source_entityType_externalId: { projectId, source: job.source, entityType: 'COMMENT', externalId } } });
                const authorId = resolveUser(sourceComment.authorAccountId) || job.createdById;
                const content = sourceComment.authorName && !resolveUser(sourceComment.authorAccountId) ? `**${sourceComment.authorName} (Jira):**\n\n${sourceComment.body}` : sourceComment.body;
                if (identity?.targetId) {
                    if (identity.checksum !== checksum) await prisma.comment.update({ where: { id: identity.targetId }, data: { content, authorId } });
                    await prisma.migrationRecord.update({ where: { id: identity.id }, data: { jobId, checksum, status: identity.checksum === checksum ? 'UNCHANGED' : 'UPDATED', error: null } });
                } else {
                    const comment = await prisma.comment.create({ data: { workItemId, authorId, content, ...(sourceComment.created && !Number.isNaN(Date.parse(sourceComment.created)) ? { createdAt: new Date(sourceComment.created) } : {}) } });
                    await prisma.migrationRecord.upsert({
                        where: { projectId_source_entityType_externalId: { projectId, source: job.source, entityType: 'COMMENT', externalId } },
                        create: { jobId, projectId, source: job.source, entityType: 'COMMENT', externalId, targetId: comment.id, checksum, status: 'CREATED' },
                        update: { jobId, targetId: comment.id, checksum, status: 'CREATED', error: null },
                    });
                }
                if (jiraConfig) {
                    for (const sourceAttachment of entity.attachments) {
                        const externalId = `${entity.externalId}:${sourceAttachment.id}`;
                        const identity = await prisma.migrationRecord.findUnique({
                            where: { projectId_source_entityType_externalId: { projectId, source: job.source, entityType: 'ATTACHMENT', externalId } },
                        });
                        if (identity?.targetId && await prisma.attachment.findFirst({ where: { id: identity.targetId, deletedAt: null }, select: { id: true } })) {
                            await prisma.migrationRecord.update({ where: { id: identity.id }, data: { jobId, status: 'UNCHANGED', error: null } });
                            continue;
                        }
                        const downloaded = await jiraClientService.downloadAttachment(jiraConfig, sourceAttachment);
                        transferredAttachmentBytes += downloaded.size;
                        if (transferredAttachmentBytes > 250 * 1024 * 1024) throw new AppError('Tek migration işinde ek dosya aktarımı 250 MB ile sınırlıdır.', 413);
                        const attachment = await saveAttachment(downloaded.buffer, downloaded.filename, downloaded.mimetype, downloaded.size, job.createdById, { workItemId, prefix: 'work-items' });
                        await prisma.migrationRecord.upsert({
                            where: { projectId_source_entityType_externalId: { projectId, source: job.source, entityType: 'ATTACHMENT', externalId } },
                            create: { jobId, projectId, source: job.source, entityType: 'ATTACHMENT', externalId, targetId: attachment.id, checksum: hash(sourceAttachment), status: 'CREATED' },
                            update: { jobId, targetId: attachment.id, checksum: hash(sourceAttachment), status: 'CREATED', error: null },
                        });
                    }
                }
                }
                for (const link of entity.links) {
                const targetExternalId = externalBySourceKey.get(link.targetKey);
                const targetId = targetExternalId ? targetByExternalId.get(targetExternalId) : undefined;
                if (!targetId || targetId === workItemId) continue;
                await prisma.workItemDependency.upsert({
                    where: { sourceWorkItemId_targetWorkItemId_type: { sourceWorkItemId: workItemId, targetWorkItemId: targetId, type: link.type } },
                    create: { sourceWorkItemId: workItemId, targetWorkItemId: targetId, type: link.type },
                    update: {},
                });
                }
            } catch (error) {
                failed++;
                errors.push({ externalId: entity.externalId, message: `İlişkili veri: ${error instanceof Error ? error.message : 'içe aktarma hatası'}` });
            }
        }
        const testCaseExternalByKey = new Map(entities.filter((entry) => entry.entityType === 'TEST_CASE').map((entity) => [entity.sourceKey, entity.externalId]));
        for (const entity of entities.filter((entry) => entry.entityType === 'TEST_EXECUTION')) {
            try {
                const execution = entity.execution!;
                let identity = await prisma.migrationRecord.findUnique({
                    where: { projectId_source_entityType_externalId: { projectId, source: job.source, entityType: 'TEST_EXECUTION', externalId: entity.externalId } },
                });
                const executionAction = !identity ? 'CREATED' : identity.checksum === entity.checksum ? 'UNCHANGED' : 'UPDATED';
                let runId = identity?.targetId;
                const runStatus = ['done', 'closed', 'completed'].includes(String(execution.status || '').toLowerCase()) ? 'COMPLETED' : 'OPEN';
                if (runId && await prisma.testRun.findUnique({ where: { id: runId }, select: { id: true } })) {
                    await prisma.testRun.update({ where: { id: runId }, data: { title: entity.title, status: runStatus, startDate: safeDate(execution.startedAt), dueDate: safeDate(execution.completedAt) } });
                } else {
                    const project = await prisma.project.update({ where: { id: projectId }, data: { nextTestRunNumber: { increment: 1 } }, select: { key: true, nextTestRunNumber: true } });
                    const sequenceNumber = project.nextTestRunNumber - 1;
                    const run = await prisma.testRun.create({ data: {
                        projectId, creatorId: job.createdById, sequenceNumber, key: `${project.key}-RUN-${sequenceNumber}`,
                        title: entity.title, status: runStatus, startDate: safeDate(execution.startedAt), dueDate: safeDate(execution.completedAt),
                    } });
                    runId = run.id;
                }
                identity = await prisma.migrationRecord.upsert({
                    where: { projectId_source_entityType_externalId: { projectId, source: job.source, entityType: 'TEST_EXECUTION', externalId: entity.externalId } },
                    create: { jobId, projectId, source: job.source, entityType: 'TEST_EXECUTION', externalId: entity.externalId, targetId: runId, checksum: entity.checksum, status: identity ? 'UPDATED' : 'CREATED' },
                    update: { jobId, targetId: runId, checksum: entity.checksum, status: identity?.checksum === entity.checksum ? 'UNCHANGED' : 'UPDATED', error: null },
                });
                if (executionAction === 'CREATED') created++; else if (executionAction === 'UPDATED') updated++; else unchanged++;
                const counters = { PASS: 0, FAIL: 0, BLOCK: 0, RETEST: 0, UNTESTED: 0 };
                for (const [index, sourceResult] of (execution.tests || []).entries()) {
                    const testExternalId = sourceResult.testIssueKey ? testCaseExternalByKey.get(sourceResult.testIssueKey) : undefined;
                    if (!testExternalId) throw new AppError(`Xray sonucu için test case bulunamadı: ${sourceResult.testIssueKey || index + 1}`, 409);
                    const testIdentity = await prisma.migrationRecord.findUnique({
                        where: { projectId_source_entityType_externalId: { projectId, source: job.source, entityType: 'TEST_CASE', externalId: testExternalId } },
                    });
                    if (!testIdentity?.targetId) throw new AppError(`Xray test case henüz aktarılmamış: ${sourceResult.testIssueKey}`, 409);
                    const rawStatus = String(sourceResult.status || '').toUpperCase();
                    const resultStatus: ResultStatus = rawStatus === 'PASS' || rawStatus === 'PASSED' ? 'PASS'
                        : rawStatus === 'FAIL' || rawStatus === 'FAILED' ? 'FAIL'
                            : rawStatus === 'BLOCK' || rawStatus === 'BLOCKED' ? 'BLOCK'
                                : rawStatus === 'RETEST' ? 'RETEST' : 'UNTESTED';
                    counters[resultStatus]++;
                    const runItem = await prisma.testRunItem.upsert({
                        where: { testRunId_testCaseId: { testRunId: runId, testCaseId: testIdentity.targetId } },
                        create: { testRunId: runId, testCaseId: testIdentity.targetId, finalStatus: resultStatus, manualStatus: resultStatus, manualExecutedAt: safeDate(execution.completedAt) || new Date() },
                        update: { finalStatus: resultStatus, manualStatus: resultStatus, manualExecutedAt: safeDate(execution.completedAt) || new Date() },
                    });
                    const resultExternalId = `${entity.externalId}:${sourceResult.id || sourceResult.testIssueKey || index}`;
                    const resultChecksum = hash(sourceResult);
                    const resultIdentity = await prisma.migrationRecord.findUnique({
                        where: { projectId_source_entityType_externalId: { projectId, source: job.source, entityType: 'TEST_RESULT', externalId: resultExternalId } },
                    });
                    const testerId = resolveUser(sourceResult.executedByAccountId) || job.createdById;
                    let resultId = resultIdentity?.targetId;
                    const resultData = { runItemId: runItem.id, status: resultStatus, comment: sourceResult.comment, duration: sourceResult.duration, stepResults: sourceResult.stepResults as never, testerId };
                    if (resultId && await prisma.testResult.findUnique({ where: { id: resultId }, select: { id: true } })) {
                        await prisma.testResult.update({ where: { id: resultId }, data: resultData });
                    } else {
                        const result = await prisma.testResult.create({ data: resultData });
                        resultId = result.id;
                    }
                    await prisma.migrationRecord.upsert({
                        where: { projectId_source_entityType_externalId: { projectId, source: job.source, entityType: 'TEST_RESULT', externalId: resultExternalId } },
                        create: { jobId, projectId, source: job.source, entityType: 'TEST_RESULT', externalId: resultExternalId, targetId: resultId, checksum: resultChecksum, status: resultIdentity ? 'UPDATED' : 'CREATED' },
                        update: { jobId, targetId: resultId, checksum: resultChecksum, status: resultIdentity?.checksum === resultChecksum ? 'UNCHANGED' : 'UPDATED', error: null },
                    });
                }
                const totalItems = Object.values(counters).reduce((total, value) => total + value, 0);
                await prisma.testRun.update({ where: { id: runId }, data: {
                    totalItems, passedCount: counters.PASS, failedCount: counters.FAIL,
                    blockedCount: counters.BLOCK, untestedCount: counters.UNTESTED + counters.RETEST,
                } });
            } catch (error) {
                failed++;
                errors.push({ externalId: entity.externalId, message: `Xray execution: ${error instanceof Error ? error.message : 'içe aktarma hatası'}` });
            }
        }
        const summary = { ...(job.summary as object), created, updated, unchanged, failed };
        return prisma.migrationJob.update({
            where: { id: jobId },
            data: { status: failed ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', completedAt: new Date(), summary, errors: errors as never },
            select: { ...publicJobSelect, records: { orderBy: { updatedAt: 'desc' }, take: 100, select: { id: true, externalId: true, entityType: true, targetId: true, status: true, error: true, updatedAt: true } } },
        });
    }

    async list(projectId: string) {
        return prisma.migrationJob.findMany({
            where: { projectId }, orderBy: { createdAt: 'desc' }, take: 50,
            select: { ...publicJobSelect, errors: false, _count: { select: { records: true } } },
        });
    }

    async get(projectId: string, jobId: string) {
        const job = await prisma.migrationJob.findFirst({
            where: { id: jobId, projectId },
            select: { ...publicJobSelect, records: { orderBy: { updatedAt: 'desc' }, take: 500, select: { id: true, externalId: true, entityType: true, targetId: true, status: true, error: true, updatedAt: true } } },
        });
        if (!job) throw new AppError('Migration işi bulunamadı.', 404);
        return job;
    }

    async report(projectId: string, jobId: string) {
        const job = await prisma.migrationJob.findFirst({
            where: { id: jobId, projectId },
            select: {
                ...publicJobSelect,
                records: {
                    orderBy: [{ entityType: 'asc' }, { externalId: 'asc' }],
                    select: { externalId: true, entityType: true, targetId: true, checksum: true, status: true, error: true, createdAt: true, updatedAt: true },
                },
            },
        });
        if (!job) throw new AppError('Migration işi bulunamadı.', 404);
        return job;
    }
}

export const enterpriseMigrationService = new EnterpriseMigrationService();
