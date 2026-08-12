import prisma from '../utils/prisma';
import { IntegrationType } from '@prisma/client';
import { ProjectAccess } from '../utils/projectAccess';
import { decryptJson, encryptJson, maskSecrets } from '../utils/crypto';
import { AppError } from '../utils/AppError';
import { jiraClientService, type JiraConnectionConfig } from './jira-client.service';
import { xrayClientService, type XrayConnectionConfig } from './xray-client.service';

export class IntegrationService {

    // Get all integrations for a project
    async getIntegrations(projectId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        const integrations = await prisma.integration.findMany({
            where: { projectId },
            include: {
                webhooks: true
            },
            orderBy: { createdAt: 'desc' }
        });
        return integrations.map((integration) => ({
            ...integration,
            config: maskSecrets(decryptJson<Record<string, unknown>>(integration.config)),
        }));
    }

    // Create a new integration
    async createIntegration(projectId: string, data: { type: IntegrationType, name: string, config: any, events: any[] }, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);
        const { type, name, config, events } = data;
        if (!name?.trim()) throw new AppError('Integration name is required', 400);
        if (type === 'JIRA') {
            this.assertJiraConfig(config);
            await jiraClientService.validateConfig(config);
            if (config.xrayClientId || config.xrayClientSecret) xrayClientService.validateConfig(config);
        }

        const integration = await prisma.integration.create({
            data: {
                projectId,
                type,
                name,
                config: encryptJson(config),
                webhooks: {
                    create: (events || []).map((event: any) => ({
                        event,
                        isActive: true
                    }))
                }
            },
            include: {
                webhooks: true
            }
        });
        return { ...integration, config: maskSecrets(config) };
    }

    // Update an integration 
    async updateIntegration(id: string, projectId: string, data: { name?: string, config?: any, isActive?: boolean }, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        // Ensure the integration exists and belongs to the project
        const existing = await prisma.integration.findFirst({
            where: { id, projectId }
        });

        if (!existing) {
            throw new AppError(`Integration with ID ${id} not found in this project`, 404);
        }

        const currentConfig = decryptJson<Record<string, unknown>>(existing.config);
        const submittedConfig = data.config ? Object.fromEntries(Object.entries(data.config).filter(([, value]) => value !== '********')) : undefined;
        const mergedConfig = submittedConfig ? { ...currentConfig, ...submittedConfig } : undefined;
        if (existing.type === 'JIRA' && mergedConfig) {
            this.assertJiraConfig(mergedConfig);
            await jiraClientService.validateConfig(mergedConfig);
            if (mergedConfig.xrayClientId || mergedConfig.xrayClientSecret) xrayClientService.validateConfig(mergedConfig);
        }
        const updateData = {
            ...data,
            ...(mergedConfig ? { config: encryptJson(mergedConfig) } : {}),
        };
        const integration = await prisma.integration.update({
            where: { id },
            data: updateData,
            include: {
                webhooks: true
            }
        });
        return { ...integration, config: maskSecrets(mergedConfig || currentConfig) };
    }

    // Delete an integration
    async archive(id: string, projectId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        const existing = await prisma.integration.findFirst({
            where: { id, projectId }
        });

        if (!existing) {
            throw new AppError(`Integration with ID ${id} not found in this project`, 404);
        }

        return await prisma.integration.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
    }

    async delete(id: string, projectId: string, userId: string, role: string) {
        return this.archive(id, projectId, userId, role);
    }

    async deleteIntegration(id: string, projectId: string, userId: string, role: string) {
        return this.archive(id, projectId, userId, role);
    }

    async hardDelete(id: string, projectId: string, userId: string, role: string) {
        await ProjectAccess.check(projectId, userId, role);

        const existing = await prisma.integration.findFirst({
            where: { id, projectId }
        });

        if (!existing) {
            throw new AppError(`Integration with ID ${id} not found in this project`, 404);
        }

        return await prisma.integration.delete({
            where: { id }
        });
    }

    async getJiraConfig(id: string, projectId: string): Promise<JiraConnectionConfig> {
        const integration = await prisma.integration.findFirst({ where: { id, projectId, type: 'JIRA', isActive: true, deletedAt: null } });
        if (!integration) throw new AppError('Aktif Jira entegrasyonu bulunamadı.', 404);
        const config = decryptJson<JiraConnectionConfig>(integration.config);
        this.assertJiraConfig(config);
        return config;
    }

    async getXrayConfig(id: string, projectId: string): Promise<XrayConnectionConfig> {
        const config = await this.getJiraConfig(id, projectId) as JiraConnectionConfig & Partial<XrayConnectionConfig>;
        xrayClientService.validateConfig(config);
        return { xrayClientId: config.xrayClientId!, xrayClientSecret: config.xrayClientSecret! };
    }

    private assertJiraConfig(config: unknown): asserts config is JiraConnectionConfig {
        if (!config || typeof config !== 'object') throw new AppError('Jira configuration is required', 400);
        const value = config as Record<string, unknown>;
        for (const field of ['url', 'email', 'apiToken']) {
            if (typeof value[field] !== 'string' || !String(value[field]).trim()) throw new AppError(`Jira ${field} is required`, 400);
        }
    }
}

export const integrationService = new IntegrationService();
