/**
 * Innovation routes
 */

import express from 'express';
import { authMiddleware, authorize } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/security.js';
import {
  getAiAuditTrail,
  getAiTriagePolicy,
  getAiTriagePolicyHistory,
  getBackupRestoreDrills,
  getComplianceEvidencePackage,
  getModelOpsReadiness,
  getModelOpsSloTrend,
  getOperationsBedCensus,
  getOperationsHandover,
  getOperationsHandoverAudits,
  getOperationsHandoverCsv,
  getOperationsHandoverAuditsCsv,
  postActivateSigningKey,
  postBackupRestoreDrill,
  postOperationsHandover,
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

const handoverWriteRateLimiter = createRateLimiter({
  windowMs: process.env.HANDOVER_WRITE_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.HANDOVER_WRITE_RATE_LIMIT_MAX || 30,
  message: 'Too many handover write requests. Please retry shortly.',
});

const handoverReadRateLimiter = createRateLimiter({
  windowMs: process.env.HANDOVER_READ_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.HANDOVER_READ_RATE_LIMIT_MAX || 180,
  message: 'Too many handover read/export requests. Please retry shortly.',
});

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
router.get('/modelops/readiness', getModelOpsReadiness);
router.get('/modelops/slo-trend', getModelOpsSloTrend);
router.get('/resilience/backup-drills', getBackupRestoreDrills);
router.post('/resilience/backup-drills', postBackupRestoreDrill);
router.get('/operations/bed-census', getOperationsBedCensus);
router.get('/operations/handover', handoverReadRateLimiter, authorize('admin', 'manager', 'supervisor'), getOperationsHandover);
router.get('/operations/handover/export.csv', handoverReadRateLimiter, authorize('admin', 'manager', 'supervisor'), getOperationsHandoverCsv);
router.get('/operations/handover/audits', handoverReadRateLimiter, authorize('admin', 'manager', 'supervisor'), getOperationsHandoverAudits);
router.get('/operations/handover/audits/export.csv', handoverReadRateLimiter, authorize('admin', 'manager', 'supervisor'), getOperationsHandoverAuditsCsv);
router.post('/operations/handover', handoverWriteRateLimiter, authorize('admin', 'manager', 'supervisor'), postOperationsHandover);
router.post('/maintenance/cleanup', postMaintenanceCleanup);

export default router;
