import prisma from '../utils/prisma';
import axios from 'axios';
import { createLogger } from '../utils/logger';
import { decryptJson } from '../utils/crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
// Using any since @prisma/client might not be fully updated in typescript server instance
type WebhookEvent = any;
type Webhook = any;
type Integration = any;

const logger = createLogger('WebhookService');

export class WebhookService {

    /**
     * Trigger a webhook event for a specific project/organization
     */
    async trigger(projectId: string, event: WebhookEvent, payload: any) {
        // Find all active webhooks for this project that listen to this event
        const integrations = await (prisma as any).integration.findMany({
            where: {
                projectId,
                isActive: true,
                webhooks: {
                    some: {
                        event,
                        isActive: true
                    }
                }
            },
            include: {
                webhooks: {
                    where: { event, isActive: true }
                }
            }
        });

        if (integrations.length === 0) return;

        logger.info(`Found ${integrations.length} integrations for event ${event}`);

        // Process them asynchronously without blocking caller
        Promise.all(integrations.map(async (integration: any) => {
            const webhook = integration.webhooks[0]; // Assuming 1 webhook per event per integration
            if (!webhook) return;

            await this.dispatch(integration, webhook, payload);
        })).catch(err => {
            logger.error('Error processing webhooks:', err);
        });
    }

    private async dispatch(integration: Integration, webhook: Webhook, payload: any) {
        const config = decryptJson<any>(integration.config);
        const targetUrl = config.url;

        if (!targetUrl) {
            logger.warn(`Integration ${integration.id} missing target URL`);
            return;
        }
        await this.assertSafeTarget(targetUrl);

        // Prepare format based on type
        let formattedPayload = payload;

        switch (integration.type) {
            case 'SLACK':
                formattedPayload = this.formatForSlack(webhook.event, payload);
                break;
            case 'JIRA':
                formattedPayload = this.formatForJira(webhook.event, payload);
                break;
            case 'DISCORD':
                formattedPayload = this.formatForDiscord(webhook.event, payload);
                break;
            default:
                // Custom webhooks might use the template mapping if defined
                if (webhook.payloadTemplate) {
                    // Logic to map using template would go here
                    // e.g. mapping fields using lodash or JSONPath
                }
                break;
        }

        let isSuccess = false;
        let responseCode = null;
        let responseBody = null;

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'Nexa-Webhook-Client/1.0'
            };

            if (config.secret) {
                headers['X-Webhook-Secret'] = config.secret;
            }

            const response = await axios.post(targetUrl, formattedPayload, {
                headers,
                timeout: 5000,
                maxRedirects: 0,
            });

            isSuccess = response.status >= 200 && response.status < 300;
            responseCode = response.status;
            responseBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

        } catch (error: any) {
            isSuccess = false;
            if (error.response) {
                responseCode = error.response.status;
                responseBody = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
            } else {
                responseBody = error.message;
            }
        } finally {
            // Log the result
            await (prisma as any).webhookLog.create({
                data: {
                    webhookId: webhook.id,
                    requestBody: formattedPayload,
                    responseCode,
                    responseBody,
                    isSuccess
                }
            }).catch((e: any) => logger.error('Failed to save log:', e));
        }
    }

    private async assertSafeTarget(rawUrl: string) {
        let url: URL;
        try { url = new URL(rawUrl); } catch { throw new Error('Webhook target URL is invalid'); }
        if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('Production webhooks require HTTPS');
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported webhook protocol');
        if (url.username || url.password) throw new Error('Webhook target URL cannot contain credentials');
        const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
        const allowlist = (process.env.WEBHOOK_ALLOWED_DOMAINS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
        if (allowlist.length && !allowlist.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) throw new Error('Webhook target is not allowlisted');
        const addresses = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true });
        const isForbiddenAddress = (rawAddress: string) => {
            const address = rawAddress.replace(/^\[|\]$/g, '').toLowerCase();
            const mappedIpv4 = address.startsWith('::ffff:') ? address.slice(7) : address;
            if (net.isIP(mappedIpv4) === 4) {
                const octets = mappedIpv4.split('.').map(Number);
                return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 ||
                    octets[0] === 169 && octets[1] === 254 ||
                    octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 ||
                    octets[0] === 192 && octets[1] === 168 ||
                    octets[0] === 198 && octets[1] >= 18 && octets[1] <= 19 ||
                    octets[0] >= 224;
            }
            return address === '::' || address === '::1' || address.startsWith('fc') || address.startsWith('fd') ||
                address.startsWith('fe80:') || address.startsWith('ff');
        };
        if (addresses.some(({ address }) => isForbiddenAddress(address))) throw new Error('Private network webhook targets are forbidden');
    }

    private formatForSlack(event: WebhookEvent, payload: any) {
        return {
            text: `*Nexa Alert*: ${event}`,
            blocks: [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Event:* ${event}\n\`\`\`${JSON.stringify(payload, null, 2)}\`\`\``
                    }
                }
            ]
        };
    }

    private formatForJira(event: WebhookEvent, payload: any) {
        // In a real scenario, creates an Issue format depending on payload
        return {
            fields: {
                project: { key: payload.jiraProjectKey || "TEST" },
                summary: `[Nexa] ${event} - ${payload.title || 'Notification'}`,
                description: JSON.stringify(payload),
                issuetype: { name: "Bug" }
            }
        };
    }

    private formatForDiscord(event: WebhookEvent, payload: any) {
        return {
            content: `**Nexa Alert: ${event}**\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``
        };
    }
}

export const webhookService = new WebhookService();
