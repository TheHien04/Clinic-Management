import express from 'express';
import { getBioinformaticsAtlas } from '../controllers/bioinformaticsController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';
import { cache } from '../middleware/cacheMiddleware.js';
import { clinicalAudit } from '../middleware/clinicalAudit.js';

const router = express.Router();

router.use(authMiddleware);
router.use(clinicalAudit('research'));
router.get('/atlas', authorize('admin', 'manager', 'supervisor', 'doctor', 'nurse'), cache(60), getBioinformaticsAtlas);

export default router;
