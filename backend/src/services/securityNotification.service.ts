import { createLogger } from '../utils/logger';

const logger = createLogger('SecurityNotification');

export async function sendSecurityEmail(to: string, template: string, variables: Record<string, string>) {
    const endpoint = process.env.EMAIL_WEBHOOK_URL;
    const apiKey = process.env.EMAIL_WEBHOOK_API_KEY;
    if (!endpoint) {
        if (process.env.NODE_ENV === 'production') throw new Error('EMAIL_WEBHOOK_URL is required');
        logger.warn(`Email delivery skipped for ${template} to ${to}`);
        return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
            body: JSON.stringify({ to, template, variables }),
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
}
