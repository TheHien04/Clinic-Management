/**
 * Patient Controller
 */

import { executeQuery } from '../config/database.js';
import { getMongoDb, getMongoStatus } from '../config/nosql.js';
import { isValidEmail, isValidPhone, sanitizeInput } from '../utils/validators.js';
import { clearCache } from '../middleware/cacheMiddleware.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const serializeRowVersion = (row) => {
  if (!row) return row;
  const { RowVersion, ...rest } = row;
  return {
    ...rest,
    RecordVersion: Buffer.isBuffer(RowVersion)
      ? `0x${RowVersion.toString('hex').toUpperCase()}`
      : row.RecordVersion || null,
  };
};

const toIsoDate = (value) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
};

const monthsBack = (count = 6) => {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 1));
    return date.toISOString().slice(0, 7);
  });
};

const scoreOperationalRisk = (row) => {
  const today = new Date();
  const lastVisit = row.LastVisit ? new Date(row.LastVisit) : null;
  const daysSinceLastVisit = lastVisit && !Number.isNaN(lastVisit.getTime())
    ? Math.max(0, Math.floor((today.getTime() - lastVisit.getTime()) / 86400000))
    : null;
  const history = String(row.MedicalHistory || '').trim();
  const visits = Number(row.VisitCount || 0);
  const cancellations = Number(row.CancelledVisits || 0);
  const clinicalRecords = Number(row.RecordCount || 0);
  const hasContactChannel = Boolean(row.PhoneNumber || row.Email);

  const factors = [
    { key: 'care-gap', label: 'Care gap', points: daysSinceLastVisit == null ? 20 : daysSinceLastVisit >= 180 ? 35 : daysSinceLastVisit >= 90 ? 24 : daysSinceLastVisit >= 45 ? 10 : 0 },
    { key: 'cancellations', label: 'Prior cancellations', points: Math.min(18, cancellations * 6) },
    { key: 'clinical-continuity', label: 'Clinical continuity gap', points: visits === 0 ? 15 : clinicalRecords === 0 ? 15 : 0 },
    { key: 'contactability', label: 'No contact channel', points: hasContactChannel ? 0 : 12 },
  ];

  const riskScore = clamp(factors.reduce((sum, factor) => sum + factor.points, 0), 0, 100);
  const riskBand = riskScore >= 70 ? 'high' : riskScore >= 45 ? 'medium' : 'low';
  const featureCoverage = [Boolean(row.DateOfBirth), daysSinceLastVisit != null, hasContactChannel, Boolean(history), clinicalRecords > 0]
    .filter(Boolean).length;

  return {
    id: row.PatientID,
    name: row.FullName,
    visits,
    lastVisit: toIsoDate(row.LastVisit),
    daysSinceLastVisit,
    riskScore,
    riskBand,
    confidence: Math.round(35 + (featureCoverage / 5) * 60),
    factors: factors.filter((factor) => factor.points > 0),
    outreachPriority: riskBand === 'high'
      ? 'Clinical review within 24h'
      : riskBand === 'medium'
        ? 'Care-team review within 48h'
        : 'Routine preventive follow-up',
  };
};

/**
 * Transparent care-operations intelligence. This output is deliberately
 * non-diagnostic and requires clinician review before any care decision.
 */
