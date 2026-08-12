import type { JsonObject, JsonValue } from './json';

export type IntegrationType = 'GITHUB' | 'GITLAB' | 'SLACK' | 'DISCORD' | 'JIRA' | 'CUSTOM_WEBHOOK';

export interface IntegrationConfig extends JsonObject {
    url?: string;
    secret?: string;
    email?: string;
    apiToken?: string;
    projectKey?: string;
    xrayClientId?: string;
    xrayClientSecret?: string;
}

export interface Webhook {
    id: string;
    integrationId: string;
    event: string;
    payloadTemplate?: JsonValue;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Integration {
    id: string;
    organizationId?: string;
    projectId?: string;
    type: IntegrationType;
    name: string;
    config: IntegrationConfig;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    webhooks: Webhook[];
}

export interface CreateIntegrationDto {
    type: IntegrationType;
    name: string;
    config: IntegrationConfig;
    events: string[];
}

export interface UpdateIntegrationDto {
    name?: string;
    config?: IntegrationConfig;
    isActive?: boolean;
}
