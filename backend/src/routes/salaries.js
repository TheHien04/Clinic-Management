import express from 'express';
import { 
  getAllSalaryRecords, 
  getSalaryRecordById, 
  calculateSalaries, 
  getSalarySummary,
  deleteSalaryRecord 
} from '../controllers/salaryController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorize('admin', 'manager'));

router.get('/', getAllSalaryRecords);
router.get('/summary', getSalarySummary);
router.get('/:id', getSalaryRecordById);
router.post('/calculate', calculateSalaries);
router.delete('/:id', deleteSalaryRecord);

export default router;
