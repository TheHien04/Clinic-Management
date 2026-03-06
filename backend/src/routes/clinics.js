import express from 'express';
import { getAllClinics, getClinicById, createClinic, updateClinic, deleteClinic } from '../controllers/clinicController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAllClinics);
router.get('/:id', getClinicById);
router.post('/', createClinic);
router.put('/:id', updateClinic);
router.delete('/:id', deleteClinic);

export default router;
