import express from 'express';
import { getAllSpecialties, getSpecialtyById, createSpecialty, updateSpecialty, deleteSpecialty } from '../controllers/specialtyController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAllSpecialties);
router.get('/:id', getSpecialtyById);
router.post('/', createSpecialty);
router.put('/:id', updateSpecialty);
router.delete('/:id', deleteSpecialty);

export default router;
