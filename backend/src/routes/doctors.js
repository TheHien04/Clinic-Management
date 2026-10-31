/**
 * Doctor Routes
 */

import express from 'express';
import {
  getAllDoctors,
  getDoctorsIntelligence,
  applyDoctorsRebalance,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorSchedule
} from '../controllers/doctorController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';
import { cache } from '../middleware/cacheMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', cache(300), getAllDoctors);
router.get('/intelligence', authorize('admin', 'manager', 'supervisor', 'doctor', 'nurse'), getDoctorsIntelligence);
router.post('/rebalance/apply', authorize('admin', 'manager', 'supervisor'), applyDoctorsRebalance);
router.get('/:id', getDoctorById);
router.get('/:id/schedule', getDoctorSchedule);
router.post('/', authorize('admin', 'manager'), createDoctor);
router.put('/:id', authorize('admin', 'manager'), updateDoctor);
router.delete('/:id', authorize('admin'), deleteDoctor);

export default router;
