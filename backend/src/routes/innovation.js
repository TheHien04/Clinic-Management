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

const clinical = authorize('admin', 'manager', 'supervisor', 'doctor', 'nurse');
const operations = authorize('admin', 'manager', 'supervisor');
const administrators = authorize('admin', 'manager');

router.get('/security/posture', administrators, getSecurityPosture);
router.post('/ai/triage', clinical, postAiTriage);
router.post('/health/preventive-insights', clinical, postPreventiveInsights);
router.get('/ai-triage/policy', clinical, getAiTriagePolicy);
router.put('/ai-triage/policy', administrators, putAiTriagePolicy);
router.get('/ai-triage/policy/history', administrators, getAiTriagePolicyHistory);
router.get('/ai-triage/audit-trail', administrators, getAiAuditTrail);
router.post('/ai-triage/verify', clinical, postVerifyDecisionPackage);
router.get('/ai-triage/signing-keys', administrators, getSigningKeys);
router.post('/ai-triage/signing-keys/rotate', authorize('admin'), postRotateSigningKey);
router.post('/ai-triage/signing-keys/:keyId/activate', authorize('admin'), postActivateSigningKey);
router.post('/ai-triage/signing-keys/:keyId/revoke', authorize('admin'), postRevokeSigningKey);
router.get('/compliance/evidence', administrators, getComplianceEvidencePackage);
router.get('/modelops/readiness', administrators, getModelOpsReadiness);
router.get('/modelops/slo-trend', administrators, getModelOpsSloTrend);
router.get('/resilience/backup-drills', administrators, getBackupRestoreDrills);
router.post('/resilience/backup-drills', authorize('admin'), postBackupRestoreDrill);
router.get('/operations/bed-census', operations, getOperationsBedCensus);
router.get('/operations/handover', handoverReadRateLimiter, authorize('admin', 'manager', 'supervisor'), getOperationsHandover);
router.get('/operations/handover/export.csv', handoverReadRateLimiter, authorize('admin', 'manager', 'supervisor'), getOperationsHandoverCsv);
router.get('/operations/handover/audits', handoverReadRateLimiter, authorize('admin', 'manager', 'supervisor'), getOperationsHandoverAudits);
router.get('/operations/handover/audits/export.csv', handoverReadRateLimiter, authorize('admin', 'manager', 'supervisor'), getOperationsHandoverAuditsCsv);
router.post('/operations/handover', handoverWriteRateLimiter, authorize('admin', 'manager', 'supervisor'), postOperationsHandover);
router.post('/maintenance/cleanup', authorize('admin'), postMaintenanceCleanup);

export default router;
