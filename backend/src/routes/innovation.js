/**
 * Innovation routes
 */

import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getAiAuditTrail,
  getAiTriagePolicy,
  getAiTriagePolicyHistory,
  getComplianceEvidencePackage,
  postActivateSigningKey,
  getSigningKeys,
  getSecurityPosture,
  postMaintenanceCleanup,
  postRevokeSigningKey,
  postRotateSigningKey,
  postVerifyDecisionPackage,
  postAiTriage,
  postPreventiveInsights,
  putAiTriagePolicy,
} from '../controllers/innovationController.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/security/posture', getSecurityPosture);
router.post('/ai/triage', postAiTriage);
router.post('/health/preventive-insights', postPreventiveInsights);
router.get('/ai-triage/policy', getAiTriagePolicy);
router.put('/ai-triage/policy', putAiTriagePolicy);
router.get('/ai-triage/policy/history', getAiTriagePolicyHistory);
router.get('/ai-triage/audit-trail', getAiAuditTrail);
router.post('/ai-triage/verify', postVerifyDecisionPackage);
router.get('/ai-triage/signing-keys', getSigningKeys);
router.post('/ai-triage/signing-keys/rotate', postRotateSigningKey);
router.post('/ai-triage/signing-keys/:keyId/activate', postActivateSigningKey);
router.post('/ai-triage/signing-keys/:keyId/revoke', postRevokeSigningKey);
router.get('/compliance/evidence', getComplianceEvidencePackage);
router.post('/maintenance/cleanup', postMaintenanceCleanup);

export default router;
