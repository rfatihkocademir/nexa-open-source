import { Router } from 'express';
import { storageController } from '../controllers/storage.controller';
import { protect, protectAssetAccess } from '../middlewares/auth.middleware';
import { upload } from '../services/storage.service';

const router = Router();

router.get('/attachments/:id', protectAssetAccess, storageController.serveAttachment);

router.use(protect);

// Upload
router.post('/upload', upload.single('file'), storageController.uploadFile);

// Delete
router.delete('/attachments/:id', storageController.deleteFile);

// List by entity
router.get('/work-items/:workItemId/attachments', storageController.getByWorkItem);
router.get('/comments/:commentId/attachments', storageController.getByComment);
router.get('/test-results/:testResultId/attachments', storageController.getByTestResult);
router.get('/test-cases/:testCaseId/attachments', storageController.getByTestCase);
router.get('/wiki-pages/:wikiPageId/attachments', storageController.getByWikiPage);

export default router;
