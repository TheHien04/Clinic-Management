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
};
