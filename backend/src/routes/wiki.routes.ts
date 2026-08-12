import { Router } from 'express';
import { WikiController } from '../controllers/wiki.controller';
import { protectedProjectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router({ mergeParams: true });
const wikiController = new WikiController();

// Space Routes (Project Level)
router.get(
    '/projects/:projectId/wiki/spaces',
    ...protectedProjectRoute('wiki.read', projectResolvers.projectId(['params', 'projectId']), wikiController.getSpaces)
);
router.post(
    '/projects/:projectId/wiki/spaces',
    ...protectedProjectRoute('wiki.create', projectResolvers.projectId(['params', 'projectId']), wikiController.createSpace)
);
router.delete(
    '/projects/:projectId/wiki/spaces/:spaceId',
    ...protectedProjectRoute('wiki.update', projectResolvers.projectId(['params', 'projectId']), wikiController.deleteSpace)
);

// Page Routes
router.get(
    '/wiki/spaces/:spaceId/tree',
    ...protectedProjectRoute('wiki.read', projectResolvers.wikiSpaceId('params', 'spaceId'), wikiController.getPageTree)
);
router.post(
    '/wiki/pages',
    ...protectedProjectRoute('wiki.create', projectResolvers.wikiSpaceId('body', 'spaceId'), wikiController.createPage)
);
router.get(
    '/wiki/pages/:pageId',
    ...protectedProjectRoute('wiki.read', projectResolvers.wikiPageId('params', 'pageId'), wikiController.getPage)
);
router.put(
    '/wiki/pages/:pageId',
    ...protectedProjectRoute('wiki.update', projectResolvers.wikiPageId('params', 'pageId'), wikiController.updatePage)
);
router.patch(
    '/wiki/pages/:pageId/status',
    ...protectedProjectRoute('wiki.update', projectResolvers.wikiPageId('params', 'pageId'), wikiController.updateStatus)
);
router.delete(
    '/wiki/pages/:pageId',
    ...protectedProjectRoute('wiki.update', projectResolvers.wikiPageId('params', 'pageId'), wikiController.deletePage)
);

// Restore Routes
router.patch(
    '/projects/:projectId/wiki/spaces/:spaceId/restore',
    ...protectedProjectRoute('wiki.update', projectResolvers.projectId(['params', 'projectId']), wikiController.restoreSpace)
);
router.patch(
    '/wiki/pages/:pageId/restore',
    ...protectedProjectRoute('wiki.update', projectResolvers.wikiPageId('params', 'pageId'), wikiController.restorePage)
);

export default router;
