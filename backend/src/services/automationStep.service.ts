import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import { ProjectAccess } from '../utils/projectAccess';
import { AutomationActionType, buildStepUsageMap, mapTestStepToAutomationStep } from './automationStorage.service';

interface CreateAutomationStepDTO {
    name: string;
    description?: string;
    locator?: string;
    actionType: AutomationActionType;
    data?: string;
    pageObject?: string;
    projectId: string;
}

interface UpdateAutomationStepDTO {
    name?: string;
    description?: string;
    locator?: string;
    actionType?: AutomationActionType;
    data?: string;
    pageObject?: string;
}

export class AutomationStepService {
    private async getStepOrFail(id: string) {
        const step = await prisma.testStep.findFirst({
            where: {
                id,
                type: 'WEB',
                deletedAt: null,
            },
        });

        if (!step) {
            throw new AppError('Automation step not found', 404);
        }

        return step;
    }

    async create(dto: CreateAutomationStepDTO, userId: string, role: string) {
        await ProjectAccess.check(dto.projectId, userId, role);

        const project = await prisma.project.findUnique({
            where: { id: dto.projectId },
            select: { id: true },
        });

        if (!project) {
            throw new AppError('Project not found', 404);
        }

        const step = await prisma.testStep.create({
            data: {
                projectId: dto.projectId,
                name: dto.name,
                action: dto.name,
                expectedResult: dto.description || null,
                type: 'WEB',
                actionType: dto.actionType,
                locator: dto.locator || '',
                data: dto.data || '',
                pageObject: dto.pageObject?.trim() || null,
            },
        });

        return mapTestStepToAutomationStep(step, 0);
    }

    async findById(id: string, userId: string, role: string) {
        const step = await this.getStepOrFail(id);
        await ProjectAccess.check(step.projectId, userId, role);

        const usageMap = await buildStepUsageMap(step.projectId);
        return mapTestStepToAutomationStep(step, usageMap[step.id] || 0);
    }

    async findByProject(projectId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        const steps = await prisma.testStep.findMany({
            where: {
                projectId,
                type: 'WEB',
                deletedAt: null,
            },
            orderBy: { createdAt: 'desc' },
        });

        const usageMap = await buildStepUsageMap(projectId);
        return steps.map((step) => mapTestStepToAutomationStep(step, usageMap[step.id] || 0));
    }

    async update(id: string, dto: UpdateAutomationStepDTO, userId: string, role: string) {
        const step = await this.getStepOrFail(id);
        await ProjectAccess.check(step.projectId, userId, role);

        const updateData: Prisma.TestStepUpdateInput = {};
        if (dto.name !== undefined) {
            updateData.name = dto.name;
            updateData.action = dto.name;
        }
        if (dto.description !== undefined) {
            updateData.expectedResult = dto.description;
        }
        if (dto.locator !== undefined) {
            updateData.locator = dto.locator;
        }
        if (dto.actionType !== undefined) {
            updateData.actionType = dto.actionType;
        }
        if (dto.data !== undefined) {
            updateData.data = dto.data;
        }
        if (dto.pageObject !== undefined) {
            updateData.pageObject = dto.pageObject?.trim() || null;
        }

        const updated = await prisma.testStep.update({
            where: { id },
            data: updateData,
        });

        const usageMap = await buildStepUsageMap(step.projectId);
        return mapTestStepToAutomationStep(updated, usageMap[updated.id] || 0);
    }

    async archive(id: string, userId: string, role: string) {
        const step = await prisma.testStep.findUnique({ where: { id } });
        if (!step) throw new AppError('Step not found', 404);
        await ProjectAccess.check(step.projectId, userId, role);

        const usageMap = await buildStepUsageMap(step.projectId);
        const usageCount = usageMap[step.id] || 0;
        if (usageCount > 0) {
            throw new AppError(
                `Cannot archive step. It is used in ${usageCount} scenario(s). Remove it from scenarios first.`,
                400
            );
        }

        await prisma.testStep.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    async restore(id: string, userId: string, role: string) {
        const step = await prisma.testStep.findUnique({ where: { id } });
        if (!step) throw new AppError('Step not found', 404);
        await ProjectAccess.check(step.projectId, userId, role);

        await prisma.testStep.update({
            where: { id },
            data: { deletedAt: null },
        });
    }

    async hardDelete(id: string, userId: string, role: string) {
        const step = await prisma.testStep.findUnique({ where: { id } });
        if (!step) throw new AppError('Step not found', 404);
        await ProjectAccess.check(step.projectId, userId, role);

        const usageMap = await buildStepUsageMap(step.projectId);
        const usageCount = usageMap[step.id] || 0;
        if (usageCount > 0) {
            throw new AppError(
                `Cannot delete step. It is used in ${usageCount} scenario(s). Remove it from scenarios first.`,
                400
            );
        }

        await prisma.testStep.delete({
            where: { id },
        });
    }

    async delete(id: string, userId: string, role: string) {
        return this.archive(id, userId, role);
    }
}

export const automationStepService = new AutomationStepService();
