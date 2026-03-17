/**
 * Reports Routes
 */

import express from 'express';
import { askAssistant, getAnalytics } from '../controllers/reportController.js';

const router = express.Router();

// Read-only analytics endpoints for dashboard/reporting.
router.get('/analytics', getAnalytics);
router.post('/assistant', askAssistant);

export default router;
