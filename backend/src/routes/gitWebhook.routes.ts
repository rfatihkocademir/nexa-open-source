import { Router } from 'express';
import { handleGithubWebhook } from '../controllers/gitWebhook.controller';

const router = Router();

// /api/webhooks/git/github?projectId=xxxx
router.post('/github', handleGithubWebhook);

export default router;
