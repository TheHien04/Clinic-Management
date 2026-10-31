/**
 * Patient Routes
 */

import express from 'express';
import {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientHistory,
  getPatientIntelligence,
} from '../controllers/patientController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';
import { cache } from '../middleware/cacheMiddleware.js';
import { clinicalAudit } from '../middleware/clinicalAudit.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);
router.use(clinicalAudit('healthcare-operations'));

router.get('/', authorize('admin', 'manager', 'supervisor', 'doctor', 'nurse', 'receptionist'), cache(120), getAllPatients);
router.get('/intelligence/overview', authorize('admin', 'manager', 'supervisor', 'doctor', 'nurse'), cache(60), getPatientIntelligence);
router.get('/:id', authorize('admin', 'manager', 'supervisor', 'doctor', 'nurse', 'receptionist'), getPatientById);
router.get('/:id/history', authorize('admin', 'manager', 'supervisor', 'doctor', 'nurse'), getPatientHistory);
router.post('/', authorize('admin', 'manager', 'supervisor', 'doctor', 'nurse', 'receptionist'), createPatient);
router.put('/:id', authorize('admin', 'manager', 'supervisor', 'doctor', 'nurse', 'receptionist'), updatePatient);
router.delete('/:id', authorize('admin', 'manager'), deletePatient);

export default router;
