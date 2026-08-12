import crypto from 'crypto';
import { Request, Response } from 'express';
import { gitWebhookService } from '../services/gitWebhook.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('GitWebhookController');

const verifyGithubSignature = (rawBody: Buffer, secret: string, signatureHeader?: string): boolean => {
    if (!signatureHeader) {
        return false;
    }

    const expectedSignature = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;

    try {
        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'utf8'),
            Buffer.from(signatureHeader, 'utf8'),
        );
    } catch {
        return false;
    }
};

export const handleGithubWebhook = async (req: Request, res: Response) => {
    try {
        const projectId = req.query.projectId as string;
        if (!projectId) {
            return res.status(400).json({ success: false, message: 'projectId query parameter is required' });
        }

        const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
        if (!webhookSecret) {
            logger.error('GitHub webhook secret is not configured');
            return res.status(503).json({ success: false, message: 'GitHub webhook secret is not configured' });
        }

        const signatureHeader = req.headers['x-hub-signature-256'];
        const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
        const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

        if (!rawBody) {
            return res.status(400).json({ success: false, message: 'Webhook payload could not be verified' });
        }

        if (!verifyGithubSignature(rawBody, webhookSecret, signature)) {
            return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
        }

        const eventType = req.headers['x-github-event'] as string;
        const payload = req.body;

        if (eventType === 'push') {
            await gitWebhookService.handlePush(projectId, payload);
        } else if (eventType === 'pull_request') {
            await gitWebhookService.handlePullRequest(projectId, payload);
        }

        res.status(200).json({ success: true, message: 'Webhook processed' });
    } catch (error) {
        logger.error('Error handling GitHub webhook:', error);
        res.status(500).json({ success: false, message: 'Internal server error processing webhook' });
    }
};
