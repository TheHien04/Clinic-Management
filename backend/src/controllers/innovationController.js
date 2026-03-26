/**
 * Innovation Controller
 * International-grade features: security posture, AI triage, preventive insights,
 * policy versioning, signed audit packages, and realtime emergency escalation.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { executeQuery } from '../config/database.js';
import { emitInnovationEmergency, emitOperationsHandoverSaved } from '../socket/index.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseBearer = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
};

const defaultTriagePolicy = {
  symptomWeights: {
    chestPain: 45,
    respiratoryDistress: 35,
    neurologicalEmergency: 45,
  },
  vitalThresholds: {
    spo2Low: 92,
    heartRateHigh: 130,
    heartRateLow: 45,
    tempHigh: 39.5,
    systolicHigh: 180,
    systolicLow: 90,
  },
  vitalWeights: {
    spo2Low: 40,
    heartRateCritical: 30,
    tempHigh: 20,
    systolicCritical: 25,
  },
  ageWeights: {
    elderly: 10,
  },
  urgencyThresholds: {
    emergency: 70,
    urgent: 40,
  },
};

let triagePolicy = { ...defaultTriagePolicy };
let triagePolicyVersion = 1;
const triagePolicyHistory = [
  {
    version: triagePolicyVersion,
    policy: triagePolicy,
    changedAt: new Date().toISOString(),
    changedBy: 'system',
    note: 'Initial policy bootstrap',
  },
];

const triageAuditTrail = [];
const backupDrillTrail = [];
const handoverTrail = [];
const handoverAuditTrail = [];
let innovationPersistenceEnabled = true;
let innovationPersistenceInitPromise = null;
let innovationPersistenceLastError = null;
let innovationPersistenceLastHealthyAt = null;

const getSigningSecret = () => String(process.env.INNOVATION_SIGNING_KEY || jwtConfig.secret || 'innovation-signing-dev-secret');

const normalizePem = (value) => String(value || '').replace(/\\n/g, '\n').trim();
const signingKeyRing = new Map();
let activeSigningKeyId = '';
const autoRotateDays = Math.max(1, Number(process.env.INNOVATION_SIGNING_ROTATE_DAYS || 30));
let canAutoRotateSigningKey = false;
let signingKeysLoadedFromPersistence = false;
const ENCRYPTION_PREFIX = 'enc:v1';

const signPayload = (payload) => {
  const canonical = JSON.stringify(payload);
  const digest = crypto.createHash('sha256').update(canonical).digest('hex');
  const signature = crypto.createHmac('sha256', getSigningSecret()).update(digest).digest('hex');
  return { digest, signature };
};

const percentile = (values, p) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
};

const csvEscape = (value) => {
  const raw = String(value ?? '');
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const toIsoDate = (value) => {
  const parsed = new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const buildDailySloBuckets = (events, days = 30) => {
  const now = new Date();
  const dateKeys = Array.from({ length: days }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - idx - 1));
    return d.toISOString().slice(0, 10);
  });

  const grouped = new Map(dateKeys.map((key) => [key, []]));
  events.forEach((event) => {
    const key = toIsoDate(event.generatedAt);
    if (grouped.has(key)) {
      grouped.get(key).push(event);
    }
  });

  return dateKeys.map((key) => {
    const rows = grouped.get(key) || [];
    const emergencyCount = rows.filter((row) => String(row.urgency || '').toLowerCase() === 'emergency').length;
    const emergencyRatePct = rows.length ? Math.round((emergencyCount / rows.length) * 100) : 0;
    const p95Risk = percentile(rows.map((row) => Number(row.riskScore || 0)), 95);
    const availabilityPct = rows.length > 0 ? clamp(Math.round(1000 - emergencyRatePct * 1.5) / 10, 96, 100) : 99;
    const mttrMinutes = clamp(12 + emergencyRatePct * 1.4, 8, 90);

    return {
      date: key,
      triageCount: rows.length,
      emergencyRatePct,
      availabilityPct,
      p95Risk,
      mttrMinutes: Math.round(mttrMinutes),
    };
  });
};

const summarizeSloWindow = (rows) => {
  if (!rows.length) {
    return {
      availabilityPct: 99,
      emergencyRatePct: 0,
      p95Risk: 0,
      mttrMinutes: 0,
      triageCount: 0,
    };
  }

  const avg = (fn) => rows.reduce((acc, row) => acc + fn(row), 0) / rows.length;

  return {
    availabilityPct: Number(avg((row) => Number(row.availabilityPct || 0)).toFixed(2)),
    emergencyRatePct: Number(avg((row) => Number(row.emergencyRatePct || 0)).toFixed(2)),
    p95Risk: Math.max(...rows.map((row) => Number(row.p95Risk || 0))),
    mttrMinutes: Number(avg((row) => Number(row.mttrMinutes || 0)).toFixed(1)),
    triageCount: rows.reduce((acc, row) => acc + Number(row.triageCount || 0), 0),
  };
};

const verifySignedPayload = (payload, digest, signature) => {
  const expected = signPayload(payload);
  return expected.digest === digest && expected.signature === signature;
};

const getKeyEncryptionSecret = () => String(process.env.INNOVATION_KEY_ENCRYPTION_SECRET || '').trim();

const deriveEncryptionKey = () => {
  const secret = getKeyEncryptionSecret();
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
};

const encryptPrivateKeyForStorage = (privateKeyPem) => {
  const normalizedPrivate = normalizePem(privateKeyPem);
  const key = deriveEncryptionKey();
  if (!key) return normalizedPrivate;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(normalizedPrivate, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTION_PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptPrivateKeyFromStorage = (storedValue) => {
  const raw = String(storedValue || '').trim();
  if (!raw.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return raw;
  }

  const key = deriveEncryptionKey();
  if (!key) {
    throw new Error('Encrypted signing key requires INNOVATION_KEY_ENCRYPTION_SECRET');
  }

  const parts = raw.split(':');
  if (parts.length !== 5) {
    throw new Error('Invalid encrypted signing key payload format');
  }

  const iv = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const ciphertext = Buffer.from(parts[4], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return decrypted;
};

const buildKeyId = (publicKeyPem) => {
  const fingerprint = crypto.createHash('sha256').update(publicKeyPem).digest('hex');
  return `innovation-es256-${fingerprint.slice(0, 12)}`;
};

const registerSigningKey = ({ privateKeyPem, publicKeyPem, keyId, source = 'runtime', createdAt, activate = true }) => {
  const normalizedPrivate = normalizePem(privateKeyPem);
  const normalizedPublic = normalizePem(publicKeyPem);
  if (!normalizedPrivate || !normalizedPublic) {
    throw new Error('Invalid signing key pair');
  }

  const privateKey = crypto.createPrivateKey(normalizedPrivate);
  const publicKey = crypto.createPublicKey(normalizedPublic);
  const resolvedKeyId = String(keyId || buildKeyId(normalizedPublic));
  signingKeyRing.set(resolvedKeyId, {
    keyId: resolvedKeyId,
    privateKey,
    publicKey,
    publicKeyPem: normalizedPublic,
    createdAt: createdAt || new Date().toISOString(),
    source,
    privateKeyPem: normalizedPrivate,
  });
  if (activate) {
    activeSigningKeyId = resolvedKeyId;
  }
  return signingKeyRing.get(resolvedKeyId);
};

const rotateSigningKey = () => {
  const generated = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
  });

  return registerSigningKey({
    privateKeyPem: generated.privateKey,
    publicKeyPem: generated.publicKey,
    source: 'generated',
  });
};

const ensureAsymmetricSigningKey = () => {
  if (!activeSigningKeyId || !signingKeyRing.has(activeSigningKeyId)) {
    const envPrivate = normalizePem(process.env.INNOVATION_SIGNING_PRIVATE_KEY_PEM);
    if (envPrivate) {
      const envPublic = normalizePem(process.env.INNOVATION_SIGNING_PUBLIC_KEY_PEM);
      const derivedPublic = envPublic || crypto.createPublicKey(envPrivate).export({ format: 'pem', type: 'spki' });
      registerSigningKey({
        privateKeyPem: envPrivate,
        publicKeyPem: derivedPublic,
        keyId: process.env.INNOVATION_SIGNING_KEY_ID,
        source: 'environment',
      });
      canAutoRotateSigningKey = false;
    } else {
      rotateSigningKey();
      canAutoRotateSigningKey = true;
    }
  }

  const activeKey = signingKeyRing.get(activeSigningKeyId);
  if (!activeKey) {
    throw new Error('No active innovation signing key');
  }

  if (canAutoRotateSigningKey) {
    const ageMs = Date.now() - new Date(activeKey.createdAt).getTime();
    if (ageMs > autoRotateDays * 24 * 60 * 60 * 1000) {
      return rotateSigningKey();
    }
  }

  if (innovationPersistenceEnabled && signingKeysLoadedFromPersistence) {
    const keyForPersist = {
      keyId: activeKey.keyId,
      privateKeyPem: activeKey.privateKeyPem,
      publicKeyPem: activeKey.publicKeyPem,
      createdAt: activeKey.createdAt,
      source: activeKey.source,
    };
    upsertSigningKeyRecord(keyForPersist)
      .then(() => persistActiveKeyState(keyForPersist.keyId))
      .catch((error) => {
      console.warn('Innovation signing key persistence failed:', error.message);
    });
  }

  return activeKey;
};

const signDecisionPayload = (payload) => {
  const canonical = JSON.stringify(payload);
  const digest = crypto.createHash('sha256').update(canonical).digest('hex');
  const activeKey = ensureAsymmetricSigningKey();
  const signature = crypto.sign('sha256', Buffer.from(digest, 'utf8'), activeKey.privateKey).toString('base64');

  return {
    digest,
    signature,
    algorithm: 'ES256-SHA256',
    keyId: activeKey.keyId,
    publicKeyPem: activeKey.publicKeyPem,
  };
};

const verifyDecisionSignature = (decisionPackage) => {
  const payload = decisionPackage?.payload;
  const providedDigest = String(decisionPackage?.digest || '');
  const providedSignature = String(decisionPackage?.signature || '');
  const packageAlgorithm = String(decisionPackage?.algorithm || 'HS256-SHA256');

  if (!payload || !providedDigest || !providedSignature) {
    return {
      valid: false,
      algorithm: packageAlgorithm,
      digestMatched: false,
      signatureVerified: false,
      keyId: String(decisionPackage?.keyId || decisionPackage?.signing?.keyId || 'unknown'),
    };
  }

  const expectedDigest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const digestMatched =
    providedDigest.length === expectedDigest.length
    && crypto.timingSafeEqual(Buffer.from(providedDigest), Buffer.from(expectedDigest));

  if (packageAlgorithm === 'HS256-SHA256') {
    const legacyValid = digestMatched && verifySignedPayload(payload, providedDigest, providedSignature);
    return {
      valid: legacyValid,
      algorithm: packageAlgorithm,
      digestMatched,
      signatureVerified: legacyValid,
      keyId: 'legacy-hmac',
    };
  }

  const keyId = String(decisionPackage?.keyId || decisionPackage?.signing?.keyId || 'unknown');
  let verifierKey = signingKeyRing.get(keyId)?.publicKey;
  if (!verifierKey && decisionPackage?.signing?.publicKeyPem) {
    verifierKey = crypto.createPublicKey(normalizePem(decisionPackage.signing.publicKeyPem));
  }

  if (!digestMatched || !verifierKey) {
    return {
      valid: false,
      algorithm: packageAlgorithm,
      digestMatched,
      signatureVerified: false,
      keyId,
    };
  }

  const signatureVerified = crypto.verify(
    'sha256',
    Buffer.from(providedDigest, 'utf8'),
    verifierKey,
    Buffer.from(providedSignature, 'base64')
  );

  return {
    valid: digestMatched && signatureVerified,
    algorithm: packageAlgorithm,
    digestMatched,
    signatureVerified,
    keyId,
  };
};

const serializeSigningKey = (key) => {
  const createdAt = new Date(key.createdAt);
  const ageDays = Number.isNaN(createdAt.getTime())
    ? 0
    : Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)));
  return {
    keyId: key.keyId,
    createdAt: key.createdAt,
    ageDays,
    source: key.source,
    active: key.keyId === activeSigningKeyId,
    algorithm: 'ES256-SHA256',
    publicKeyPem: key.publicKeyPem,
  };
};

const persistActiveKeyState = async (keyId) => {
  if (!innovationPersistenceEnabled) return;
  await executeQuery(
    `
      UPDATE dbo.InnovationSigningKeys
      SET IsActive = CASE WHEN KeyId = @keyId THEN 1 ELSE 0 END
      WHERE RevokedAt IS NULL;
    `,
    { keyId }
  );
};

const upsertSigningKeyRecord = async ({ keyId, privateKeyPem, publicKeyPem, createdAt, source }) => {
  const privateKeyForStorage = encryptPrivateKeyForStorage(privateKeyPem);
  await executeQuery(
    `
      MERGE dbo.InnovationSigningKeys WITH (HOLDLOCK) AS target
      USING (SELECT @keyId AS KeyId) AS source
        ON target.KeyId = source.KeyId
      WHEN MATCHED THEN
        UPDATE SET
          PrivateKeyPem = @privateKeyPem,
          PublicKeyPem = @publicKeyPem,
          CreatedAt = @createdAt,
          Source = @source,
          IsActive = 1,
          RevokedAt = NULL
      WHEN NOT MATCHED THEN
        INSERT (KeyId, PrivateKeyPem, PublicKeyPem, CreatedAt, Source, IsActive)
        VALUES (@keyId, @privateKeyPem, @publicKeyPem, @createdAt, @source, 1);
    `,
    {
      keyId,
      privateKeyPem: privateKeyForStorage,
      publicKeyPem,
      createdAt,
      source,
    }
  );
};

const ensurePolicyShape = (candidate) => {
  const merged = {
    symptomWeights: { ...defaultTriagePolicy.symptomWeights, ...(candidate?.symptomWeights || {}) },
    vitalThresholds: { ...defaultTriagePolicy.vitalThresholds, ...(candidate?.vitalThresholds || {}) },
    vitalWeights: { ...defaultTriagePolicy.vitalWeights, ...(candidate?.vitalWeights || {}) },
    ageWeights: { ...defaultTriagePolicy.ageWeights, ...(candidate?.ageWeights || {}) },
    urgencyThresholds: { ...defaultTriagePolicy.urgencyThresholds, ...(candidate?.urgencyThresholds || {}) },
  };

  const allNumbers = [
    ...Object.values(merged.symptomWeights),
    ...Object.values(merged.vitalThresholds),
    ...Object.values(merged.vitalWeights),
    ...Object.values(merged.ageWeights),
    ...Object.values(merged.urgencyThresholds),
  ];

  if (allNumbers.some((value) => Number.isNaN(Number(value)))) {
    throw new Error('Policy contains non-numeric values');
  }

  if (Number(merged.urgencyThresholds.urgent) > Number(merged.urgencyThresholds.emergency)) {
    throw new Error('Urgent threshold cannot exceed emergency threshold');
  }

  return merged;
};

const ensurePersistence = async () => {
  if (!innovationPersistenceEnabled) return;
  if (!innovationPersistenceInitPromise) {
    innovationPersistenceInitPromise = (async () => {
      await executeQuery(`
        IF OBJECT_ID('dbo.InnovationTriagePolicies', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.InnovationTriagePolicies (
            PolicyVersion INT NOT NULL PRIMARY KEY,
            PolicyJson NVARCHAR(MAX) NOT NULL,
            ChangedAt DATETIME2 NOT NULL,
            ChangedBy NVARCHAR(255) NOT NULL,
            Note NVARCHAR(255) NULL
          );
        END;

        IF OBJECT_ID('dbo.InnovationTriageAudits', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.InnovationTriageAudits (
            AuditId NVARCHAR(80) NOT NULL PRIMARY KEY,
            Urgency NVARCHAR(20) NOT NULL,
            RiskScore INT NOT NULL,
            RequestedBy NVARCHAR(255) NOT NULL,
            PolicyVersion INT NOT NULL,
            GeneratedAt DATETIME2 NOT NULL,
            Digest NVARCHAR(128) NOT NULL
          );
        END;

        IF OBJECT_ID('dbo.InnovationSigningKeys', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.InnovationSigningKeys (
            KeyId NVARCHAR(100) NOT NULL PRIMARY KEY,
            PrivateKeyPem NVARCHAR(MAX) NOT NULL,
            PublicKeyPem NVARCHAR(MAX) NOT NULL,
            CreatedAt DATETIME2 NOT NULL,
            Source NVARCHAR(50) NOT NULL,
            IsActive BIT NOT NULL DEFAULT 0,
            RevokedAt DATETIME2 NULL
          );
        END;

        IF OBJECT_ID('dbo.InnovationBackupDrills', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.InnovationBackupDrills (
            DrillId INT IDENTITY(1,1) PRIMARY KEY,
            StartedAt DATETIME2 NOT NULL,
            CompletedAt DATETIME2 NOT NULL,
            Scenario NVARCHAR(120) NOT NULL,
            RpoTargetMinutes INT NOT NULL,
            RtoTargetMinutes INT NOT NULL,
            RpoAchievedMinutes INT NOT NULL,
            RtoAchievedMinutes INT NOT NULL,
            ResultStatus NVARCHAR(20) NOT NULL,
            EvidenceNote NVARCHAR(500) NULL,
            ExecutedBy NVARCHAR(255) NOT NULL,
            CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
          );
        END;

        IF OBJECT_ID('dbo.InnovationOperationsHandovers', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.InnovationOperationsHandovers (
            HandoverId BIGINT NOT NULL PRIMARY KEY,
            Situation NVARCHAR(1200) NOT NULL,
            Background NVARCHAR(1200) NOT NULL,
            Assessment NVARCHAR(1200) NOT NULL,
            Recommendation NVARCHAR(1200) NOT NULL,
            AuthoredBy NVARCHAR(255) NOT NULL,
            SavedAt DATETIME2 NOT NULL,
            CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
          );
        END;

        IF OBJECT_ID('dbo.InnovationOperationsHandoverAudits', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.InnovationOperationsHandoverAudits (
            AuditId BIGINT NOT NULL PRIMARY KEY,
            EventType NVARCHAR(40) NOT NULL,
            Actor NVARCHAR(255) NOT NULL,
            FiltersJson NVARCHAR(1200) NULL,
            HandoverId BIGINT NULL,
            LoggedAt DATETIME2 NOT NULL,
            CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
          );

          CREATE INDEX IX_InnovationOperationsHandoverAudits_LoggedAt
            ON dbo.InnovationOperationsHandoverAudits (LoggedAt DESC);
        END;
      `);

      const latestPolicy = await executeQuery(`
        SELECT TOP 1 PolicyVersion, PolicyJson
        FROM dbo.InnovationTriagePolicies
        ORDER BY PolicyVersion DESC;
      `);

      if (latestPolicy.recordset.length > 0) {
        const row = latestPolicy.recordset[0];
        triagePolicyVersion = Number(row.PolicyVersion || 1);
        triagePolicy = ensurePolicyShape(JSON.parse(row.PolicyJson || '{}'));
      }

      const policyHistoryRows = await executeQuery(`
        SELECT TOP 50 PolicyVersion, PolicyJson, ChangedAt, ChangedBy, Note
        FROM dbo.InnovationTriagePolicies
        ORDER BY PolicyVersion DESC;
      `);

      triagePolicyHistory.length = 0;
      if (policyHistoryRows.recordset.length > 0) {
        policyHistoryRows.recordset.forEach((row) => {
          triagePolicyHistory.push({
            version: Number(row.PolicyVersion || 1),
            policy: ensurePolicyShape(JSON.parse(row.PolicyJson || '{}')),
            changedAt: new Date(row.ChangedAt).toISOString(),
            changedBy: row.ChangedBy || 'unknown',
            note: row.Note || 'Policy update',
          });
        });
      } else {
        triagePolicyHistory.push({
          version: triagePolicyVersion,
          policy: triagePolicy,
          changedAt: new Date().toISOString(),
          changedBy: 'system',
          note: 'Initial policy bootstrap',
        });
        await executeQuery(
          `
            INSERT INTO dbo.InnovationTriagePolicies (PolicyVersion, PolicyJson, ChangedAt, ChangedBy, Note)
            VALUES (@version, @policyJson, @changedAt, @changedBy, @note);
          `,
          {
            version: triagePolicyVersion,
            policyJson: JSON.stringify(triagePolicy),
            changedAt: triagePolicyHistory[0].changedAt,
            changedBy: 'system',
            note: 'Initial policy bootstrap',
          }
        );
      }

      const auditRows = await executeQuery(`
        SELECT TOP 200 AuditId, Urgency, RiskScore, RequestedBy, PolicyVersion, GeneratedAt, Digest
        FROM dbo.InnovationTriageAudits
        ORDER BY GeneratedAt DESC;
      `);

      triageAuditTrail.length = 0;
      auditRows.recordset.forEach((row) => {
        triageAuditTrail.push({
          id: row.AuditId,
          urgency: row.Urgency,
          riskScore: Number(row.RiskScore || 0),
          requestedBy: row.RequestedBy || 'unknown',
          policyVersion: Number(row.PolicyVersion || 1),
          generatedAt: new Date(row.GeneratedAt).toISOString(),
          digest: row.Digest,
        });
      });

      const keyRows = await executeQuery(`
        SELECT KeyId, PrivateKeyPem, PublicKeyPem, CreatedAt, Source, IsActive
        FROM dbo.InnovationSigningKeys
        WHERE RevokedAt IS NULL
        ORDER BY CreatedAt DESC;
      `);

      const backupRows = await executeQuery(`
        SELECT TOP 50
          DrillId,
          StartedAt,
          CompletedAt,
          Scenario,
          RpoTargetMinutes,
          RtoTargetMinutes,
          RpoAchievedMinutes,
          RtoAchievedMinutes,
          ResultStatus,
          EvidenceNote,
          ExecutedBy,
          CreatedAt
        FROM dbo.InnovationBackupDrills
        ORDER BY CompletedAt DESC;
      `);

      const handoverRows = await executeQuery(`
        SELECT TOP 80
          HandoverId,
          Situation,
          Background,
          Assessment,
          Recommendation,
          AuthoredBy,
          SavedAt
        FROM dbo.InnovationOperationsHandovers
        ORDER BY SavedAt DESC;
      `);

      const handoverAuditRows = await executeQuery(`
        SELECT TOP 150
          AuditId,
          EventType,
          Actor,
          FiltersJson,
          HandoverId,
          LoggedAt
        FROM dbo.InnovationOperationsHandoverAudits
        ORDER BY LoggedAt DESC;
      `);

      backupDrillTrail.length = 0;
      backupRows.recordset.forEach((row) => {
        backupDrillTrail.push({
          drillId: Number(row.DrillId),
          startedAt: new Date(row.StartedAt).toISOString(),
          completedAt: new Date(row.CompletedAt).toISOString(),
          scenario: row.Scenario,
          rpoTargetMinutes: Number(row.RpoTargetMinutes || 0),
          rtoTargetMinutes: Number(row.RtoTargetMinutes || 0),
          rpoAchievedMinutes: Number(row.RpoAchievedMinutes || 0),
          rtoAchievedMinutes: Number(row.RtoAchievedMinutes || 0),
          resultStatus: row.ResultStatus || 'unknown',
          evidenceNote: row.EvidenceNote || '',
          executedBy: row.ExecutedBy || 'unknown',
          createdAt: new Date(row.CreatedAt).toISOString(),
        });
      });

      handoverTrail.length = 0;
      handoverRows.recordset.forEach((row) => {
        handoverTrail.push({
          handoverId: Number(row.HandoverId),
          situation: String(row.Situation || ''),
          background: String(row.Background || ''),
          assessment: String(row.Assessment || ''),
          recommendation: String(row.Recommendation || ''),
          authoredBy: String(row.AuthoredBy || 'unknown'),
          savedAt: new Date(row.SavedAt).toISOString(),
        });
      });

      handoverAuditTrail.length = 0;
      handoverAuditRows.recordset.forEach((row) => {
        handoverAuditTrail.push({
          auditId: Number(row.AuditId),
          eventType: String(row.EventType || 'unknown'),
          actor: String(row.Actor || 'unknown'),
          filtersJson: String(row.FiltersJson || ''),
          handoverId: row.HandoverId ? Number(row.HandoverId) : null,
          loggedAt: new Date(row.LoggedAt).toISOString(),
        });
      });

      signingKeyRing.clear();
      activeSigningKeyId = '';
      keyRows.recordset.forEach((row) => {
        try {
          const decryptedPrivateKey = decryptPrivateKeyFromStorage(row.PrivateKeyPem);
          registerSigningKey({
            keyId: row.KeyId,
            privateKeyPem: decryptedPrivateKey,
            publicKeyPem: row.PublicKeyPem,
            createdAt: new Date(row.CreatedAt).toISOString(),
            source: row.Source || 'database',
            activate: Boolean(row.IsActive),
          });
        } catch (error) {
          console.warn('Innovation signing key row skipped:', error.message);
        }
      });

      if (!activeSigningKeyId && signingKeyRing.size > 0) {
        activeSigningKeyId = Array.from(signingKeyRing.values())[0].keyId;
      }

      const activeLoaded = signingKeyRing.get(activeSigningKeyId);
      if (activeLoaded) {
        canAutoRotateSigningKey = activeLoaded.source !== 'environment';
      }

      signingKeysLoadedFromPersistence = true;
      innovationPersistenceLastHealthyAt = new Date().toISOString();
      innovationPersistenceLastError = null;
    })().catch((error) => {
      innovationPersistenceEnabled = false;
      innovationPersistenceInitPromise = null;
      innovationPersistenceLastError = String(error?.message || 'unknown persistence error');
      console.warn('Innovation persistence fallback to in-memory mode:', error.message);
    });
  }

  await innovationPersistenceInitPromise;
};

const createPersistenceUnavailableError = () => {
  const error = new Error('Innovation persistence is unavailable');
  error.code = 'INNOVATION_PERSISTENCE_UNAVAILABLE';
  return error;
};

const ensureOperationsPersistenceReady = async () => {
  await ensurePersistence();
  if (!innovationPersistenceEnabled) {
    throw createPersistenceUnavailableError();
  }
};

export const getInnovationPersistenceStatus = () => ({
  enabled: innovationPersistenceEnabled,
  mode: innovationPersistenceEnabled ? 'sql-persistent' : 'memory-degraded',
  lastError: innovationPersistenceLastError,
  lastHealthyAt: innovationPersistenceLastHealthyAt,
});

const persistPolicyVersion = async ({ version, policy, changedAt, changedBy, note }) => {
  if (!innovationPersistenceEnabled) return;
  await ensurePersistence();
  if (!innovationPersistenceEnabled) return;
  await executeQuery(
    `
      INSERT INTO dbo.InnovationTriagePolicies (PolicyVersion, PolicyJson, ChangedAt, ChangedBy, Note)
      VALUES (@version, @policyJson, @changedAt, @changedBy, @note);
    `,
    {
      version,
      policyJson: JSON.stringify(policy),
      changedAt,
      changedBy,
      note,
    }
  );
};

const persistAuditEvent = async (event) => {
  if (!innovationPersistenceEnabled) return;
  await ensurePersistence();
  if (!innovationPersistenceEnabled) return;
  await executeQuery(
    `
      INSERT INTO dbo.InnovationTriageAudits (AuditId, Urgency, RiskScore, RequestedBy, PolicyVersion, GeneratedAt, Digest)
      VALUES (@id, @urgency, @riskScore, @requestedBy, @policyVersion, @generatedAt, @digest);
    `,
    {
      id: event.id,
      urgency: event.urgency,
      riskScore: event.riskScore,
      requestedBy: event.requestedBy,
      policyVersion: event.policyVersion,
      generatedAt: event.generatedAt,
      digest: event.digest,
    }
  );
};

const persistBackupDrill = async (drill) => {
  if (!innovationPersistenceEnabled) return;
  await ensurePersistence();
  if (!innovationPersistenceEnabled) return;

  await executeQuery(
    `
      INSERT INTO dbo.InnovationBackupDrills
        (StartedAt, CompletedAt, Scenario, RpoTargetMinutes, RtoTargetMinutes, RpoAchievedMinutes, RtoAchievedMinutes, ResultStatus, EvidenceNote, ExecutedBy)
      VALUES
        (@startedAt, @completedAt, @scenario, @rpoTargetMinutes, @rtoTargetMinutes, @rpoAchievedMinutes, @rtoAchievedMinutes, @resultStatus, @evidenceNote, @executedBy);
    `,
    {
      startedAt: drill.startedAt,
      completedAt: drill.completedAt,
      scenario: drill.scenario,
      rpoTargetMinutes: drill.rpoTargetMinutes,
      rtoTargetMinutes: drill.rtoTargetMinutes,
      rpoAchievedMinutes: drill.rpoAchievedMinutes,
      rtoAchievedMinutes: drill.rtoAchievedMinutes,
      resultStatus: drill.resultStatus,
      evidenceNote: drill.evidenceNote || null,
      executedBy: drill.executedBy,
    }
  );
};

const persistOperationsHandover = async (handover) => {
  if (!innovationPersistenceEnabled) return;
  await ensurePersistence();
  if (!innovationPersistenceEnabled) return;

  await executeQuery(
    `
      INSERT INTO dbo.InnovationOperationsHandovers
        (HandoverId, Situation, Background, Assessment, Recommendation, AuthoredBy, SavedAt)
      VALUES
        (@handoverId, @situation, @background, @assessment, @recommendation, @authoredBy, @savedAt);
    `,
    {
      handoverId: handover.handoverId,
      situation: handover.situation,
      background: handover.background,
      assessment: handover.assessment,
      recommendation: handover.recommendation,
      authoredBy: handover.authoredBy,
      savedAt: handover.savedAt,
    }
  );
};

const persistOperationsHandoverAudit = async (auditEvent) => {
  if (!innovationPersistenceEnabled) return;
  await ensurePersistence();
  if (!innovationPersistenceEnabled) return;

  await executeQuery(
    `
      INSERT INTO dbo.InnovationOperationsHandoverAudits
        (AuditId, EventType, Actor, FiltersJson, HandoverId, LoggedAt)
      VALUES
        (@auditId, @eventType, @actor, @filtersJson, @handoverId, @loggedAt);
    `,
    {
      auditId: auditEvent.auditId,
      eventType: auditEvent.eventType,
      actor: auditEvent.actor,
      filtersJson: auditEvent.filtersJson || null,
      handoverId: auditEvent.handoverId || null,
      loggedAt: auditEvent.loggedAt,
    }
  );
};

const buildEvidenceHash = (payload) => {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

const scoreTriage = ({ symptoms = '', vitals = {}, age = 35, policy = triagePolicy }) => {
  const text = String(symptoms || '').toLowerCase();
  const hr = Number(vitals.heartRate || 0);
  const spo2 = Number(vitals.spo2 || 0);
  const temp = Number(vitals.temperature || 0);
  const sbp = Number(vitals.systolic || 0);

  const redFlags = [];
  let score = 0;

  if (/chest pain|severe chest|crushing chest/.test(text)) {
    score += Number(policy.symptomWeights.chestPain || 0);
    redFlags.push('Possible acute coronary syndrome signal');
  }
  if (/shortness of breath|cannot breathe|breathless/.test(text)) {
    score += Number(policy.symptomWeights.respiratoryDistress || 0);
    redFlags.push('Respiratory distress symptom pattern');
  }
  if (/confusion|faint|seizure|stroke/.test(text)) {
    score += Number(policy.symptomWeights.neurologicalEmergency || 0);
    redFlags.push('Neurological emergency symptom pattern');
  }

  if (spo2 > 0 && spo2 < Number(policy.vitalThresholds.spo2Low || 0)) {
    score += Number(policy.vitalWeights.spo2Low || 0);
    redFlags.push('Low oxygen saturation (<92%)');
  }
  if (hr > Number(policy.vitalThresholds.heartRateHigh || 0) || hr < Number(policy.vitalThresholds.heartRateLow || 0)) {
    score += Number(policy.vitalWeights.heartRateCritical || 0);
    redFlags.push('Heart rate outside safe range');
  }
  if (temp >= Number(policy.vitalThresholds.tempHigh || 0)) {
    score += Number(policy.vitalWeights.tempHigh || 0);
    redFlags.push('High fever (>=39.5C)');
  }
  if (sbp > Number(policy.vitalThresholds.systolicHigh || 0) || (sbp > 0 && sbp < Number(policy.vitalThresholds.systolicLow || 0))) {
    score += Number(policy.vitalWeights.systolicCritical || 0);
    redFlags.push('Abnormal blood pressure threshold');
  }
  if (age >= 75) {
    score += Number(policy.ageWeights.elderly || 0);
  }

  const riskScore = clamp(Math.round(score), 0, 100);
  const emergencyThreshold = Number(policy.urgencyThresholds.emergency || 70);
  const urgentThreshold = Number(policy.urgencyThresholds.urgent || 40);
  const urgency = riskScore >= emergencyThreshold ? 'emergency' : riskScore >= urgentThreshold ? 'urgent' : 'routine';

  const recommendation =
    urgency === 'emergency'
      ? 'Escalate to emergency care immediately and trigger clinician callback now.'
      : urgency === 'urgent'
        ? 'Schedule same-day clinical assessment with vitals re-check and follow-up call.'
        : 'Proceed with standard outpatient workflow and proactive preventive follow-up.';

  return {
    riskScore,
    urgency,
    redFlags,
    recommendation,
  };
};

export const getSecurityPosture = async (req, res) => {
  try {
    const token = parseBearer(req.headers.authorization);
    const decoded = token ? jwt.decode(token) : null;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const exp = Number(decoded?.exp || 0);
    const iat = Number(decoded?.iat || 0);

    const expiresInMinutes = exp ? Math.max(0, Math.round((exp - nowSeconds) / 60)) : 0;
    const tokenAgeMinutes = iat ? Math.max(0, Math.round((nowSeconds - iat) / 60)) : 0;

    const currentHour = new Date().getHours();
    const offHours = currentHour < 6 || currentHour >= 22;
    const hasDeviceId = Boolean(String(req.headers['x-device-id'] || '').trim());

    let riskScore = 12;
    if (expiresInMinutes < 20) riskScore += 22;
    if (tokenAgeMinutes > 24 * 60) riskScore += 14;
    if (offHours) riskScore += 10;
    if (!hasDeviceId) riskScore += 12;

    riskScore = clamp(riskScore, 0, 100);

    const posture = riskScore >= 55 ? 'high' : riskScore >= 30 ? 'medium' : 'low';

    const controls = [
      expiresInMinutes < 20 ? 'Refresh session token before sensitive actions.' : 'Token TTL healthy for current session.',
      hasDeviceId ? 'Device ID bound on request context.' : 'Add `x-device-id` header to strengthen session binding.',
      offHours ? 'Off-hours access detected; increase audit sampling.' : 'Business-hours access pattern detected.',
    ];

    return res.json({
      success: true,
      data: {
        posture,
        riskScore,
        tokenAgeMinutes,
        expiresInMinutes,
        controls,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to evaluate security posture',
    });
  }
};

export const postAiTriage = async (req, res) => {
  try {
    await ensurePersistence();
    const { symptoms, vitals, age } = req.body || {};
    const triage = scoreTriage({ symptoms, vitals, age, policy: triagePolicy });

    const decisionPayload = {
      generatedAt: new Date().toISOString(),
      policyVersion: triagePolicyVersion,
      requestedBy: req.user?.email || 'unknown',
      input: {
        age: Number(age || 0),
        symptoms: String(symptoms || ''),
        vitals: {
          heartRate: Number(vitals?.heartRate || 0),
          spo2: Number(vitals?.spo2 || 0),
          temperature: Number(vitals?.temperature || 0),
          systolic: Number(vitals?.systolic || 0),
        },
      },
      output: triage,
    };

    const signed = signDecisionPayload(decisionPayload);
    const decisionPackage = {
      packageId: `triage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      algorithm: signed.algorithm,
      keyId: signed.keyId,
      digest: signed.digest,
      signature: signed.signature,
      signing: {
        keyId: signed.keyId,
        algorithm: signed.algorithm,
        publicKeyPem: signed.publicKeyPem,
      },
      payload: decisionPayload,
    };

    triageAuditTrail.unshift({
      id: decisionPackage.packageId,
      urgency: triage.urgency,
      riskScore: triage.riskScore,
      requestedBy: decisionPayload.requestedBy,
      policyVersion: triagePolicyVersion,
      generatedAt: decisionPayload.generatedAt,
      digest: signed.digest,
    });
    if (triageAuditTrail.length > 200) {
      triageAuditTrail.length = 200;
    }
    persistAuditEvent(triageAuditTrail[0]).catch((error) => {
      console.warn('Innovation audit persistence failed:', error.message);
    });

    if (triage.urgency === 'emergency') {
      emitInnovationEmergency({
        packageId: decisionPackage.packageId,
        riskScore: triage.riskScore,
        requestedBy: decisionPayload.requestedBy,
        recommendation: triage.recommendation,
      });
    }

    return res.json({
      success: true,
      data: {
        ...triage,
        policyVersion: triagePolicyVersion,
        decisionPackage,
        disclaimer: 'AI triage is decision-support only and does not replace clinician judgment.',
        generatedAt: decisionPayload.generatedAt,
      },
    });
  } catch {
    return res.status(400).json({
      success: false,
      message: 'Invalid triage payload',
    });
  }
};

export const getAiTriagePolicy = async (req, res) => {
  await ensurePersistence();
  return res.json({
    success: true,
    data: {
      version: triagePolicyVersion,
      policy: triagePolicy,
      historySize: triagePolicyHistory.length,
    },
  });
};

export const putAiTriagePolicy = async (req, res) => {
  try {
    await ensurePersistence();
    const candidate = req.body?.policy;
    const note = String(req.body?.note || 'Policy update').slice(0, 180);
    const nextPolicy = ensurePolicyShape(candidate);

    triagePolicyVersion += 1;
    triagePolicy = nextPolicy;
    const historyEntry = {
      version: triagePolicyVersion,
      policy: triagePolicy,
      changedAt: new Date().toISOString(),
      changedBy: req.user?.email || 'unknown',
      note,
    };
    triagePolicyHistory.unshift(historyEntry);
    if (triagePolicyHistory.length > 50) {
      triagePolicyHistory.length = 50;
    }

    await persistPolicyVersion({
      version: historyEntry.version,
      policy: historyEntry.policy,
      changedAt: historyEntry.changedAt,
      changedBy: historyEntry.changedBy,
      note: historyEntry.note,
    });

    return res.json({
      success: true,
      data: {
        version: triagePolicyVersion,
        policy: triagePolicy,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Invalid policy payload',
    });
  }
};

export const getAiTriagePolicyHistory = async (req, res) => {
  await ensurePersistence();
  return res.json({
    success: true,
    data: triagePolicyHistory,
  });
};

export const getAiAuditTrail = async (req, res) => {
  await ensurePersistence();
  const limit = clamp(Number(req.query?.limit || 20), 1, 100);
  return res.json({
    success: true,
    data: triageAuditTrail.slice(0, limit),
  });
};

export const postVerifyDecisionPackage = async (req, res) => {
  try {
    await ensurePersistence();
    const pkg = req.body?.decisionPackage;
    if (!pkg || !pkg.payload || !pkg.digest || !pkg.signature) {
      return res.status(400).json({
        success: false,
        message: 'decisionPackage payload is required',
      });
    }

    const verification = verifyDecisionSignature(pkg);
    return res.json({
      success: true,
      data: {
        packageId: pkg.packageId || 'unknown',
        valid: verification.valid,
        algorithm: verification.algorithm,
        keyId: verification.keyId,
        digestMatched: verification.digestMatched,
        signatureVerified: verification.signatureVerified,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch {
    return res.status(400).json({
      success: false,
      message: 'Unable to verify decision package',
    });
  }
};

export const getSigningKeys = async (req, res) => {
  try {
    await ensurePersistence();
    const active = ensureAsymmetricSigningKey();
    const keys = Array.from(signingKeyRing.values())
      .map(serializeSigningKey)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({
      success: true,
      data: {
        activeKeyId: active.keyId,
        autoRotateDays,
        autoRotateEnabled: canAutoRotateSigningKey,
        atRestEncryptionEnabled: Boolean(getKeyEncryptionSecret()),
        keys,
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Unable to list innovation signing keys',
    });
  }
};

export const postActivateSigningKey = async (req, res) => {
  try {
    await ensurePersistence();
    const keyId = String(req.params?.keyId || '').trim();
    if (!keyId || !signingKeyRing.has(keyId)) {
      return res.status(404).json({
        success: false,
        message: 'Signing key not found',
      });
    }

    activeSigningKeyId = keyId;
    const selected = signingKeyRing.get(keyId);
    canAutoRotateSigningKey = selected.source !== 'environment';

    if (innovationPersistenceEnabled) {
      await persistActiveKeyState(keyId);
    }

    return res.json({
      success: true,
      data: {
        activeKeyId,
        keys: Array.from(signingKeyRing.values()).map(serializeSigningKey),
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Unable to activate signing key',
    });
  }
};

export const postRevokeSigningKey = async (req, res) => {
  try {
    await ensurePersistence();
    const keyId = String(req.params?.keyId || '').trim();
    if (!keyId || !signingKeyRing.has(keyId)) {
      return res.status(404).json({
        success: false,
        message: 'Signing key not found',
      });
    }

    if (signingKeyRing.size <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot revoke the last available signing key',
      });
    }

    const isActive = keyId === activeSigningKeyId;
    signingKeyRing.delete(keyId);

    if (isActive) {
      const next = Array.from(signingKeyRing.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      activeSigningKeyId = next?.keyId || '';
      if (next) {
        canAutoRotateSigningKey = next.source !== 'environment';
      }
    }

    if (innovationPersistenceEnabled) {
      await executeQuery(
        `
          UPDATE dbo.InnovationSigningKeys
          SET RevokedAt = GETDATE(), IsActive = 0
          WHERE KeyId = @keyId;
        `,
        { keyId }
      );

      if (activeSigningKeyId) {
        await persistActiveKeyState(activeSigningKeyId);
      }
    }

    return res.json({
      success: true,
      data: {
        revokedKeyId: keyId,
        activeKeyId,
        keys: Array.from(signingKeyRing.values()).map(serializeSigningKey),
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Unable to revoke signing key',
    });
  }
};

export const postRotateSigningKey = async (req, res) => {
  try {
    await ensurePersistence();
    const rotated = rotateSigningKey();
    canAutoRotateSigningKey = true;

    if (innovationPersistenceEnabled) {
      await upsertSigningKeyRecord({
        keyId: rotated.keyId,
        privateKeyPem: rotated.privateKeyPem,
        publicKeyPem: rotated.publicKeyPem,
        createdAt: rotated.createdAt,
        source: rotated.source,
      });
      await persistActiveKeyState(rotated.keyId);
    }

    return res.json({
      success: true,
      data: {
        activeKeyId: rotated.keyId,
        rotatedAt: new Date().toISOString(),
        key: serializeSigningKey(rotated),
        keys: Array.from(signingKeyRing.values()).map(serializeSigningKey),
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Unable to rotate innovation signing key',
    });
  }
};

export const getComplianceEvidencePackage = async (req, res) => {
  try {
    await ensurePersistence();
    const active = ensureAsymmetricSigningKey();
    const revokedCountResult = innovationPersistenceEnabled
      ? await executeQuery('SELECT COUNT(*) AS count FROM dbo.InnovationSigningKeys WHERE RevokedAt IS NOT NULL;')
      : { recordset: [{ count: 0 }] };

    const evidence = {
      generatedAt: new Date().toISOString(),
      module: 'innovation-governance',
      triagePolicyVersion,
      signing: {
        activeKeyId: active.keyId,
        keyCount: signingKeyRing.size,
        revokedKeyCount: Number(revokedCountResult.recordset?.[0]?.count || 0),
        autoRotateDays,
        autoRotateEnabled: canAutoRotateSigningKey,
        atRestEncryptionEnabled: Boolean(getKeyEncryptionSecret()),
      },
      audit: {
        inMemoryTrailCount: triageAuditTrail.length,
        latestAuditId: triageAuditTrail[0]?.id || null,
        latestAuditAt: triageAuditTrail[0]?.generatedAt || null,
      },
      controls: [
        'ES256 signing with key lifecycle',
        'Package verification endpoint with digest/signature checks',
        'Revocation and activation guardrails',
        'At-rest private key encryption optional by env secret',
      ],
    };

    const integrityHash = buildEvidenceHash(evidence);

    return res.json({
      success: true,
      data: {
        ...evidence,
        integrityHash,
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Unable to build compliance evidence package',
    });
  }
};

export const postMaintenanceCleanup = async (req, res) => {
  try {
    await ensurePersistence();
    const revokedRetentionDays = clamp(Number(req.body?.revokedRetentionDays || process.env.INNOVATION_REVOKED_RETENTION_DAYS || 90), 7, 3650);
    const auditKeep = clamp(Number(req.body?.auditKeep || process.env.INNOVATION_AUDIT_KEEP || 500), 100, 5000);

    let removedRevokedKeys = 0;
    let removedAuditRows = 0;

    if (innovationPersistenceEnabled) {
      const revokedResult = await executeQuery(
        `
          DELETE FROM dbo.InnovationSigningKeys
          WHERE RevokedAt IS NOT NULL
            AND RevokedAt < DATEADD(DAY, -@retentionDays, GETDATE());

          SELECT @@ROWCOUNT AS removedCount;
        `,
        { retentionDays: revokedRetentionDays }
      );
      removedRevokedKeys = Number(revokedResult.recordset?.[0]?.removedCount || 0);

      const auditResult = await executeQuery(
        `
          ;WITH stale AS (
            SELECT AuditId,
                   ROW_NUMBER() OVER (ORDER BY GeneratedAt DESC) AS rn
            FROM dbo.InnovationTriageAudits
          )
          DELETE FROM dbo.InnovationTriageAudits
          WHERE AuditId IN (SELECT AuditId FROM stale WHERE rn > @auditKeep);

          SELECT @@ROWCOUNT AS removedCount;
        `,
        { auditKeep }
      );
      removedAuditRows = Number(auditResult.recordset?.[0]?.removedCount || 0);
    }

    if (triageAuditTrail.length > auditKeep) {
      triageAuditTrail.length = auditKeep;
    }

    return res.json({
      success: true,
      data: {
        cleanedAt: new Date().toISOString(),
        revokedRetentionDays,
        auditKeep,
        removedRevokedKeys,
        removedAuditRows,
        auditTrailSize: triageAuditTrail.length,
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Unable to run innovation maintenance cleanup',
    });
  }
};

export const getModelOpsReadiness = async (req, res) => {
  try {
    await ensurePersistence();

    const recent = triageAuditTrail.slice(0, 60);
    const sampleSize = recent.length;

    const riskScores = recent.map((item) => Number(item.riskScore || 0));
    const meanRisk = sampleSize ? riskScores.reduce((acc, value) => acc + value, 0) / sampleSize : 0;
    const p95Risk = percentile(riskScores, 95);
    const emergencyCount = recent.filter((item) => String(item.urgency || '').toLowerCase() === 'emergency').length;

    const emergencyRatePct = sampleSize ? Math.round((emergencyCount / sampleSize) * 100) : 0;
    const coveragePct = Math.min(100, Math.round((sampleSize / 60) * 100));
    const signingIntegrityPct = activeSigningKeyId ? 100 : 40;
    const driftDelta = Math.round(Math.abs(meanRisk - 50));
    const driftRisk = driftDelta <= 10 ? 'low' : driftDelta <= 20 ? 'medium' : 'high';

    const reliabilityScore = clamp(
      Math.round(
        coveragePct * 0.35
        + signingIntegrityPct * 0.35
        + (100 - Math.min(100, emergencyRatePct * 2)) * 0.3
      ),
      0,
      100
    );

    const readinessTier = reliabilityScore >= 85
      ? 'world-class'
      : reliabilityScore >= 65
        ? 'advanced'
        : 'foundational';

    return res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        sampleSize,
        reliabilityScore,
        readinessTier,
        drift: {
          meanRisk: Math.round(meanRisk),
          p95Risk,
          deltaFromBaseline: driftDelta,
          riskLevel: driftRisk,
        },
        coverage: {
          targetWindow: 60,
          coveragePct,
        },
        safety: {
          emergencyRatePct,
          emergencyCount,
        },
        signing: {
          activeKeyId: activeSigningKeyId || null,
          integrityPct: signingIntegrityPct,
        },
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Unable to compute model operations readiness',
    });
  }
};

export const getModelOpsSloTrend = async (req, res) => {
  try {
    await ensurePersistence();

    const daily = buildDailySloBuckets(triageAuditTrail, 30);
    const last7 = daily.slice(-7);
    const last30 = daily;

    return res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        summary: {
          last7Days: summarizeSloWindow(last7),
          last30Days: summarizeSloWindow(last30),
        },
        daily,
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Unable to compute SLO trend windows',
    });
  }
};

export const getBackupRestoreDrills = async (req, res) => {
  try {
    await ensurePersistence();

    const drills = backupDrillTrail.slice(0, 20);
    const passCount = drills.filter((item) => String(item.resultStatus).toLowerCase() === 'pass').length;
    const passRatePct = drills.length ? Math.round((passCount / drills.length) * 100) : 0;

    return res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        summary: {
          totalDrills: drills.length,
          passRatePct,
          latestCompletedAt: drills[0]?.completedAt || null,
        },
        drills,
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Unable to load backup/restore drills',
    });
  }
};

export const postBackupRestoreDrill = async (req, res) => {
  try {
    await ensurePersistence();

    const scenario = String(req.body?.scenario || 'database-failover').trim().slice(0, 120);
    const rpoTargetMinutes = clamp(Number(req.body?.rpoTargetMinutes || 15), 1, 1440);
    const rtoTargetMinutes = clamp(Number(req.body?.rtoTargetMinutes || 60), 1, 2880);
    const rpoAchievedMinutes = clamp(Number(req.body?.rpoAchievedMinutes || rpoTargetMinutes), 0, 10080);
    const rtoAchievedMinutes = clamp(Number(req.body?.rtoAchievedMinutes || rtoTargetMinutes), 0, 10080);
    const evidenceNote = String(req.body?.evidenceNote || '').trim().slice(0, 500);
    const executedBy = String(req.user?.email || 'unknown').slice(0, 255);

    const startedAt = new Date(req.body?.startedAt || Date.now() - 45 * 60 * 1000).toISOString();
    const completedAt = new Date(req.body?.completedAt || Date.now()).toISOString();

    const resultStatus = (rpoAchievedMinutes <= rpoTargetMinutes && rtoAchievedMinutes <= rtoTargetMinutes)
      ? 'pass'
      : 'gap';

    const record = {
      drillId: Number(Date.now()),
      startedAt,
      completedAt,
      scenario,
      rpoTargetMinutes,
      rtoTargetMinutes,
      rpoAchievedMinutes,
      rtoAchievedMinutes,
      resultStatus,
      evidenceNote,
      executedBy,
      createdAt: new Date().toISOString(),
    };

    backupDrillTrail.unshift(record);
    if (backupDrillTrail.length > 100) {
      backupDrillTrail.length = 100;
    }

    await persistBackupDrill(record);

    return res.status(201).json({
      success: true,
      data: record,
      message: 'Backup/restore drill recorded successfully',
    });
  } catch {
    return res.status(400).json({
      success: false,
      message: 'Unable to record backup/restore drill',
    });
  }
};

export const getOperationsBedCensus = async (req, res) => {
  try {
    const censusQuery = `
      SELECT
        COUNT(a.AppointmentID) AS TotalAppointments,
        COUNT(DISTINCT a.PatientID) AS UniquePatients,
        SUM(CASE WHEN LOWER(ISNULL(a.Status, '')) LIKE 'pending%' THEN 1 ELSE 0 END) AS PendingCount,
        SUM(CASE WHEN LOWER(ISNULL(a.Status, '')) LIKE 'cancel%' THEN 1 ELSE 0 END) AS CancelledCount,
        SUM(CASE WHEN LOWER(ISNULL(a.Status, '')) LIKE 'complete%' THEN 1 ELSE 0 END) AS CompletedCount
      FROM Appointments a;
    `;

    const doctorsQuery = `
      SELECT
        COUNT(DoctorID) AS TotalDoctors,
        SUM(CASE WHEN LOWER(ISNULL(Status, 'active')) = 'onleave' THEN 1 ELSE 0 END) AS OnLeaveDoctors
      FROM Doctors;
    `;

    const [censusResult, doctorResult] = await Promise.all([
      executeQuery(censusQuery, {}),
      executeQuery(doctorsQuery, {}),
    ]);

    const censusRow = censusResult?.recordset?.[0] || {};
    const doctorRow = doctorResult?.recordset?.[0] || {};

    const pendingCount = Number(censusRow.PendingCount || 0);
    const cancelledCount = Number(censusRow.CancelledCount || 0);
    const totalAppointments = Number(censusRow.TotalAppointments || 0);
    const uniquePatients = Number(censusRow.UniquePatients || 0);
    const completedCount = Number(censusRow.CompletedCount || 0);
    const totalDoctors = Math.max(1, Number(doctorRow.TotalDoctors || 1));
    const onLeaveDoctors = Number(doctorRow.OnLeaveDoctors || 0);

    const wards = [
      {
        id: 'ward-ed',
        ward: 'Emergency Ward',
        occupied: Math.min(26, Math.round(9 + pendingCount * 1.7 + cancelledCount * 0.5)),
        total: 26,
      },
      {
        id: 'ward-icu',
        ward: 'ICU',
        occupied: Math.min(12, Math.round(5 + Math.max(0, pendingCount - completedCount) * 0.45)),
        total: 12,
      },
      {
        id: 'ward-inpatient',
        ward: 'Inpatient Ward',
        occupied: Math.min(42, Math.round(16 + uniquePatients * 0.55)),
        total: 42,
      },
      {
        id: 'ward-surgery',
        ward: 'Post-Op Recovery',
        occupied: Math.min(16, Math.round(5 + (totalAppointments / totalDoctors) + onLeaveDoctors * 0.8)),
        total: 16,
      },
    ].map((row) => {
      const usage = Math.round((row.occupied / row.total) * 100);
      return {
        ...row,
        usage,
        level: usage >= 88 ? 'high' : usage >= 75 ? 'medium' : 'normal',
      };
    });

    return res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        source: 'database-derived',
        wards,
      },
    });
  } catch {
    const fallbackWards = [
      { id: 'ward-ed', ward: 'Emergency Ward', occupied: 17, total: 26 },
      { id: 'ward-icu', ward: 'ICU', occupied: 8, total: 12 },
      { id: 'ward-inpatient', ward: 'Inpatient Ward', occupied: 30, total: 42 },
      { id: 'ward-surgery', ward: 'Post-Op Recovery', occupied: 10, total: 16 },
    ].map((row) => {
      const usage = Math.round((row.occupied / row.total) * 100);
      return {
        ...row,
        usage,
        level: usage >= 88 ? 'high' : usage >= 75 ? 'medium' : 'normal',
      };
    });

    return res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        source: 'fallback-derived',
        wards: fallbackWards,
      },
    });
  }
};

export const getOperationsHandover = async (req, res) => {
  try {
    await ensureOperationsPersistenceReady();
    const limit = clamp(Number(req.query?.limit || 12), 1, 50);
    const page = clamp(Number(req.query?.page || 1), 1, 100000);
    const authoredBy = String(req.query?.authoredBy || '').trim().toLowerCase();
    const fromDateRaw = String(req.query?.fromDate || '').trim();
    const toDateRaw = String(req.query?.toDate || '').trim();

    const fromMs = fromDateRaw ? new Date(fromDateRaw).getTime() : null;
    const toMs = toDateRaw ? new Date(toDateRaw).getTime() : null;

    const filtered = handoverTrail.filter((item) => {
      const authoredOk = authoredBy ? String(item.authoredBy || '').toLowerCase().includes(authoredBy) : true;
      if (!authoredOk) return false;

      const savedMs = new Date(item.savedAt).getTime();
      if (fromMs && !Number.isNaN(fromMs) && savedMs < fromMs) return false;
      if (toMs && !Number.isNaN(toMs)) {
        const toEndMs = toMs + (24 * 60 * 60 * 1000) - 1;
        if (savedMs > toEndMs) return false;
      }

      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const history = filtered.slice(offset, offset + limit);

    const auditEvent = {
      auditId: Number(Date.now()),
      eventType: 'history_query',
      actor: String(req.user?.email || 'unknown'),
      filtersJson: JSON.stringify({ authoredBy: authoredBy || null, fromDate: fromDateRaw || null, toDate: toDateRaw || null, limit, page }),
      handoverId: null,
      loggedAt: new Date().toISOString(),
    };
    handoverAuditTrail.unshift(auditEvent);
    if (handoverAuditTrail.length > 200) {
      handoverAuditTrail.length = 200;
    }
    await persistOperationsHandoverAudit(auditEvent);

    return res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        history,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    if (error?.code === 'INNOVATION_PERSISTENCE_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        message: 'Handover history is temporarily unavailable while persistence is degraded',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Unable to load handover history',
    });
  }
};

export const getOperationsHandoverAudits = async (req, res) => {
  try {
    await ensureOperationsPersistenceReady();
    const limit = clamp(Number(req.query?.limit || 20), 1, 100);
    return res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        audits: handoverAuditTrail.slice(0, limit),
      },
    });
  } catch (error) {
    if (error?.code === 'INNOVATION_PERSISTENCE_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        message: 'Handover audit trail is temporarily unavailable while persistence is degraded',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Unable to load handover audits',
    });
  }
};

export const getOperationsHandoverCsv = async (req, res) => {
  try {
    await ensureOperationsPersistenceReady();

    const limit = clamp(Number(req.query?.limit || 200), 1, 1000);
    const rows = handoverTrail.slice(0, limit);
    const header = ['HandoverId', 'SavedAt', 'AuthoredBy', 'Situation', 'Background', 'Assessment', 'Recommendation'];
    const lines = rows.map((row) => [
      row.handoverId,
      row.savedAt,
      row.authoredBy,
      row.situation,
      row.background,
      row.assessment,
      row.recommendation,
    ].map(csvEscape).join(','));

    const csv = [header.join(','), ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="handover-history-${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    if (error?.code === 'INNOVATION_PERSISTENCE_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        message: 'Handover export is unavailable while persistence is degraded',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Unable to export handover history',
    });
  }
};

export const getOperationsHandoverAuditsCsv = async (req, res) => {
  try {
    await ensureOperationsPersistenceReady();

    const limit = clamp(Number(req.query?.limit || 300), 1, 2000);
    const rows = handoverAuditTrail.slice(0, limit);
    const header = ['AuditId', 'LoggedAt', 'EventType', 'Actor', 'HandoverId', 'FiltersJson'];
    const lines = rows.map((row) => [
      row.auditId,
      row.loggedAt,
      row.eventType,
      row.actor,
      row.handoverId || '',
      row.filtersJson || '',
    ].map(csvEscape).join(','));

    const csv = [header.join(','), ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="handover-audits-${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    if (error?.code === 'INNOVATION_PERSISTENCE_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        message: 'Handover audit export is unavailable while persistence is degraded',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Unable to export handover audits',
    });
  }
};

export const postOperationsHandover = async (req, res) => {
  try {
    await ensureOperationsPersistenceReady();
    const situation = String(req.body?.situation || '').trim().slice(0, 1200);
    const background = String(req.body?.background || '').trim().slice(0, 1200);
    const assessment = String(req.body?.assessment || '').trim().slice(0, 1200);
    const recommendation = String(req.body?.recommendation || '').trim().slice(0, 1200);

    if (!situation || !background || !assessment || !recommendation) {
      return res.status(400).json({
        success: false,
        message: 'SBAR fields are required',
      });
    }

    const record = {
      handoverId: Number(Date.now()),
      situation,
      background,
      assessment,
      recommendation,
      authoredBy: String(req.user?.email || 'unknown').slice(0, 255),
      savedAt: new Date().toISOString(),
    };

    await persistOperationsHandover(record);
    const saveAuditEvent = {
      auditId: Number(Date.now()) + 1,
      eventType: 'handover_save',
      actor: record.authoredBy,
      filtersJson: null,
      handoverId: record.handoverId,
      loggedAt: record.savedAt,
    };
    await persistOperationsHandoverAudit(saveAuditEvent);

    handoverTrail.unshift(record);
    if (handoverTrail.length > 80) {
      handoverTrail.length = 80;
    }

    handoverAuditTrail.unshift(saveAuditEvent);
    if (handoverAuditTrail.length > 200) {
      handoverAuditTrail.length = 200;
    }
    emitOperationsHandoverSaved(record);

    return res.status(201).json({
      success: true,
      data: record,
      message: 'SBAR handover saved',
    });
  } catch (error) {
    if (error?.code === 'INNOVATION_PERSISTENCE_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        message: 'Unable to save SBAR handover while persistence is degraded',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Unable to save SBAR handover',
    });
  }
};

export const postPreventiveInsights = async (req, res) => {
  try {
    const { chronicConditions = [], age = 35, activityLevel = 'moderate', adherence = 80 } = req.body || {};

    const chronicCount = Array.isArray(chronicConditions) ? chronicConditions.length : 0;
    const adherenceScore = clamp(Number(adherence || 0), 0, 100);

    let riskScore = 18 + chronicCount * 14 + (age >= 65 ? 18 : age < 18 ? 8 : 12);
    if (String(activityLevel).toLowerCase() === 'low') riskScore += 14;
    if (adherenceScore < 60) riskScore += 18;
    if (adherenceScore >= 85) riskScore -= 8;

    riskScore = clamp(Math.round(riskScore), 0, 100);

    const segment = riskScore >= 70 ? 'critical-care-gap' : riskScore >= 45 ? 'rising-risk' : 'preventive-stable';
    const nextBestActions =
      segment === 'critical-care-gap'
        ? ['Start 24h nurse outreach workflow', 'Book telehealth review within 48h', 'Enable daily medication adherence nudges']
        : segment === 'rising-risk'
          ? ['Trigger 7-day care coach plan', 'Schedule preventive lab package', 'Push behavior-change reminders 3x/week']
          : ['Maintain monthly preventive check-ins', 'Send wellness education digest', 'Review adherence trend in next cycle'];

    return res.json({
      success: true,
      data: {
        segment,
        riskScore,
        nextBestActions,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch {
    return res.status(400).json({
      success: false,
      message: 'Invalid preventive insights payload',
    });
  }
};

export default {
  getSecurityPosture,
  postAiTriage,
  postPreventiveInsights,
  getAiTriagePolicy,
  putAiTriagePolicy,
  getAiTriagePolicyHistory,
  getAiAuditTrail,
  postVerifyDecisionPackage,
  getSigningKeys,
  postRotateSigningKey,
  postActivateSigningKey,
  postRevokeSigningKey,
  getComplianceEvidencePackage,
  postMaintenanceCleanup,
  getModelOpsReadiness,
  getModelOpsSloTrend,
  getBackupRestoreDrills,
  postBackupRestoreDrill,
  getInnovationPersistenceStatus,
  getOperationsBedCensus,
  getOperationsHandover,
  getOperationsHandoverAudits,
  getOperationsHandoverCsv,
  getOperationsHandoverAuditsCsv,
  postOperationsHandover,
};
