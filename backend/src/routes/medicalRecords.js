import express from 'express';
import {
  getMedicalRecords,
  getMedicalRecordById,
  getMedicalRecordsByPatient,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord
} from '../controllers/medicalRecordController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';
import { clinicalAudit } from '../middleware/clinicalAudit.js';

const router = express.Router();

// All routes are protected
router.use(authMiddleware);
router.use(authorize('admin', 'manager', 'supervisor', 'doctor', 'nurse'));
router.use(clinicalAudit('treatment'));

// @route   GET /api/medical-records
// @desc    Get all medical records with filtering & pagination
// @access  Private
router.get('/', getMedicalRecords);

// @route   GET /api/medical-records/patient/:patientId
// @desc    Get medical records by patient ID
// @access  Private
router.get('/patient/:patientId', getMedicalRecordsByPatient);

// @route   GET /api/medical-records/:id
// @desc    Get medical record by ID
// @access  Private
router.get('/:id', getMedicalRecordById);

// @route   POST /api/medical-records
// @desc    Create new medical record
// @access  Private
router.post('/', createMedicalRecord);

// @route   PUT /api/medical-records/:id
// @desc    Update medical record
// @access  Private
router.put('/:id', updateMedicalRecord);

// @route   DELETE /api/medical-records/:id
// @desc    Delete medical record
// @access  Private
router.delete('/:id', authorize('admin', 'manager', 'doctor'), deleteMedicalRecord);

export default router;
