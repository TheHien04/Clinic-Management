import express from 'express';
import { getAllSpecialties, getSpecialtyById, createSpecialty, updateSpecialty, deleteSpecialty } from '../controllers/specialtyController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAllSpecialties);
router.get('/:id', getSpecialtyById);
router.post('/', authorize('admin', 'manager'), createSpecialty);
router.put('/:id', authorize('admin', 'manager'), updateSpecialty);
router.delete('/:id', authorize('admin'), deleteSpecialty);

export default router;
