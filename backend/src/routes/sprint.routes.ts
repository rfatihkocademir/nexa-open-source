import { Router } from 'express';
import { SprintController } from '../controllers/sprint.controller';
import { SprintPlanningController } from '../controllers/sprint-planning.controller';
import { protect } from '../middlewares/auth.middleware';
import { projectRoute, projectResolvers } from '../middlewares/rbac.middleware';

const router = Router();

router.use(protect);

router.post('/', ...projectRoute('sprint.create', projectResolvers.projectId(['body', 'projectId']), SprintController.create));
router.get('/', ...projectRoute('sprint.read', projectResolvers.projectId(['query', 'projectId']), SprintController.getAll));
router.get('/:id', ...projectRoute('sprint.read', projectResolvers.sprintId('params', 'id'), SprintController.getById));
router.get('/:id/planning-report', ...projectRoute('sprint.read', projectResolvers.sprintId('params', 'id'), SprintPlanningController.report));
router.put('/:id/planning-capacity/:userId', ...projectRoute('sprint.manage', projectResolvers.sprintId('params', 'id'), SprintPlanningController.saveMemberCapacity));
router.post('/:id/planning-exceptions', ...projectRoute('sprint.manage', projectResolvers.sprintId('params', 'id'), SprintPlanningController.addException));
router.post('/:id/planning-holidays', ...projectRoute('sprint.manage', projectResolvers.sprintId('params', 'id'), SprintPlanningController.addHoliday));
router.delete('/:id/planning-exceptions/:exceptionId', ...projectRoute('sprint.manage', projectResolvers.sprintId('params', 'id'), SprintPlanningController.deleteException));
router.delete('/:id/planning-holidays/:holidayId', ...projectRoute('sprint.manage', projectResolvers.sprintId('params', 'id'), SprintPlanningController.deleteHoliday));
router.put('/:id/planning-estimates/:workItemId', ...projectRoute('sprint.manage', projectResolvers.sprintId('params', 'id'), SprintPlanningController.saveEstimate));
router.post('/:id/planning-dependencies', ...projectRoute('sprint.manage', projectResolvers.sprintId('params', 'id'), SprintPlanningController.addDependency));
router.delete('/:id/planning-dependencies/:dependencyId', ...projectRoute('sprint.manage', projectResolvers.sprintId('params', 'id'), SprintPlanningController.deleteDependency));
router.post('/:id/planning-sessions', ...projectRoute('sprint.manage', projectResolvers.sprintId('params', 'id'), SprintPlanningController.createSession));
router.patch('/:id/planning-sessions/:sessionId', ...projectRoute('sprint.manage', projectResolvers.sprintId('params', 'id'), SprintPlanningController.transitionSession));
router.post('/:id/start', ...projectRoute('sprint.manage', projectResolvers.sprintId('params', 'id'), SprintController.start));
router.post('/:id/complete', ...projectRoute('sprint.manage', projectResolvers.sprintId('params', 'id'), SprintController.complete));
router.patch('/:id', ...projectRoute('sprint.update', projectResolvers.sprintId('params', 'id'), SprintController.update));
router.delete('/:id', ...projectRoute('sprint.manage', projectResolvers.sprintId('params', 'id'), SprintController.delete));

export default router;