export const getPatientIntelligence = async (req, res) => {
  try {
    const clinicId = req.user?.clinicId || null;
    const result = await executeQuery(`
      SELECT
        p.PatientID, p.FullName, p.DateOfBirth, p.PhoneNumber, p.Email,
        p.MedicalHistory, p.CreatedDate,
        COUNT(DISTINCT CASE
          WHEN LOWER(ISNULL(a.Status, '')) = 'completed'
            AND a.AppointmentDate <= CAST(GETDATE() AS DATE)
          THEN a.AppointmentID
        END) AS VisitCount,
        MAX(CASE
          WHEN LOWER(ISNULL(a.Status, '')) = 'completed'
            AND a.AppointmentDate <= CAST(GETDATE() AS DATE)
          THEN a.AppointmentDate
        END) AS LastVisit,
        COUNT(DISTINCT CASE WHEN LOWER(ISNULL(a.Status, '')) = 'cancelled' THEN a.AppointmentID END) AS CancelledVisits,
        COUNT(DISTINCT mr.RecordID) AS RecordCount
      FROM Patients p
      LEFT JOIN Appointments a ON a.PatientID = p.PatientID
      LEFT JOIN MedicalRecords mr ON mr.AppointmentID = a.AppointmentID
      WHERE (@clinicId IS NULL OR p.ClinicID = @clinicId)
      GROUP BY p.PatientID, p.FullName, p.DateOfBirth, p.PhoneNumber,
        p.Email, p.MedicalHistory, p.CreatedDate
      ORDER BY p.PatientID ASC;
    `, { clinicId });

    const governanceResult = await executeQuery(`
      SELECT
        COUNT(DISTINCT p.PatientID) AS PatientCount,
        COUNT(DISTINCT CASE WHEN latestAnalytics.Status = 'granted' THEN p.PatientID END) AS AnalyticsConsentCount,
        COUNT(DISTINCT mp.MolecularProfileID) AS MolecularProfileCount,
        COUNT(DISTINCT CASE WHEN ctc.Code IS NOT NULL THEN mr.RecordID END) AS TerminologyValidatedRecords,
        (SELECT COUNT(*) FROM dbo.ClinicalEventOutbox o
          WHERE (@clinicId IS NULL OR o.ClinicID = @clinicId) AND o.Status IN ('pending', 'processing', 'failed')) AS OutboxBacklog
      FROM dbo.Patients p
      OUTER APPLY (
        SELECT TOP (1) pc.Status
        FROM dbo.PatientConsents pc
        WHERE pc.PatientID = p.PatientID AND pc.ConsentType = 'analytics'
        ORDER BY pc.CreatedAt DESC, pc.ConsentID DESC
      ) latestAnalytics
      LEFT JOIN dbo.Appointments a ON a.PatientID = p.PatientID
      LEFT JOIN dbo.MedicalRecords mr ON mr.AppointmentID = a.AppointmentID
      LEFT JOIN dbo.ClinicalTerminologyCodes ctc ON ctc.CodeSystem = 'ICD-10' AND ctc.Code = mr.DiagnosisCode AND ctc.IsActive = 1
      LEFT JOIN dbo.MolecularProfileRegistry mp ON mp.PatientID = p.PatientID
      WHERE (@clinicId IS NULL OR p.ClinicID = @clinicId);
    `, { clinicId });
    const governance = governanceResult.recordset?.[0] || {};

    const rows = result.recordset || [];
    const riskRows = rows.map(scoreOperationalRisk).sort((a, b) => b.riskScore - a.riskScore);
    const cohorts = ['high', 'medium', 'low'].reduce((acc, band) => {
      const members = riskRows.filter((row) => row.riskBand === band);
      acc[band] = {
        count: members.length,
        avg: members.length ? Math.round(members.reduce((sum, row) => sum + row.riskScore, 0) / members.length) : 0,
        confidence: members.length ? Math.round(members.reduce((sum, row) => sum + row.confidence, 0) / members.length) : 0,
      };
      return acc;
    }, {});

    const monthKeys = monthsBack(6);
    const registrationCounts = new Map(monthKeys.map((month) => [month, 0]));
    rows.forEach((row) => {
      const month = toIsoDate(row.CreatedDate)?.slice(0, 7);
      if (registrationCounts.has(month)) registrationCounts.set(month, registrationCounts.get(month) + 1);
    });

    const requiredFields = ['FullName', 'DateOfBirth', 'PhoneNumber', 'Email'];
    const possibleFields = Math.max(1, rows.length * requiredFields.length);
    const availableFields = rows.reduce(
      (sum, row) => sum + requiredFields.filter((field) => Boolean(row[field])).length,
      0,
    );
    const clinicalHistoryCoverage = rows.length
      ? Math.round((rows.filter((row) => Boolean(String(row.MedicalHistory || '').trim())).length / rows.length) * 100)
      : 0;
    const codedClinicalRecords = rows.reduce((sum, row) => sum + Number(row.RecordCount || 0), 0);

    const mongoStatus = getMongoStatus();
    let eventDocuments = 0;
    let molecularProfiles = 0;
    if (mongoStatus.enabled) {
      try {
        const mongo = await getMongoDb();
        if (mongo) {
          [eventDocuments, molecularProfiles] = await Promise.all([
            mongo.collection('clinical_events').countDocuments({}),
            mongo.collection('molecular_profiles').countDocuments({}),
          ]);
        }
      } catch (error) {
        console.warn('NoSQL intelligence metrics unavailable:', error.message);
      }
    }

    res.json({
      success: true,
      data: {
        asOf: new Date().toISOString(),
        cohortDefinition: 'All patient records visible to the current clinic role',
        monthlyRegistrations: monthKeys.map((month) => ({ month, count: registrationCounts.get(month) || 0 })),
        riskRows,
        cohorts,
        dataQuality: {
          identityCompleteness: Math.round((availableFields / possibleFields) * 100),
          clinicalHistoryCoverage,
          codedClinicalRecords,
          patientCount: rows.length,
          terminologyValidatedRecords: Number(governance.TerminologyValidatedRecords || 0),
          analyticsConsentCoverage: Number(governance.PatientCount || 0)
            ? Math.round((Number(governance.AnalyticsConsentCount || 0) / Number(governance.PatientCount)) * 100)
            : 0,
        },
        interoperability: {
          sqlSourceOfTruth: true,
          fhirReadModel: {
            enabled: mongoStatus.enabled,
            connected: mongoStatus.connected,
            documents: eventDocuments,
          },
          genomics: {
            profiles: Math.max(molecularProfiles, Number(governance.MolecularProfileCount || 0)),
            status: Math.max(molecularProfiles, Number(governance.MolecularProfileCount || 0)) > 0 ? 'available' : 'not-loaded',
            note: 'Genomic data is never inferred from routine clinical records.',
          },
          outbox: {
            backlog: Number(governance.OutboxBacklog || 0),
            delivery: 'at-least-once with idempotent Mongo upsert',
          },
        },
        model: {
          id: 'care-operations-rules-v1',
          type: 'transparent-rules',
          intendedUse: 'Operational prioritization for care-team review',
          limitation: 'Not diagnostic. Scores require clinician review and must not automate treatment decisions.',
          thresholds: { high: 70, medium: 45 },
        },
      },
    });
  } catch (error) {
    console.error('Get patient intelligence error:', error);
    res.status(500).json({ success: false, message: 'Unable to build patient intelligence snapshot' });
  }
};

