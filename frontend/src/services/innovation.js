import apiClient from './api';

export const getSecurityPostureAPI = async () => {
  const response = await apiClient.get('/innovation/security/posture');
  return response.data;
};

export const postAiTriageAPI = async (payload) => {
  const response = await apiClient.post('/innovation/ai/triage', payload);
  return response.data;
};

export const postPreventiveInsightsAPI = async (payload) => {
  const response = await apiClient.post('/innovation/health/preventive-insights', payload);
  return response.data;
};

export const getAiTriagePolicy = async () => {
  const response = await apiClient.get('/innovation/ai-triage/policy');
  return response.data;
};

export const updateAiTriagePolicy = async ({ policy, note }) => {
  const response = await apiClient.put('/innovation/ai-triage/policy', {
    policy,
    note,
  });
  return response.data;
};

export const getAiTriagePolicyHistory = async () => {
  const response = await apiClient.get('/innovation/ai-triage/policy/history');
  return response.data;
};

export const getAiAuditTrail = async (limit = 20) => {
  const response = await apiClient.get('/innovation/ai-triage/audit-trail', {
    params: { limit },
  });
  return response.data;
};

export const verifyDecisionPackage = async (decisionPackage) => {
  const response = await apiClient.post('/innovation/ai-triage/verify', {
    decisionPackage,
  });
  return response.data;
};

export const getInnovationSigningKeys = async () => {
  const response = await apiClient.get('/innovation/ai-triage/signing-keys');
  return response.data;
};

export const rotateInnovationSigningKey = async () => {
  const response = await apiClient.post('/innovation/ai-triage/signing-keys/rotate');
  return response.data;
};

export const activateInnovationSigningKey = async (keyId) => {
  const response = await apiClient.post(`/innovation/ai-triage/signing-keys/${encodeURIComponent(keyId)}/activate`);
  return response.data;
};

export const revokeInnovationSigningKey = async (keyId) => {
  const response = await apiClient.post(`/innovation/ai-triage/signing-keys/${encodeURIComponent(keyId)}/revoke`);
  return response.data;
};

export const getInnovationComplianceEvidence = async () => {
  const response = await apiClient.get('/innovation/compliance/evidence');
  return response.data;
};

export const runInnovationMaintenanceCleanup = async (payload = {}) => {
  const response = await apiClient.post('/innovation/maintenance/cleanup', payload);
  return response.data;
};

export const getInnovationModelOpsReadiness = async () => {
  const response = await apiClient.get('/innovation/modelops/readiness');
  return response.data;
};

export const getInnovationModelOpsSloTrend = async () => {
  const response = await apiClient.get('/innovation/modelops/slo-trend');
  return response.data;
};

export const getInnovationBackupDrills = async () => {
  const response = await apiClient.get('/innovation/resilience/backup-drills');
  return response.data;
};

export const recordInnovationBackupDrill = async (payload) => {
  const response = await apiClient.post('/innovation/resilience/backup-drills', payload);
  return response.data;
};

export const getInnovationBedCensus = async () => {
  const response = await apiClient.get('/innovation/operations/bed-census');
  return response.data;
};

export const getInnovationHandoverHistory = async (limit = 12, filters = {}) => {
  const response = await apiClient.get('/innovation/operations/handover', {
    params: {
      limit,
      ...(filters || {}),
    },
  });
  return response.data;
};

export const getInnovationHandoverAudits = async (limit = 20) => {
  const response = await apiClient.get('/innovation/operations/handover/audits', {
    params: { limit },
  });
  return response.data;
};

const downloadBlob = (blob, filename) => {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
};

export const downloadInnovationHandoverCsv = async () => {
  const blob = await apiClient.get('/innovation/operations/handover/export.csv', {
    responseType: 'blob',
  });
  downloadBlob(blob, `handover-history-${Date.now()}.csv`);
};

export const downloadInnovationHandoverAuditsCsv = async () => {
  const blob = await apiClient.get('/innovation/operations/handover/audits/export.csv', {
    responseType: 'blob',
  });
  downloadBlob(blob, `handover-audits-${Date.now()}.csv`);
};

export const saveInnovationHandover = async (payload) => {
  const response = await apiClient.post('/innovation/operations/handover', payload);
  return response.data;
};

export default {
  getSecurityPostureAPI,
  postAiTriageAPI,
  postPreventiveInsightsAPI,
  getAiTriagePolicy,
  updateAiTriagePolicy,
  getAiTriagePolicyHistory,
  getAiAuditTrail,
  verifyDecisionPackage,
  getInnovationSigningKeys,
  rotateInnovationSigningKey,
  activateInnovationSigningKey,
  revokeInnovationSigningKey,
  getInnovationComplianceEvidence,
  runInnovationMaintenanceCleanup,
  getInnovationModelOpsReadiness,
  getInnovationModelOpsSloTrend,
  getInnovationBackupDrills,
  recordInnovationBackupDrill,
  getInnovationBedCensus,
  getInnovationHandoverHistory,
  getInnovationHandoverAudits,
  downloadInnovationHandoverCsv,
  downloadInnovationHandoverAuditsCsv,
  saveInnovationHandover,
};
