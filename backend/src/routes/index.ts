import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import projectRoutes from './project.routes';
import milestoneRoutes from './milestone.routes';
import testSuiteRoutes from './testSuite.routes';
import testCaseRoutes from './testCase.routes';
import testRunRoutes from './testRun.routes';
import testResultRoutes from './testResult.routes';
import dashboardRoutes from './dashboard.routes';
import importRoutes from './import.routes';
import automationStepRoutes from './automationStep.routes';
import automationScenarioRoutes from './automationScenario.routes';
import scenarioStepRoutes from './scenarioStep.routes';
import aiRoutes from './ai.routes';
import notificationRoutes from './notification.routes';
import storageRoutes from './storage.routes';
import tagRoutes from './tag.routes';
import sprintRoutes from './sprint.routes';
import worklogRoutes from './worklog.routes';
import wikiRoutes from './wiki.routes';
import agileRoutes from './agile.routes';
import analyticsRoutes from './analytics.routes';
import commentRoutes from './comment.routes';
import businessRequestRoutes from './business-request.routes';
import environmentRoutes from './environment.routes';
import promptRoutes from './prompt.routes';
import requirementRoutes from './requirement.routes';

import workItemRoutes from './workitem.routes';
import boardColumnRoutes from './board-column.routes';
import gitWebhookRoutes from './gitWebhook.routes';
import integrationRoutes from './integration.routes';
import releaseRoutes from './release.routes';
import monitorRoutes from './monitor.routes';
import resourceRoutes from './resource.routes';
import scimRoutes from './scim.routes';
import enterpriseRoutes from './enterprise.routes';
import auditRoutes from './audit.routes';
import portfolioRoutes from './portfolio.routes';
import workItemPolicyRoutes from './work-item-policy.routes';
import savedViewRoutes from './saved-view.routes';
import workConfigurationRoutes from './work-configuration.routes';
import workAutomationRoutes from './work-automation.routes';
import workflowSchemeRoutes from './workflow-scheme.routes';
import enterpriseMigrationRoutes from './enterprise-migration.routes';
import dashboardStudioRoutes from './dashboard-studio.routes';
import actionCenterRoutes from './action-center.routes';
import serviceDeskRoutes from './service-desk.routes';
import automationCoverageRoutes from './automationCoverage.routes';
import apiAutomationRoutes from './apiAutomation.routes';
import jiraMigrationRoutes from './jiraMigration.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/milestones', milestoneRoutes);
router.use('/suites', testSuiteRoutes);
router.use('/cases', testCaseRoutes);
router.use('/runs', testRunRoutes);
router.use('/items', testResultRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/import', importRoutes);
router.use('/automation/steps', automationStepRoutes);
router.use('/automation/scenarios', automationScenarioRoutes);
router.use('/automation/scenario-steps', scenarioStepRoutes);
router.use('/ai', aiRoutes);
router.use('/notifications', notificationRoutes);
router.use('/storage', storageRoutes);

router.use('/tags', tagRoutes);
router.use('/comments', commentRoutes);
router.use('/sprints', sprintRoutes);
router.use('/worklogs', worklogRoutes);
router.use('/projects/:projectId/analytics', analyticsRoutes);
router.use('/projects/:projectId/integrations', integrationRoutes);
router.use('/projects/:projectId/releases', releaseRoutes);
router.use('/business-requests', businessRequestRoutes);
router.use('/environments', environmentRoutes);
router.use('/prompts', promptRoutes);
router.use('/requirements', requirementRoutes);
router.use('/monitor', monitorRoutes);
router.use('/resources', resourceRoutes);
router.use('/scim/v2', scimRoutes);
router.use('/enterprise', enterpriseRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/portfolios', portfolioRoutes);
router.use('/work-item-policies', workItemPolicyRoutes);
router.use('/saved-views', savedViewRoutes);
router.use('/work-configuration', workConfigurationRoutes);
router.use('/work-automations', workAutomationRoutes);
router.use('/workflow-scheme', workflowSchemeRoutes);
router.use('/enterprise-migrations', enterpriseMigrationRoutes);
router.use('/dashboard-studio', dashboardStudioRoutes);
router.use('/action-center', actionCenterRoutes);
router.use('/service-desk', serviceDeskRoutes);
router.use('/automation-coverage', automationCoverageRoutes);
router.use('/api-automation', apiAutomationRoutes);
router.use('/jira-migration', jiraMigrationRoutes);
router.use('/', wikiRoutes);
router.use('/', agileRoutes);

// Webhooks
router.use('/webhooks/git', gitWebhookRoutes);

import { WorkItemController } from '../controllers/workitem.controller';
import { protectedProjectRoute, projectResolvers } from '../middlewares/rbac.middleware';

// V2 SDLC (WorkItem Transformation) - Aliasing old routes to prevent frontend breakage
router.use('/work-items', workItemRoutes);
router.use('/board-columns', boardColumnRoutes);

router.get('/epics', ...protectedProjectRoute('backlog.read', projectResolvers.projectId(['query', 'projectId']), (req, res) => { res.locals.itemType = 'EPIC'; return WorkItemController.getAll(req, res); }));
router.post('/epics', ...protectedProjectRoute('backlog.create', projectResolvers.projectId(['body', 'projectId']), (req, res) => { res.locals.itemType = 'EPIC'; return WorkItemController.create(req, res); }));
router.get('/epics/:id', ...protectedProjectRoute('backlog.read', projectResolvers.workItemId('params', 'id'), WorkItemController.getById));
router.put('/epics/:id', ...protectedProjectRoute('backlog.update', projectResolvers.workItemId('params', 'id'), WorkItemController.update));
router.patch('/epics/:id', ...protectedProjectRoute('backlog.update', projectResolvers.workItemId('params', 'id'), WorkItemController.update));
router.delete('/epics/:id', ...protectedProjectRoute('project.manage', projectResolvers.workItemId('params', 'id'), WorkItemController.delete));

router.get('/stories', ...protectedProjectRoute('backlog.read', projectResolvers.projectId(['query', 'projectId']), (req, res) => { res.locals.itemType = 'STORY'; return WorkItemController.getAll(req, res); }));
router.post('/stories', ...protectedProjectRoute('backlog.create', projectResolvers.projectId(['body', 'projectId']), (req, res) => { res.locals.itemType = 'STORY'; return WorkItemController.create(req, res); }));
router.get('/stories/:id', ...protectedProjectRoute('backlog.read', projectResolvers.workItemId('params', 'id'), WorkItemController.getById));
router.put('/stories/:id', ...protectedProjectRoute('backlog.update', projectResolvers.workItemId('params', 'id'), WorkItemController.update));
router.patch('/stories/:id', ...protectedProjectRoute('backlog.update', projectResolvers.workItemId('params', 'id'), WorkItemController.update));
router.delete('/stories/:id', ...protectedProjectRoute('project.manage', projectResolvers.workItemId('params', 'id'), WorkItemController.delete));

router.get('/tasks', ...protectedProjectRoute('backlog.read', projectResolvers.projectId(['query', 'projectId']), (req, res) => { res.locals.itemType = 'TASK'; return WorkItemController.getAll(req, res); }));
router.post('/tasks', ...protectedProjectRoute('backlog.create', projectResolvers.projectId(['body', 'projectId']), (req, res) => { res.locals.itemType = 'TASK'; return WorkItemController.create(req, res); }));
router.get('/tasks/:id', ...protectedProjectRoute('backlog.read', projectResolvers.workItemId('params', 'id'), WorkItemController.getById));
router.put('/tasks/:id', ...protectedProjectRoute('backlog.update', projectResolvers.workItemId('params', 'id'), WorkItemController.update));
router.patch('/tasks/:id', ...protectedProjectRoute('backlog.update', projectResolvers.workItemId('params', 'id'), WorkItemController.update));
router.delete('/tasks/:id', ...protectedProjectRoute('project.manage', projectResolvers.workItemId('params', 'id'), WorkItemController.delete));

router.get('/bugs', ...protectedProjectRoute('backlog.read', projectResolvers.projectId(['query', 'projectId']), (req, res) => { res.locals.itemType = 'BUG'; return WorkItemController.getAll(req, res); }));
router.post('/bugs', ...protectedProjectRoute('backlog.create', projectResolvers.projectId(['body', 'projectId']), (req, res) => { res.locals.itemType = 'BUG'; return WorkItemController.create(req, res); }));
router.get('/bugs/:id', ...protectedProjectRoute('backlog.read', projectResolvers.workItemId('params', 'id'), WorkItemController.getById));
router.put('/bugs/:id', ...protectedProjectRoute('backlog.update', projectResolvers.workItemId('params', 'id'), WorkItemController.update));
router.patch('/bugs/:id', ...protectedProjectRoute('backlog.update', projectResolvers.workItemId('params', 'id'), WorkItemController.update));
router.delete('/bugs/:id', ...protectedProjectRoute('project.manage', projectResolvers.workItemId('params', 'id'), WorkItemController.delete));

export default router;
