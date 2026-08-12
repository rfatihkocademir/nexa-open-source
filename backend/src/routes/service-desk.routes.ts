import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import { ServiceDeskController } from '../controllers/service-desk.controller';

const router = Router();
const controller = new ServiceDeskController();

// Service Ticket routes
router.post('/tickets', protect, (req, res) => controller.createTicket(req, res));
router.get('/tickets', protect, (req, res) => controller.listTickets(req, res));
router.get('/tickets/:id', protect, (req, res) => controller.getTicket(req, res));
router.patch('/tickets/:id', protect, (req, res) => controller.updateTicket(req, res));
router.post('/tickets/:id/comments', protect, (req, res) => controller.addComment(req, res));
router.post('/tickets/:id/convert', protect, (req, res) => controller.convertToWorkItem(req, res));
router.post('/tickets/:id/rate', protect, (req, res) => controller.rateTicket(req, res));

// Service Desk Analytics
router.get('/analytics', protect, (req, res) => controller.getAnalytics(req, res));

// SLA Policy routes
router.post('/sla-policies', protect, (req, res) => controller.createSlaPolicy(req, res));
router.get('/sla-policies', protect, (req, res) => controller.listSlaPolicies(req, res));

export default router;
