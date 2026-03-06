/**
 * Authentication Routes
 */

import express from 'express';
import { register, login, refreshToken, getMe } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);

// Protected routes
router.get('/me', authMiddleware, getMe);

export default router;
