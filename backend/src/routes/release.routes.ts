import { Router, type RequestHandler } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { authorizeProjectPermission, projectRoute, projectResolvers } from '../middlewares/rbac.middleware';
import { releaseController } from '../controllers/release.controller';
import { validate } from '../middlewares/validate.middleware';
import { createDecisionRecordSchema, createReleaseCandidateSchema, createReleaseFollowUpSchema, releaseCandidateIdSchema } from '../validations/release.validation';
import { AppError } from '../utils/AppError';
import { releaseConsensusController } from '../controllers/release-consensus.controller';

const router = Router({ mergeParams: true });

const decisionPermissionMap: Record<string, string> = {
    SCOPE: 'release.decide-scope',
    DELIVERY: 'release.decide-delivery',
    QUALITY: 'release.decide-quality',
    RELEASE: 'release.finalize',
    RISK: 'release.decide-risk',
};

const authorizeReleaseDecision: RequestHandler = (req, res, next) => {
    const decisionType = typeof req.body?.type === 'string' ? req.body.type : '';
    const requiredPermission = decisionPermissionMap[decisionType];

    if (!requiredPermission) {
        return next(new AppError('Invalid release decision type', 400));
    }

    return authorizeProjectPermission(
        requiredPermission,
        projectResolvers.projectId(['params', 'projectId']),
    )(req, res, next);
};

router.use(protect);

router.get(
    '/',
    ...projectRoute('release.read', projectResolvers.projectId(['params', 'projectId']), releaseController.listByProject)
);

router.post(
    '/',
    ...projectRoute('release.create', projectResolvers.projectId(['params', 'projectId']), validate(createReleaseCandidateSchema), releaseController.create)
);

router.patch(
    '/quality-tier',
    ...projectRoute('project.manage', projectResolvers.projectId(['params', 'projectId']), releaseConsensusController.updateTier)
);

router.get(
    '/:id',
    ...projectRoute('release.read', projectResolvers.projectId(['params', 'projectId']), validate(releaseCandidateIdSchema), releaseController.getById)
);

router.get(
    '/:id/governance',
    ...projectRoute('release.read', projectResolvers.projectId(['params', 'projectId']), releaseConsensusController.getState)
);

router.post(
    '/:id/approval-rounds',
    ...projectRoute('release.finalize', projectResolvers.projectId(['params', 'projectId']), releaseConsensusController.startRound)
);

router.put(
    '/:id/approval-rounds/:roundId/decision',
    ...projectRoute('release.read', projectResolvers.projectId(['params', 'projectId']), releaseConsensusController.decide)
);

router.post(
    '/:id/deploy-packages',
    ...projectRoute('release.finalize', projectResolvers.projectId(['params', 'projectId']), releaseConsensusController.createPackage)
);

router.get(
    '/:id/ai-summary',
    ...projectRoute('release.read', projectResolvers.projectId(['params', 'projectId']), validate(releaseCandidateIdSchema), releaseController.getAISummary)
);

router.get(
    '/:id/eligibility',
    ...projectRoute('release.read', projectResolvers.projectId(['params', 'projectId']), validate(releaseCandidateIdSchema), releaseController.getEligibilityReport)
);

router.post(
    '/:id/decisions',
    validate(createDecisionRecordSchema),
    authorizeReleaseDecision,
    releaseController.addDecision
);

router.post(
    '/:id/follow-ups',
    ...projectRoute('backlog.create', projectResolvers.projectId(['params', 'projectId']), validate(createReleaseFollowUpSchema), releaseController.createFollowUp)
);

router.patch(
    '/:id/status',
    ...projectRoute('release.finalize', projectResolvers.projectId(['params', 'projectId']), releaseController.updateStatus)
);

export default router;
