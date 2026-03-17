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
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', getAllDoctors);
router.get('/intelligence', getDoctorsIntelligence);
router.post('/rebalance/apply', applyDoctorsRebalance);
router.get('/:id', getDoctorById);
router.get('/:id/schedule', getDoctorSchedule);
router.post('/', createDoctor);
router.put('/:id', updateDoctor);
router.delete('/:id', deleteDoctor);

export default router;
