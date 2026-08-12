import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { PortfolioController } from '../controllers/portfolio.controller';

const router = Router();
router.use(protect);
router.get('/', PortfolioController.list);
router.post('/', PortfolioController.create);
router.get('/:id', PortfolioController.dashboard);
router.patch('/:id', PortfolioController.update);
router.post('/:id/programs', PortfolioController.createProgram);
router.post('/:id/projects', PortfolioController.linkProject);
router.post('/:id/initiatives', PortfolioController.createInitiative);
router.patch('/:id/initiatives/:initiativeId', PortfolioController.updateInitiative);
router.post('/:id/dependencies', PortfolioController.addDependency);
router.post('/:id/scenario', PortfolioController.scenario);
export default router;