/**
 * Get all patients
 * GET /api/patients
 */
export const getAllPatients = async (req, res) => {
  try {
    const { search, limit = 100, offset = 0 } = req.query;
    const clinicId = req.user?.clinicId || null;

    const safeOffset = Math.max(0, Number.parseInt(String(offset), 10) || 0);
    const safeLimit = Math.min(500, Math.max(1, Number.parseInt(String(limit), 10) || 100));
    const result = await executeQuery(`
      EXEC dbo.sp_GetPatientDirectory
        @ClinicID = @clinicId,
        @Search = @search,
        @Offset = @offset,
        @Limit = @limit;
    `, {
      offset: safeOffset,
      limit: safeLimit,
      clinicId,
      search: search || null,
    });
    const rows = result.recordset || [];
    const total = Number(rows[0]?.TotalRows || 0);
    const data = rows.map(({ TotalRows: _totalRows, ...patient }) => patient);

    res.json({
      success: true,
      data,
      count: data.length,
      pagination: {
        offset: safeOffset,
        limit: safeLimit,
        total,
        hasMore: safeOffset + data.length < total,
      },
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get patient by ID
 * GET /api/patients/:id
 */
export const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.user?.clinicId || null;

    const query = `
      SELECT *, CONVERT(VARCHAR(18), sys.fn_varbintohexstr(RowVersion)) AS RecordVersion
      FROM Patients
      WHERE PatientID = @id AND (@clinicId IS NULL OR ClinicID = @clinicId)
    `;

    const result = await executeQuery(query, { id, clinicId });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      data: serializeRowVersion(result.recordset[0])
    });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Create new patient
 * POST /api/patients
 */
export const createPatient = async (req, res) => {
  try {
    const { fullName, dateOfBirth, gender, phoneNumber, email, address, medicalHistory } = req.body;

    // Validate required fields
    if (!fullName || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Full name and phone number are required'
      });
    }

    // Validate email if provided
    if (email && !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate phone
    if (!isValidPhone(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Check if patient with same phone exists
    const clinicId = req.user?.clinicId || null;
    const checkQuery = `
      SELECT PatientID FROM Patients
      WHERE PhoneNumber = @phoneNumber AND (@clinicId IS NULL OR ClinicID = @clinicId)
    `;
    const existing = await executeQuery(checkQuery, { phoneNumber, clinicId });

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Patient with this phone number already exists'
      });
    }

    // Create patient
    const insertQuery = `
      INSERT INTO Patients (FullName, DateOfBirth, Gender, PhoneNumber, Email, Address, MedicalHistory, ClinicID, CreatedDate)
      OUTPUT INSERTED.*
      VALUES (@fullName, @dateOfBirth, @gender, @phoneNumber, @email, @address, @medicalHistory,
        COALESCE(@clinicId, (SELECT TOP (1) ClinicID FROM Clinics ORDER BY ClinicID)), GETDATE())
    `;

    const result = await executeQuery(insertQuery, {
      fullName: sanitizeInput(fullName),
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      phoneNumber,
      email: email || null,
      address: sanitizeInput(address) || null,
      medicalHistory: sanitizeInput(medicalHistory) || null,
      clinicId,
    });
    await clearCache('*:/api/patients*');

    res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      data: serializeRowVersion(result.recordset[0])
    });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update patient
 * PUT /api/patients/:id
 */
