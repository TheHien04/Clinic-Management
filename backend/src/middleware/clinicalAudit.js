import { executeQuery } from '../config/database.js';

const resourceTypeForPath = (path = '') => {
  if (path.includes('medical-record')) return 'MedicalRecord';
  if (path.includes('patient')) return 'Patient';
  return 'ClinicalResource';
};

/**
 * Append privacy-minimized access metadata to the hash-chained SQL audit log.
 * Query strings and request bodies are intentionally excluded because they may
 * contain PHI. Audit failure never changes the already-completed API response.
 */
export const clinicalAudit = (purposeOfUse = 'healthcare-operations') => (req, res, next) => {
  res.on('finish', () => {
    if (!req.user || res.statusCode >= 500) return;

    const resourceId = req.params?.id || req.params?.patientId || null;
    const patientId = Number(req.params?.patientId || (resourceTypeForPath(req.baseUrl) === 'Patient' ? req.params?.id : 0)) || null;
    const metadata = JSON.stringify({
      method: req.method,
      route: `${req.baseUrl}${req.route?.path || ''}`,
      statusCode: res.statusCode,
    });

    executeQuery(`
      EXEC dbo.sp_AppendClinicalAuditEvent
        @ClinicID = @clinicId,
        @ActorAccountID = @actorAccountId,
        @ActorEmail = @actorEmail,
        @ActionName = @actionName,
        @ResourceType = @resourceType,
        @ResourceID = @resourceId,
        @PatientID = @patientId,
        @PurposeOfUse = @purposeOfUse,
        @MetadataJson = @metadataJson;
    `, {
      clinicId: req.user.clinicId || null,
      actorAccountId: req.user.id || null,
      actorEmail: req.user.email || null,
      actionName: `${req.method.toLowerCase()}.clinical-resource`,
      resourceType: resourceTypeForPath(req.baseUrl),
      resourceId: resourceId ? String(resourceId) : null,
      patientId,
      purposeOfUse,
      metadataJson: metadata,
    }).catch((error) => console.warn('Clinical audit append degraded:', error.message));
  });

  next();
};

export default clinicalAudit;
