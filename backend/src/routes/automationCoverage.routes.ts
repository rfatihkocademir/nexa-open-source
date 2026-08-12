import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { automationCoverageController } from '../controllers/automationCoverage.controller';

const router = Router();

router.post('/convert-manual', protect, (req, res) =>
  automationCoverageController.convertManualToAutomation(req, res)
);

router.get('/coverage', protect, (req, res) =>
  automationCoverageController.getProjectCoverageMetrics(req, res)
);

export default router;
