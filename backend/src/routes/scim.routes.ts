import { Router } from 'express';
import { protectScim } from '../middlewares/scim.middleware';
import { scimController } from '../controllers/scim.controller';

const router = Router();
router.use(protectScim);
router.get('/Users', scimController.list);
router.post('/Users', scimController.create);
router.get('/Users/:id', scimController.get);
router.patch('/Users/:id', scimController.patch);
router.delete('/Users/:id', scimController.remove);
router.get('/ServiceProviderConfig', (_req, res) => res.json({ schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'], patch: { supported: true }, bulk: { supported: false }, filter: { supported: true, maxResults: 100 } }));
export default router;
