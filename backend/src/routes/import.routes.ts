import { Router } from 'express';
import multer from 'multer';
import { importController } from '../controllers/import.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
        cb(null, allowed.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.xlsx'));
    },
});

router.use(protect);

router.post(
    '/excel',
    upload.single('file'),
    importController.importTestCases
);

export default router;
