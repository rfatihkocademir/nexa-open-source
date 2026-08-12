import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';

export type ResourceType = 'WORK_ITEM' | 'TEST_CASE' | 'TEST_RUN' | 'MILESTONE' | 'RELEASE_CANDIDATE' | 'WIKI_PAGE';

export interface ResolvedResource {
    type: ResourceType;
    id: string;
    key: string;
    projectId: string | null;
    projectKey: string | null;
    projectSlug: string | null;
    teamSlug: string;
    canonicalType: string;
    canonicalPath: string;
    titleSlug?: string | null;
}

const normalizeKey = (key: string) => decodeURIComponent(key).trim().toUpperCase();
const slugify = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const workItemPathType = (itemType?: string | null) => ({
    EPIC: 'epic', STORY: 'story', TASK: 'task', BUG: 'bug', DEFECT: 'bug', INCIDENT: 'incident',
    OPERATIONAL: 'operation', MEETING: 'activity', PRESENTATION: 'activity', SUPPORT: 'support', ADMINISTRATIVE: 'activity',
}[String(itemType || '').toUpperCase()] || 'work');

export class ResourceService {
    async resolveProject(rawKey: string, userId: string, role: string) {
        const key = normalizeKey(rawKey);
        let project = await prisma.project.findUnique({
            where: { key },
            select: { id: true, key: true, slug: true, primaryTeam: { select: { slug: true } } },
        });

        if (!project) {
            try {
                const resource = await this.resolve(rawKey, userId, role);
                if (resource?.projectId) {
                    project = await prisma.project.findUnique({
                        where: { id: resource.projectId },
                        select: { id: true, key: true, slug: true, primaryTeam: { select: { slug: true } } },
                    });
                }
            } catch {
                const prefix = key.split('-')[0];
                if (prefix && prefix !== key) {
                    project = await prisma.project.findUnique({
                        where: { key: prefix },
                        select: { id: true, key: true, slug: true, primaryTeam: { select: { slug: true } } },
                    });
                }
            }
        }

        if (!project) throw new AppError('Project not found', 404);
        await ProjectAccess.check(project.id, userId, role);
        const teamSlug = project.primaryTeam?.slug || 'workspace';
        return { ...project, teamSlug, canonicalPath: `/${teamSlug}/${project.slug}` };
    }

    async resolve(rawKey: string, userId: string, role: string): Promise<ResolvedResource> {
        const key = normalizeKey(rawKey);
        if (!/^[A-Z0-9][A-Z0-9-]{1,63}$/.test(key)) {
            throw new AppError('Invalid resource key', 400);
        }

        let resource: ResolvedResource | null = null;

        let canonicalType = 'work';
        let titleSlug: string | null = null;
        if (key.includes('-DOC-')) {
            const page = await prisma.wikiPage.findUnique({
                where: { key },
                select: { id: true, key: true, title: true, space: { select: { projectId: true } } },
            });
            if (page?.key) {
                canonicalType = 'wiki';
                titleSlug = slugify(page.title);
                resource = { type: 'WIKI_PAGE', id: page.id, key: page.key, projectId: page.space.projectId, projectKey: null, projectSlug: null, teamSlug: 'workspace', canonicalType, canonicalPath: '', titleSlug };
            }
        } else if (key.includes('-TC-')) {
            const testCase = await prisma.testCase.findUnique({
                where: { key },
                select: { id: true, key: true, suite: { select: { projectId: true } } },
            });
            if (testCase) { canonicalType = 'test'; resource = { type: 'TEST_CASE', id: testCase.id, key: testCase.key, projectId: testCase.suite.projectId, projectKey: null, projectSlug: null, teamSlug: 'workspace', canonicalType, canonicalPath: '' }; }
        } else if (key.includes('-TR-') || key.includes('-RUN-')) {
            const run = await (prisma.testRun as any).findUnique({ where: { key }, select: { id: true, key: true, projectId: true } });
            if (run) { canonicalType = 'run'; resource = { type: 'TEST_RUN', ...run, projectKey: null, projectSlug: null, teamSlug: 'workspace', canonicalType, canonicalPath: '' }; }
        } else if (key.includes('-MS-')) {
            const milestone = await (prisma.milestone as any).findUnique({ where: { key }, select: { id: true, key: true, projectId: true } });
            if (milestone) { canonicalType = 'milestone'; resource = { type: 'MILESTONE', ...milestone, projectKey: null, projectSlug: null, teamSlug: 'workspace', canonicalType, canonicalPath: '' }; }
        } else if (key.includes('-RC-') || key.includes('-REL-')) {
            const release = await ((prisma as any).releaseCandidate).findUnique({ where: { key }, select: { id: true, key: true, projectId: true } });
            if (release) { canonicalType = 'release'; resource = { type: 'RELEASE_CANDIDATE', ...release, projectKey: null, projectSlug: null, teamSlug: 'workspace', canonicalType, canonicalPath: '' }; }
        } else {
            const workItem = await prisma.workItem.findUnique({ where: { key }, select: { id: true, key: true, projectId: true, itemType: true } });
            if (workItem) { canonicalType = workItemPathType(workItem.itemType); resource = { type: 'WORK_ITEM', id: workItem.id, key: workItem.key, projectId: workItem.projectId, projectKey: null, projectSlug: null, teamSlug: 'workspace', canonicalType, canonicalPath: '' }; }
        }

        if (!resource) throw new AppError('Resource not found', 404);
        if (resource.projectId) {
            await ProjectAccess.check(resource.projectId, userId, role);
            const project = await prisma.project.findUnique({
                where: { id: resource.projectId },
                select: { key: true, slug: true, primaryTeam: { select: { slug: true } } },
            });
            resource.projectKey = project?.key ?? null;
            resource.projectSlug = project?.slug ?? null;
            resource.teamSlug = project?.primaryTeam?.slug || 'workspace';
            const suffix = titleSlug ? `/${titleSlug}` : '';
            resource.canonicalPath = `/${resource.teamSlug}/${resource.projectSlug}/${canonicalType}/${resource.key}${suffix}`;
        }
        return resource;
    }
}

export const resourceService = new ResourceService();
