import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import InnovationLab from './InnovationLab';

const getSecurityPostureAPIMock = vi.fn();
const postAiTriageAPIMock = vi.fn();
const verifyDecisionPackageMock = vi.fn();
const postPreventiveInsightsAPIMock = vi.fn();
const getAiTriagePolicyMock = vi.fn();
const updateAiTriagePolicyMock = vi.fn();
const getAiTriagePolicyHistoryMock = vi.fn();
const getAiAuditTrailMock = vi.fn();
const getInnovationSigningKeysMock = vi.fn();
const rotateInnovationSigningKeyMock = vi.fn();
const activateInnovationSigningKeyMock = vi.fn();
const revokeInnovationSigningKeyMock = vi.fn();
const runInnovationMaintenanceCleanupMock = vi.fn();
const subscribeInnovationEmergencyMock = vi.fn();

vi.mock('../components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('../components/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../services/innovation', () => ({
  getSecurityPostureAPI: (...args) => getSecurityPostureAPIMock(...args),
  postAiTriageAPI: (...args) => postAiTriageAPIMock(...args),
  verifyDecisionPackage: (...args) => verifyDecisionPackageMock(...args),
  postPreventiveInsightsAPI: (...args) => postPreventiveInsightsAPIMock(...args),
  getAiTriagePolicy: (...args) => getAiTriagePolicyMock(...args),
  updateAiTriagePolicy: (...args) => updateAiTriagePolicyMock(...args),
  getAiTriagePolicyHistory: (...args) => getAiTriagePolicyHistoryMock(...args),
  getAiAuditTrail: (...args) => getAiAuditTrailMock(...args),
  getInnovationSigningKeys: (...args) => getInnovationSigningKeysMock(...args),
  rotateInnovationSigningKey: (...args) => rotateInnovationSigningKeyMock(...args),
  activateInnovationSigningKey: (...args) => activateInnovationSigningKeyMock(...args),
  revokeInnovationSigningKey: (...args) => revokeInnovationSigningKeyMock(...args),
  runInnovationMaintenanceCleanup: (...args) => runInnovationMaintenanceCleanupMock(...args),
  getInnovationComplianceEvidence: vi.fn(),
}));

vi.mock('../services/socket', () => ({
  subscribeInnovationEmergency: (...args) => subscribeInnovationEmergencyMock(...args),
}));

const renderInnovationLab = () => {
  return render(
    <MemoryRouter>
      <InnovationLab />
    </MemoryRouter>
  );
};

describe('InnovationLab integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getAiTriagePolicyMock.mockResolvedValue({
      version: 3,
      policy: { highRiskThreshold: 80 },
    });
    getAiTriagePolicyHistoryMock.mockResolvedValue([
      { version: 3, changedBy: 'admin', changedAt: '2026-01-15T08:00:00.000Z' },
    ]);
    getAiAuditTrailMock.mockResolvedValue([]);
    getInnovationSigningKeysMock.mockResolvedValue({
      keys: [
        {
          keyId: 'key-active-1',
          algorithm: 'ES256',
          source: 'db',
          ageDays: 1,
          active: true,
        },
      ],
      activeKeyId: 'key-active-1',
      atRestEncryptionEnabled: true,
    });
    rotateInnovationSigningKeyMock.mockResolvedValue({
      keys: [
        {
          keyId: 'key-active-2',
          algorithm: 'ES256',
          source: 'db',
          ageDays: 0,
          active: true,
        },
      ],
      activeKeyId: 'key-active-2',
      rotatedAt: '2026-01-15T09:00:00.000Z',
    });
    runInnovationMaintenanceCleanupMock.mockResolvedValue({
      removedRevokedKeys: 2,
      removedAuditRows: 11,
      cleanedAt: '2026-01-15T10:00:00.000Z',
    });

    postAiTriageAPIMock.mockResolvedValue({
      urgency: 'high',
      riskScore: 92,
      policyVersion: 3,
      recommendation: 'Immediate transfer to emergency response unit.',
      redFlags: ['low-oxygen', 'tachycardia'],
      decisionPackage: {
        packageId: 'pkg-innovation-001',
        algorithm: 'ES256',
        keyId: 'key-active-1',
        digest: 'abcd1234efgh5678ijkl9012mnop3456',
        signature: 'signed-payload',
      },
    });
    verifyDecisionPackageMock.mockResolvedValue({
      valid: true,
      checkedAt: '2026-01-15T09:30:00.000Z',
      algorithm: 'ES256',
      keyId: 'key-active-1',
      digestMatched: true,
      signatureVerified: true,
    });
    postPreventiveInsightsAPIMock.mockResolvedValue({
      segment: 'metabolic-risk',
      riskScore: 64,
      nextBestActions: ['nutrition plan', 'remote coaching'],
    });
    updateAiTriagePolicyMock.mockResolvedValue({
      version: 4,
      policy: { highRiskThreshold: 85 },
    });
    getSecurityPostureAPIMock.mockResolvedValue({
      posture: 'guarded',
      riskScore: 36,
      tokenAgeMinutes: 5,
      expiresInMinutes: 25,
      controls: ['mfa', 'token-rotation'],
    });

    subscribeInnovationEmergencyMock.mockImplementation(() => () => {});

    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:innovation');
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    }
  });

  it('loads baseline governance and key lifecycle sections', async () => {
    renderInnovationLab();

    await waitFor(() => {
      expect(screen.getByText('Global Innovation Lab')).toBeTruthy();
      expect(screen.getByText('AI Policy Engine Governance')).toBeTruthy();
      expect(screen.getByText('Signing Key Lifecycle')).toBeTruthy();
      expect(screen.getByText('Active key: key-active-1')).toBeTruthy();
      expect(screen.getByText('Current policy version: 3')).toBeTruthy();
      expect(screen.getByText(/At-rest encryption: ENABLED/i)).toBeTruthy();
    });
  });

  it('runs triage then verifies signed package', async () => {
    renderInnovationLab();

    fireEvent.click(screen.getByRole('button', { name: /run ai triage/i }));

    await waitFor(() => {
      expect(screen.getByText(/Package: pkg-innovation-001/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /verify latest signed package/i }));

    await waitFor(() => {
      expect(screen.getByText(/Signature verify: VALID/i)).toBeTruthy();
      expect(screen.getByText(/Digest match: YES/i)).toBeTruthy();
      expect(screen.getByText(/Signature match: YES/i)).toBeTruthy();
    });
  });

  it('updates policy and runs maintenance cleanup', async () => {
    const { container } = renderInnovationLab();

    await waitFor(() => {
      expect(screen.getByText('Current policy version: 3')).toBeTruthy();
    });

    const editor = container.querySelector('.innovation-policy-editor');
    expect(editor).toBeTruthy();
    fireEvent.change(editor, {
      target: { value: JSON.stringify({ highRiskThreshold: 85 }, null, 2) },
    });

    fireEvent.click(screen.getByRole('button', { name: /publish policy/i }));

    await waitFor(() => {
      expect(screen.getByText('Policy updated successfully')).toBeTruthy();
      expect(updateAiTriagePolicyMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /rotate key/i }));
    await waitFor(() => {
      expect(screen.getByText(/Rotated successfully at/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /run cleanup/i }));
    await waitFor(() => {
      expect(screen.getByText(/Cleanup complete: revoked keys removed 2, audit rows removed 11/i)).toBeTruthy();
    });
  });
});
