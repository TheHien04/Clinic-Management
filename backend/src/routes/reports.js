/**
 * Reports Routes
 */

import express from 'express';
import { askAssistant, getAnalytics } from '../controllers/reportController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorize('admin', 'manager', 'supervisor', 'doctor'));

// Read-only analytics endpoints for dashboard/reporting.
router.get('/analytics', getAnalytics);
router.post('/assistant', askAssistant);

export default router;
