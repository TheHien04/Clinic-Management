import express from 'express';
import { getAllClinics, getClinicById, createClinic, updateClinic, deleteClinic } from '../controllers/clinicController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAllClinics);
router.get('/:id', getClinicById);
router.post('/', authorize('admin', 'manager'), createClinic);
router.put('/:id', authorize('admin', 'manager'), updateClinic);
router.delete('/:id', authorize('admin'), deleteClinic);

export default router;
