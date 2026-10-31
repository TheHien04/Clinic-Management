import express from 'express';
import { authMiddleware, authorize } from '../middleware/auth.js';
import { getMyPatientPortal } from '../controllers/patientPortalController.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/me', authorize('patient', 'user'), getMyPatientPortal);

export default router;