export const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, dateOfBirth, gender, phoneNumber, email, address, medicalHistory, recordVersion } = req.body;

    if (recordVersion && !/^0x[0-9A-Fa-f]{16}$/.test(recordVersion)) {
      return res.status(400).json({ success: false, message: 'Invalid patient record version' });
    }

    // Validate email if provided
    if (email && !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const updateQuery = `
      UPDATE Patients
      SET 
        FullName = COALESCE(@fullName, FullName),
        DateOfBirth = COALESCE(@dateOfBirth, DateOfBirth),
        Gender = COALESCE(@gender, Gender),
        PhoneNumber = COALESCE(@phoneNumber, PhoneNumber),
        Email = COALESCE(@email, Email),
        Address = COALESCE(@address, Address),
        MedicalHistory = COALESCE(@medicalHistory, MedicalHistory),
        UpdatedDate = GETDATE()
      OUTPUT INSERTED.*
      WHERE PatientID = @id
        AND (@clinicId IS NULL OR ClinicID = @clinicId)
        AND (@recordVersion IS NULL OR RowVersion = CONVERT(BINARY(8), @recordVersion, 1))
    `;

    const result = await executeQuery(updateQuery, {
      id,
      clinicId: req.user?.clinicId || null,
      fullName: fullName ? sanitizeInput(fullName) : null,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      phoneNumber: phoneNumber || null,
      email: email || null,
      address: address ? sanitizeInput(address) : null,
      medicalHistory: medicalHistory ? sanitizeInput(medicalHistory) : null
      ,recordVersion: recordVersion || null
    });

    if (result.recordset.length === 0) {
      if (recordVersion) {
        const current = await executeQuery(
          `SELECT PatientID FROM Patients WHERE PatientID = @id AND (@clinicId IS NULL OR ClinicID = @clinicId)`,
          { id, clinicId: req.user?.clinicId || null },
        );
        if (current.recordset.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'This patient was updated by another user. Reload before saving again.',
          });
        }
      }
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    await clearCache('*:/api/patients*');

    res.json({
      success: true,
      message: 'Patient updated successfully',
      data: serializeRowVersion(result.recordset[0])
    });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Delete patient
 * DELETE /api/patients/:id
 */
export const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if patient has appointments
    const clinicId = req.user?.clinicId || null;
    const checkQuery = `SELECT COUNT(*) as count FROM Appointments WHERE PatientID = @id AND (@clinicId IS NULL OR ClinicID = @clinicId)`;
    const check = await executeQuery(checkQuery, { id, clinicId });

    if (check.recordset[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete patient with existing appointments'
      });
    }

    const deleteQuery = `DELETE FROM Patients WHERE PatientID = @id AND (@clinicId IS NULL OR ClinicID = @clinicId)`;
    const result = await executeQuery(deleteQuery, { id, clinicId });

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    await clearCache('*:/api/patients*');

    res.json({
      success: true,
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get patient appointment history
 * GET /api/patients/:id/history
 */
export const getPatientHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        a.*,
        d.FullName as DoctorName,
        s.SpecialtyName
      FROM Appointments a
      LEFT JOIN Doctors d ON a.DoctorID = d.DoctorID
      LEFT JOIN Specialties s ON d.SpecialtyID = s.SpecialtyID
      WHERE a.PatientID = @id AND (@clinicId IS NULL OR a.ClinicID = @clinicId)
      ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC
    `;

    const result = await executeQuery(query, { id, clinicId: req.user?.clinicId || null });

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Get patient history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientHistory,
  getPatientIntelligence,
};
