/**
 * Authentication Routes
 */

import express from 'express';
import {
	register,
	login,
	refreshToken,
	getMe,
	getSecurityAudit,
	cleanupSecurityAudit,
	exportPrivacyData,
	anonymizePrivacyData,
} from '../controllers/authController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';
import { authRateLimiter, loginRateLimiter } from '../middleware/security.js';
import { issueCsrfToken } from '../middleware/csrf.js';

const router = express.Router();

// Public routes
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, loginRateLimiter, login);
router.post('/refresh', authRateLimiter, refreshToken);
router.get('/csrf-token', authRateLimiter, issueCsrfToken);

// Protected routes
router.get('/me', authMiddleware, getMe);
router.get('/security-audit', authMiddleware, authorize('admin'), getSecurityAudit);
router.post('/security-audit/cleanup', authMiddleware, authorize('admin'), cleanupSecurityAudit);
router.get('/privacy/export/:accountId', authMiddleware, authorize('admin'), exportPrivacyData);
router.post('/privacy/anonymize/:accountId', authMiddleware, authorize('admin'), anonymizePrivacyData);

export default router;
