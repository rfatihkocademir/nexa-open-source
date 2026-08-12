import { WorkItemStatus, WorkItemType } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';

const ITEM_TYPES = Object.values(WorkItemType);

export class WorkItemPolicyService {
    static async list(projectId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);
        return prisma.workItemPolicy.findMany({ where: { projectId }, orderBy: { itemType: 'asc' } });
    }

    static async upsert(projectId: string, itemType: string, userId: string, role: string, input: Record<string, unknown>) {
        await ProjectAccess.check(projectId, userId, role);
        if (!ITEM_TYPES.includes(itemType as WorkItemType)) throw new AppError('Invalid work item type', 400);
        const data = {
            requiresTestsForDone: Boolean(input.requiresTestsForDone),
            requiresPassingTest: Boolean(input.requiresPassingTest),
            requiresWorklogForDone: Boolean(input.requiresWorklogForDone),
            minimumLoggedMinutes: Math.max(0, Number(input.minimumLoggedMinutes) || 0),
            requiredFields: Array.isArray(input.requiredFields) ? input.requiredFields.filter((field): field is string => typeof field === 'string') : [],
        };
        return prisma.workItemPolicy.upsert({
            where: { projectId_itemType: { projectId, itemType: itemType as WorkItemType } },
            create: { projectId, itemType: itemType as WorkItemType, ...data },
            update: data,
        });
    }

    static async assertCompletion(itemId: string, nextStatus: string) {
        if (nextStatus !== WorkItemStatus.DONE && nextStatus !== WorkItemStatus.CLOSED) return;
        const item = await prisma.workItem.findUnique({
            where: { id: itemId },
            include: { worklogs: { where: { deletedAt: null }, select: { durationMinutes: true } } },
        });
        if (!item) throw new AppError('Work item not found', 404);
        const policy = await prisma.workItemPolicy.findUnique({
            where: { projectId_itemType: { projectId: item.projectId, itemType: item.itemType } },
        });
        if (!policy) return;

        const violations: string[] = [];
        const testCaseCount = policy.requiresTestsForDone || policy.requiresPassingTest
            ? await prisma.testCase.count({ where: { workItemId: item.id, deletedAt: null } })
            : 0;
        if (policy.requiresTestsForDone && testCaseCount === 0) violations.push('En az bir test case bağlanmalıdır.');
        if (policy.requiresPassingTest) {
            const passedResult = await prisma.testResult.findFirst({
                where: { deletedAt: null, status: 'PASS', runItem: { testCase: { workItemId: item.id } } },
                select: { id: true },
            });
            if (!passedResult) violations.push('En az bir başarılı test sonucu bulunmalıdır.');
        }
        const loggedMinutes = item.worklogs.reduce((sum, worklog) => sum + worklog.durationMinutes, 0);
        if (policy.requiresWorklogForDone && loggedMinutes === 0) violations.push('İş tamamlanmadan önce çalışma kaydı girilmelidir.');
        if (loggedMinutes < policy.minimumLoggedMinutes) violations.push(`En az ${policy.minimumLoggedMinutes} dakika çalışma kaydı gereklidir.`);

        const customFields = item.customFields && typeof item.customFields === 'object' ? item.customFields as Record<string, unknown> : {};
        for (const field of policy.requiredFields) {
            const value = field in item ? (item as unknown as Record<string, unknown>)[field] : customFields[field];
            if (value === null || value === undefined || value === '') violations.push(`Zorunlu alan eksik: ${field}`);
        }
        if (violations.length > 0) throw new AppError(`Tamamlama kuralları sağlanmadı: ${violations.join(' | ')}`, 400);
    }
}
