/**
 * Appointment Routes
 */

import express from 'express';
import {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment
} from '../controllers/appointmentController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.use(authorize('admin', 'manager', 'supervisor', 'doctor', 'nurse', 'receptionist'));
router.get('/', getAllAppointments);
router.get('/:id', getAppointmentById);
router.post('/', createAppointment);
router.put('/:id', updateAppointment);
router.delete('/:id', authorize('admin', 'manager', 'supervisor'), deleteAppointment);

export default router;
