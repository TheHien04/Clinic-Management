import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
  activateInnovationSigningKey,
  getAiAuditTrail,
  getAiTriagePolicy,
  getAiTriagePolicyHistory,
  getInnovationComplianceEvidence,
  getInnovationSigningKeys,
  getSecurityPostureAPI,
  postAiTriageAPI,
  postPreventiveInsightsAPI,
  revokeInnovationSigningKey,
  rotateInnovationSigningKey,
  runInnovationMaintenanceCleanup,
  updateAiTriagePolicy,
  verifyDecisionPackage,
} from '../services/innovation';
import { subscribeInnovationEmergency } from '../services/socket';
import './InnovationLab.css';

export default function InnovationLab() {
  const [security, setSecurity] = useState(null);
  const [securityError, setSecurityError] = useState('');

  const [triageInput, setTriageInput] = useState({
    age: 62,
    symptoms: 'shortness of breath, chest discomfort',
    heartRate: 118,
    spo2: 91,
    temperature: 38.2,
    systolic: 162,
  });
  const [triageResult, setTriageResult] = useState(null);
  const [triageError, setTriageError] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);

  const [preventiveInput, setPreventiveInput] = useState({
    age: 57,
    chronicConditions: 'diabetes, hypertension',
    activityLevel: 'low',
    adherence: 64,
  });
  const [preventiveResult, setPreventiveResult] = useState(null);
  const [preventiveError, setPreventiveError] = useState('');

  const [policyDraft, setPolicyDraft] = useState('');
  const [policyVersion, setPolicyVersion] = useState(0);
  const [policyHistory, setPolicyHistory] = useState([]);
  const [policyError, setPolicyError] = useState('');
  const [policySaved, setPolicySaved] = useState('');

  const [auditTrail, setAuditTrail] = useState([]);
  const [auditError, setAuditError] = useState('');
  const [emergencyFeed, setEmergencyFeed] = useState([]);
  const [signingKeys, setSigningKeys] = useState([]);
  const [activeKeyId, setActiveKeyId] = useState('');
  const [keyStatus, setKeyStatus] = useState('');
  const [atRestEncryptionEnabled, setAtRestEncryptionEnabled] = useState(false);
  const [maintenanceStatus, setMaintenanceStatus] = useState('');

  const loadSigningKeys = async () => {
    setKeyStatus('');
    try {
      const data = await getInnovationSigningKeys();
      setSigningKeys(Array.isArray(data.keys) ? data.keys : []);
      setActiveKeyId(data.activeKeyId || '');
      setAtRestEncryptionEnabled(Boolean(data.atRestEncryptionEnabled));
    } catch (error) {
      setKeyStatus(error?.message || 'Unable to load signing keys');
    }
  };

  const rotateKey = async () => {
    setKeyStatus('');
    try {
      const data = await rotateInnovationSigningKey();
      setSigningKeys(Array.isArray(data.keys) ? data.keys : []);
      setActiveKeyId(data.activeKeyId || '');
      setKeyStatus(`Rotated successfully at ${data.rotatedAt}`);
    } catch (error) {
      setKeyStatus(error?.message || 'Unable to rotate signing key');
    }
  };

  const activateKey = async (keyId) => {
    setKeyStatus('');
    try {
      const data = await activateInnovationSigningKey(keyId);
      setSigningKeys(Array.isArray(data.keys) ? data.keys : []);
      setActiveKeyId(data.activeKeyId || '');
      setKeyStatus(`Activated key ${keyId}`);
    } catch (error) {
      setKeyStatus(error?.message || 'Unable to activate signing key');
    }
  };

  const revokeKey = async (keyId) => {
    setKeyStatus('');
    try {
      const data = await revokeInnovationSigningKey(keyId);
      setSigningKeys(Array.isArray(data.keys) ? data.keys : []);
      setActiveKeyId(data.activeKeyId || '');
      setKeyStatus(`Revoked key ${keyId}`);
    } catch (error) {
      setKeyStatus(error?.message || 'Unable to revoke signing key');
    }
  };

  const exportComplianceEvidence = async () => {
    setMaintenanceStatus('');
    try {
      const evidence = await getInnovationComplianceEvidence();
      const payload = JSON.stringify(evidence, null, 2);
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `innovation_compliance_evidence_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setMaintenanceStatus(`Evidence exported with hash ${String(evidence.integrityHash || '').slice(0, 16)}...`);
    } catch (error) {
      setMaintenanceStatus(error?.message || 'Unable to export compliance evidence');
    }
  };

  const runCleanup = async () => {
    setMaintenanceStatus('');
    try {
      const data = await runInnovationMaintenanceCleanup({
        revokedRetentionDays: 90,
        auditKeep: 500,
      });
      setMaintenanceStatus(
        `Cleanup complete: revoked keys removed ${data.removedRevokedKeys}, audit rows removed ${data.removedAuditRows}`
      );
      await loadSigningKeys();
      await loadAuditTrail();
    } catch (error) {
      setMaintenanceStatus(error?.message || 'Unable to run maintenance cleanup');
    }
  };

  const loadPolicy = async () => {
    setPolicyError('');
    try {
      const [currentPolicy, history] = await Promise.all([
        getAiTriagePolicy(),
        getAiTriagePolicyHistory(),
      ]);
      setPolicyVersion(currentPolicy.version || 0);
      setPolicyDraft(JSON.stringify(currentPolicy.policy || {}, null, 2));
      setPolicyHistory(Array.isArray(history) ? history : []);
    } catch (error) {
      setPolicyError(error?.message || 'Unable to load policy');
    }
  };

  const loadAuditTrail = async () => {
    setAuditError('');
    try {
      const data = await getAiAuditTrail(20);
      setAuditTrail(Array.isArray(data) ? data : []);
    } catch (error) {
      setAuditError(error?.message || 'Unable to load audit trail');
    }
  };

  useEffect(() => {
    loadPolicy();
    loadAuditTrail();
    loadSigningKeys();

    const unsubscribe = subscribeInnovationEmergency((event) => {
      setEmergencyFeed((prev) => [event, ...prev].slice(0, 20));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadSecurity = async () => {
    setSecurityError('');
    try {
      const data = await getSecurityPostureAPI();
      setSecurity(data);
    } catch (error) {
      setSecurityError(error?.message || 'Unable to fetch security posture');
    }
  };

  const runTriage = async (event) => {
    event.preventDefault();
    setTriageError('');
    try {
      const payload = {
        age: Number(triageInput.age),
        symptoms: triageInput.symptoms,
        vitals: {
          heartRate: Number(triageInput.heartRate),
          spo2: Number(triageInput.spo2),
          temperature: Number(triageInput.temperature),
          systolic: Number(triageInput.systolic),
        },
      };
      const data = await postAiTriageAPI(payload);
      setTriageResult(data);
      setVerifyResult(null);
      loadAuditTrail();
    } catch (error) {
      setTriageError(error?.message || 'Unable to run AI triage');
    }
  };

  const savePolicy = async () => {
    setPolicyError('');
    setPolicySaved('');
    try {
      const parsed = JSON.parse(policyDraft || '{}');
      const data = await updateAiTriagePolicy({
        policy: parsed,
        note: 'Updated from Innovation Lab UI',
      });
      setPolicyVersion(data.version || 0);
      setPolicyDraft(JSON.stringify(data.policy || {}, null, 2));
      setPolicySaved('Policy updated successfully');
      loadPolicy();
    } catch (error) {
      setPolicyError(error?.message || 'Unable to save policy');
    }
  };

  const verifyLatestPackage = async () => {
    setTriageError('');
    setVerifyResult(null);
    try {
      if (!triageResult?.decisionPackage) {
        setTriageError('Run triage first to generate signed decision package');
        return;
      }
      const data = await verifyDecisionPackage(triageResult.decisionPackage);
      setVerifyResult(data);
    } catch (error) {
      setTriageError(error?.message || 'Unable to verify decision package');
    }
  };

  const runPreventive = async (event) => {
    event.preventDefault();
    setPreventiveError('');
    try {
      const payload = {
        age: Number(preventiveInput.age),
        chronicConditions: preventiveInput.chronicConditions
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        activityLevel: preventiveInput.activityLevel,
        adherence: Number(preventiveInput.adherence),
      };
      const data = await postPreventiveInsightsAPI(payload);
      setPreventiveResult(data);
    } catch (error) {
      setPreventiveError(error?.message || 'Unable to run preventive insights');
    }
  };

  return (
    <div className="innovation-page">
      <Sidebar />
      <main className="innovation-main">
        <Header />
        <h2>Global Innovation Lab</h2>
        <p>International-grade capabilities for cyber-resilience, AI triage, and preventive health orchestration.</p>

        <div className="innovation-grid">
          <section className="innovation-card">
            <h3>Security Posture Intelligence</h3>
            <button onClick={loadSecurity} type="button">Refresh Security Posture</button>
            {securityError && <p>{securityError}</p>}
            {security && (
              <div>
                <div className="innovation-kpi">{security.posture?.toUpperCase()} ({security.riskScore})</div>
                <p>Token age: {security.tokenAgeMinutes} minutes</p>
                <p>Expires in: {security.expiresInMinutes} minutes</p>
                {(security.controls || []).map((control) => (
                  <span key={control} className="innovation-chip">{control}</span>
                ))}
              </div>
            )}
          </section>

          <section className="innovation-card">
            <h3>AI Clinical Triage Copilot</h3>
            <form className="innovation-form" onSubmit={runTriage}>
              <input value={triageInput.age} type="number" onChange={(e) => setTriageInput((p) => ({ ...p, age: e.target.value }))} placeholder="Age" />
              <textarea value={triageInput.symptoms} onChange={(e) => setTriageInput((p) => ({ ...p, symptoms: e.target.value }))} rows={3} placeholder="Symptoms" />
              <input value={triageInput.heartRate} type="number" onChange={(e) => setTriageInput((p) => ({ ...p, heartRate: e.target.value }))} placeholder="Heart rate" />
              <input value={triageInput.spo2} type="number" onChange={(e) => setTriageInput((p) => ({ ...p, spo2: e.target.value }))} placeholder="SpO2" />
              <input value={triageInput.temperature} type="number" step="0.1" onChange={(e) => setTriageInput((p) => ({ ...p, temperature: e.target.value }))} placeholder="Temperature" />
              <input value={triageInput.systolic} type="number" onChange={(e) => setTriageInput((p) => ({ ...p, systolic: e.target.value }))} placeholder="Systolic BP" />
              <button type="submit">Run AI Triage</button>
            </form>
            <button type="button" onClick={verifyLatestPackage}>Verify Latest Signed Package</button>
            {triageError && <p>{triageError}</p>}
            {triageResult && (
              <div>
                <div className="innovation-kpi">{triageResult.urgency?.toUpperCase()} ({triageResult.riskScore})</div>
                <p>Policy version: {triageResult.policyVersion}</p>
                <p>{triageResult.recommendation}</p>
                {(triageResult.redFlags || []).map((flag) => (
                  <span key={flag} className="innovation-chip">{flag}</span>
                ))}
                <p>Package: {triageResult.decisionPackage?.packageId}</p>
                <p>Algorithm: {triageResult.decisionPackage?.algorithm || '-'}</p>
                <p>Key ID: {triageResult.decisionPackage?.keyId || '-'}</p>
                <p>Digest: {String(triageResult.decisionPackage?.digest || '').slice(0, 20)}...</p>
              </div>
            )}
            {verifyResult && (
              <div>
                <p>Signature verify: {verifyResult.valid ? 'VALID' : 'INVALID'} at {verifyResult.checkedAt}</p>
                <p>Verified algorithm: {verifyResult.algorithm || '-'}</p>
                <p>Verified key ID: {verifyResult.keyId || '-'}</p>
                <p>Digest match: {verifyResult.digestMatched ? 'YES' : 'NO'}</p>
                <p>Signature match: {verifyResult.signatureVerified ? 'YES' : 'NO'}</p>
              </div>
            )}
          </section>

          <section className="innovation-card">
            <h3>Preventive Care Coach</h3>
            <form className="innovation-form" onSubmit={runPreventive}>
              <input value={preventiveInput.age} type="number" onChange={(e) => setPreventiveInput((p) => ({ ...p, age: e.target.value }))} placeholder="Age" />
              <input value={preventiveInput.chronicConditions} onChange={(e) => setPreventiveInput((p) => ({ ...p, chronicConditions: e.target.value }))} placeholder="Chronic conditions (comma separated)" />
              <select value={preventiveInput.activityLevel} onChange={(e) => setPreventiveInput((p) => ({ ...p, activityLevel: e.target.value }))}>
                <option value="low">Low activity</option>
                <option value="moderate">Moderate activity</option>
                <option value="high">High activity</option>
              </select>
              <input value={preventiveInput.adherence} type="number" onChange={(e) => setPreventiveInput((p) => ({ ...p, adherence: e.target.value }))} placeholder="Adherence %" />
              <button type="submit">Generate Preventive Plan</button>
            </form>
            {preventiveError && <p>{preventiveError}</p>}
            {preventiveResult && (
              <div>
                <div className="innovation-kpi">{preventiveResult.segment} ({preventiveResult.riskScore})</div>
                {(preventiveResult.nextBestActions || []).map((action) => (
                  <span key={action} className="innovation-chip">{action}</span>
                ))}
              </div>
            )}
          </section>

          <section className="innovation-card">
            <h3>AI Policy Engine Governance</h3>
            <p>Current policy version: {policyVersion || '-'}</p>
            <textarea
              rows={12}
              value={policyDraft}
              onChange={(event) => setPolicyDraft(event.target.value)}
              className="innovation-policy-editor"
            />
            <div className="innovation-inline-actions">
              <button type="button" onClick={loadPolicy}>Reload Policy</button>
              <button type="button" onClick={savePolicy}>Publish Policy</button>
            </div>
            {policyError && <p>{policyError}</p>}
            {policySaved && <p>{policySaved}</p>}
            <h4>Recent Policy Versions</h4>
            <div className="innovation-list">
              {policyHistory.slice(0, 5).map((item) => (
                <p key={item.version}>v{item.version} by {item.changedBy} at {item.changedAt}</p>
              ))}
            </div>
          </section>

          <section className="innovation-card">
            <h3>Signed Audit Trail</h3>
            <button type="button" onClick={loadAuditTrail}>Refresh Audit Trail</button>
            {auditError && <p>{auditError}</p>}
            <div className="innovation-list">
              {auditTrail.map((entry) => (
                <p key={entry.id}>
                  {entry.generatedAt} | {entry.id} | {entry.urgency} ({entry.riskScore}) | v{entry.policyVersion}
                </p>
              ))}
              {auditTrail.length === 0 && <p>No signed triage package yet.</p>}
            </div>
          </section>

          <section className="innovation-card">
            <h3>Signing Key Lifecycle</h3>
            <p>Active key: {activeKeyId || '-'}</p>
            <p>At-rest encryption: {atRestEncryptionEnabled ? 'ENABLED' : 'DISABLED'}</p>
            <div className="innovation-inline-actions">
              <button type="button" onClick={loadSigningKeys}>Refresh Keys</button>
              <button type="button" onClick={rotateKey}>Rotate Key</button>
              <button type="button" onClick={exportComplianceEvidence}>Export Evidence</button>
              <button type="button" onClick={runCleanup}>Run Cleanup</button>
            </div>
            {keyStatus && <p>{keyStatus}</p>}
            {maintenanceStatus && <p>{maintenanceStatus}</p>}
            <div className="innovation-list">
              {signingKeys.map((key) => (
                <div key={key.keyId}>
                  <p>
                    {key.keyId} | {key.algorithm} | {key.source} | {key.ageDays} day(s) | {key.active ? 'ACTIVE' : 'standby'}
                  </p>
                  <div className="innovation-inline-actions">
                    {!key.active && (
                      <button type="button" onClick={() => activateKey(key.keyId)}>Activate</button>
                    )}
                    <button type="button" onClick={() => revokeKey(key.keyId)}>Revoke</button>
                  </div>
                </div>
              ))}
              {signingKeys.length === 0 && <p>No signing key metadata available.</p>}
            </div>
          </section>

          <section className="innovation-card innovation-emergency-card">
            <h3>Realtime Emergency Escalation</h3>
            <p>Live socket feed for critical triage escalations.</p>
            <div className="innovation-list">
              {emergencyFeed.map((event, index) => (
                <p key={`${event.packageId || 'event'}-${index}`}>
                  {event.at} | package {event.packageId || 'unknown'} | score {event.riskScore} | {event.recommendation}
                </p>
              ))}
              {emergencyFeed.length === 0 && <p>No emergency event received yet.</p>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
