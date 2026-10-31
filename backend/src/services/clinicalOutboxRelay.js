import crypto from 'crypto';
import { executeQuery } from '../config/database.js';
import { getMongoDb, getMongoStatus } from '../config/nosql.js';

const POLL_MS = Math.max(1000, Number(process.env.CLINICAL_OUTBOX_POLL_MS || 2500));
const BATCH_SIZE = Math.min(200, Math.max(1, Number(process.env.CLINICAL_OUTBOX_BATCH_SIZE || 100)));

let timer = null;
let running = false;
let indexesReady = false;

const parsePayload = (value) => {
  if (value && typeof value === 'object') return value;
  try {
    return JSON.parse(String(value || '{}'));
  } catch {
    return {};
  }
};

const ensureIndexes = async (mongo) => {
  if (indexesReady) return;
  await Promise.all([
    mongo.collection('clinical_events').createIndex({ eventId: 1 }, { unique: true }),
    mongo.collection('clinical_events').createIndex({ patientId: 1, occurredAt: -1 }),
    mongo.collection('clinical_events').createIndex({ resourceType: 1, occurredAt: -1 }),
    mongo.collection('molecular_profiles').createIndex({ molecularProfileId: 1 }, { unique: true }),
    mongo.collection('molecular_profiles').createIndex({ patientId: 1, collectedAt: -1 }),
  ]);
  indexesReady = true;
};

const claimBatch = async (lockId) => executeQuery(`
  ;WITH claimable AS (
    SELECT TOP (@batchSize) *
    FROM dbo.ClinicalEventOutbox WITH (UPDLOCK, READPAST, ROWLOCK)
    WHERE
      (Status = 'pending' OR (Status = 'processing' AND LockedAt < DATEADD(MINUTE, -5, SYSUTCDATETIME())))
      AND NextAttemptAt <= SYSUTCDATETIME()
    ORDER BY OccurredAt, OutboxID
  )
  UPDATE claimable
  SET Status = 'processing', LockID = @lockId, LockedAt = SYSUTCDATETIME()
  OUTPUT
    INSERTED.OutboxID, INSERTED.EventType, INSERTED.AggregateType,
    INSERTED.AggregateID, INSERTED.PatientID, INSERTED.ClinicID,
    INSERTED.PayloadJson, INSERTED.OccurredAt, INSERTED.Attempts;
`, { batchSize: BATCH_SIZE, lockId });

const publishEvent = async (mongo, row) => {
  const payload = parsePayload(row.PayloadJson);
  const occurredAt = new Date(row.OccurredAt);
  const eventId = String(row.OutboxID);

  if (row.EventType === 'molecular-profile.registered') {
    const molecularProfileId = String(payload.molecularProfileId || row.AggregateID);
    await mongo.collection('molecular_profiles').updateOne(
      { molecularProfileId },
      {
        $setOnInsert: {
          molecularProfileId,
          eventId,
          patientId: Number(payload.patientId || row.PatientID),
          clinicId: Number(row.ClinicID),
          assayType: payload.assayType,
          genomeBuild: payload.genomeBuild,
          specimenType: payload.specimenType,
          sourceFormat: payload.sourceFormat,
          checksumSha256: payload.checksumSha256,
          variantCount: Number(payload.variantCount || 0),
          interpretationStatus: payload.interpretationStatus,
          collectedAt: payload.collectedAt ? new Date(payload.collectedAt) : occurredAt,
          payloadClass: 'metadata-only',
          source: { system: 'clinic-management', store: 'sqlserver-outbox' },
          ingestedAt: new Date(),
        },
      },
      { upsert: true },
    );
    return;
  }

  const diagnosisCode = String(payload.diagnosisCode || '').trim();
  const document = {
    eventId,
    eventType: row.EventType,
    schemaVersion: 1,
    occurredAt,
    source: { system: 'clinic-management', store: 'sqlserver-outbox' },
    clinicId: Number(row.ClinicID),
    patientId: Number(payload.patientId || row.PatientID),
    resourceType: 'Condition',
    fhirProfile: 'FHIR-inspired event envelope; not a conformance claim',
    fhirVersion: '4.0.1',
    resource: {
      resourceType: 'Condition',
      id: `medical-record-${payload.recordId || row.AggregateID}`,
      subject: { reference: `Patient/${Number(payload.patientId || row.PatientID)}` },
      encounter: payload.appointmentId ? { reference: `Encounter/${Number(payload.appointmentId)}` } : undefined,
      code: diagnosisCode
        ? { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: diagnosisCode }] }
        : undefined,
      recordedDate: occurredAt.toISOString(),
    },
    tombstone: row.EventType === 'medical-record.deleted',
    integrity: {
      payloadSha256: crypto.createHash('sha256').update(String(row.PayloadJson)).digest('hex'),
    },
  };

  await mongo.collection('clinical_events').updateOne(
    { eventId },
    { $setOnInsert: document },
    { upsert: true },
  );
};

const markPublished = async (outboxId, lockId) => executeQuery(`
  UPDATE dbo.ClinicalEventOutbox
  SET Status = 'published', PublishedAt = SYSUTCDATETIME(), LastError = NULL,
      LockID = NULL, LockedAt = NULL
  WHERE OutboxID = @outboxId AND LockID = @lockId;
`, { outboxId, lockId });

const markFailed = async (row, lockId, error) => executeQuery(`
  UPDATE dbo.ClinicalEventOutbox
  SET Status = CASE WHEN Attempts + 1 >= 8 THEN 'failed' ELSE 'pending' END,
      Attempts = Attempts + 1,
      NextAttemptAt = DATEADD(SECOND, POWER(2, CASE WHEN Attempts > 7 THEN 7 ELSE Attempts END), SYSUTCDATETIME()),
      LastError = LEFT(@lastError, 1000), LockID = NULL, LockedAt = NULL
  WHERE OutboxID = @outboxId AND LockID = @lockId;
`, { outboxId: row.OutboxID, lockId, lastError: error.message || 'Unknown relay error' });

export const flushClinicalOutbox = async () => {
  if (running || !getMongoStatus().enabled) return { processed: 0 };
  running = true;
  const lockId = crypto.randomUUID();

  try {
    const mongo = await getMongoDb();
    if (!mongo) return { processed: 0 };
    await ensureIndexes(mongo);

    const claimed = await claimBatch(lockId);
    const rows = claimed.recordset || [];
    let published = 0;

    for (const row of rows) {
      try {
        await publishEvent(mongo, row);
        await markPublished(row.OutboxID, lockId);
        published += 1;
      } catch (error) {
        await markFailed(row, lockId, error);
      }
    }

    return { processed: rows.length, published };
  } catch (error) {
    console.warn('Clinical outbox relay degraded:', error.message);
    return { processed: 0, error: error.message };
  } finally {
    running = false;
  }
};

export const startClinicalOutboxRelay = () => {
  if (timer || !getMongoStatus().enabled) return;
  flushClinicalOutbox();
  timer = setInterval(flushClinicalOutbox, POLL_MS);
  timer.unref?.();
};

export const stopClinicalOutboxRelay = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

export default { flushClinicalOutbox, startClinicalOutboxRelay, stopClinicalOutboxRelay };
