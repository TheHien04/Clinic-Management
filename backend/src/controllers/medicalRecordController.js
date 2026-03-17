/**
 * Medical Records Controller
 * Handles CRUD operations for medical records (diagnosis, prescription, notes)
 */

import { executeQuery } from '../config/database.js';

const baseMedicalRecordSelect = `
  SELECT
    mr.RecordID AS record_id,
    mr.AppointmentID AS app_id,
    mr.DiagnosisCode AS diagnosis_code,
    mr.Prescription AS prescription,
    mr.Notes AS notes,
    mr.FollowUpDate AS follow_up_date,
    mr.CreatedDate AS created_at,
    a.AppointmentDate AS appointment_date,
    a.AppointmentTime AS appointment_time,
    a.Status AS appointment_status,
    p.PatientID AS patient_id,
    p.FullName AS patient_name,
    p.DateOfBirth AS date_of_birth,
    p.PhoneNumber AS phone,
    p.Email AS email,
    p.Address AS address,
    d.DoctorID AS doctor_id,
    d.FullName AS doctor_name,
    s.SpecialtyName AS specialty_name
  FROM MedicalRecords mr
  JOIN Appointments a ON mr.AppointmentID = a.AppointmentID
  JOIN Patients p ON a.PatientID = p.PatientID
  JOIN Doctors d ON a.DoctorID = d.DoctorID
  LEFT JOIN Specialties s ON d.SpecialtyID = s.SpecialtyID
`;

// @desc    Get all medical records with patient & appointment details
// @route   GET /api/medical-records
// @access  Private
export const getMedicalRecords = async (req, res) => {
  try {
    const { patientId, startDate, endDate, page = 1, limit = 20 } = req.query;

    let query = `${baseMedicalRecordSelect} WHERE 1=1`;
    const params = {};

    if (patientId) {
      query += ' AND p.PatientID = @patientId';
      params.patientId = Number(patientId);
    }

    if (startDate) {
      query += ' AND mr.CreatedDate >= @startDate';
      params.startDate = startDate;
    }

    if (endDate) {
      query += ' AND mr.CreatedDate <= @endDate';
      params.endDate = endDate;
    }

    query += ' ORDER BY mr.CreatedDate DESC';

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    query += ' OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';
    params.offset = offset;
    params.limit = safeLimit;

    const result = await executeQuery(query, params);

    let countQuery = `
      SELECT COUNT(*) AS total
      FROM MedicalRecords mr
      JOIN Appointments a ON mr.AppointmentID = a.AppointmentID
      JOIN Patients p ON a.PatientID = p.PatientID
      WHERE 1=1
    `;

    const countParams = {};

    if (patientId) {
      countQuery += ' AND p.PatientID = @patientId';
      countParams.patientId = Number(patientId);
    }

    if (startDate) {
      countQuery += ' AND mr.CreatedDate >= @startDate';
      countParams.startDate = startDate;
    }

    if (endDate) {
      countQuery += ' AND mr.CreatedDate <= @endDate';
      countParams.endDate = endDate;
    }

    const countResult = await executeQuery(countQuery, countParams);
    const total = Number(countResult.recordset[0]?.total || 0);

    res.json({
      success: true,
      data: result.recordset,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error) {
    console.error('Get medical records error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medical records',
      error: error.message,
    });
  }
};

// @desc    Get medical record by ID
// @route   GET /api/medical-records/:id
// @access  Private
export const getMedicalRecordById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `${baseMedicalRecordSelect} WHERE mr.RecordID = @id`;
    const result = await executeQuery(query, { id: Number(id) });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found',
      });
    }

    res.json({
      success: true,
      data: result.recordset[0],
    });
  } catch (error) {
    console.error('Get medical record error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medical record',
      error: error.message,
    });
  }
};

// @desc    Get medical records by patient ID
// @route   GET /api/medical-records/patient/:patientId
// @access  Private
export const getMedicalRecordsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    const query = `
      ${baseMedicalRecordSelect}
      WHERE p.PatientID = @patientId
      ORDER BY mr.CreatedDate DESC
    `;

    const result = await executeQuery(query, { patientId: Number(patientId) });

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error('Get patient medical records error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patient medical records',
      error: error.message,
    });
  }
};

// @desc    Create new medical record
// @route   POST /api/medical-records
// @access  Private
export const createMedicalRecord = async (req, res) => {
  try {
    const { appId, diagnosisCode, prescription, notes, followUpDate } = req.body;

    if (!appId || !diagnosisCode) {
      return res.status(400).json({
        success: false,
        message: 'Appointment ID and diagnosis code are required',
      });
    }

    const appointmentQuery = `
      SELECT AppointmentID, Status
      FROM Appointments
      WHERE AppointmentID = @appId
    `;

    const appointmentResult = await executeQuery(appointmentQuery, { appId: Number(appId) });

    if (appointmentResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    const existingQuery = `
      SELECT RecordID
      FROM MedicalRecords
      WHERE AppointmentID = @appId
    `;

    const existingResult = await executeQuery(existingQuery, { appId: Number(appId) });

    if (existingResult.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Medical record already exists for this appointment',
      });
    }

    const insertQuery = `
      INSERT INTO MedicalRecords (AppointmentID, DiagnosisCode, Prescription, Notes, FollowUpDate)
      OUTPUT
        INSERTED.RecordID AS record_id,
        INSERTED.AppointmentID AS app_id,
        INSERTED.DiagnosisCode AS diagnosis_code,
        INSERTED.Prescription AS prescription,
        INSERTED.Notes AS notes,
        INSERTED.FollowUpDate AS follow_up_date,
        INSERTED.CreatedDate AS created_at
      VALUES (@appId, @diagnosisCode, @prescription, @notes, @followUpDate)
    `;

    const result = await executeQuery(insertQuery, {
      appId: Number(appId),
      diagnosisCode,
      prescription: prescription || null,
      notes: notes || null,
      followUpDate: followUpDate || null,
    });

    res.status(201).json({
      success: true,
      message: 'Medical record created successfully',
      data: result.recordset[0],
    });
  } catch (error) {
    console.error('Create medical record error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating medical record',
      error: error.message,
    });
  }
};

// @desc    Update medical record
// @route   PUT /api/medical-records/:id
// @access  Private
export const updateMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnosisCode, prescription, notes, followUpDate } = req.body;

    const checkQuery = 'SELECT RecordID FROM MedicalRecords WHERE RecordID = @id';
    const checkResult = await executeQuery(checkQuery, { id: Number(id) });

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found',
      });
    }

    const updateQuery = `
      UPDATE MedicalRecords
      SET
        DiagnosisCode = COALESCE(@diagnosisCode, DiagnosisCode),
        Prescription = @prescription,
        Notes = @notes,
        FollowUpDate = @followUpDate
      OUTPUT
        INSERTED.RecordID AS record_id,
        INSERTED.AppointmentID AS app_id,
        INSERTED.DiagnosisCode AS diagnosis_code,
        INSERTED.Prescription AS prescription,
        INSERTED.Notes AS notes,
        INSERTED.FollowUpDate AS follow_up_date,
        INSERTED.CreatedDate AS created_at
      WHERE RecordID = @id
    `;

    const result = await executeQuery(updateQuery, {
      id: Number(id),
      diagnosisCode: diagnosisCode || null,
      prescription: prescription || null,
      notes: notes || null,
      followUpDate: followUpDate || null,
    });

    res.json({
      success: true,
      message: 'Medical record updated successfully',
      data: result.recordset[0],
    });
  } catch (error) {
    console.error('Update medical record error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating medical record',
      error: error.message,
    });
  }
};

// @desc    Delete medical record
// @route   DELETE /api/medical-records/:id
// @access  Private
export const deleteMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;

    const checkQuery = 'SELECT RecordID FROM MedicalRecords WHERE RecordID = @id';
    const checkResult = await executeQuery(checkQuery, { id: Number(id) });

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found',
      });
    }

    await executeQuery('DELETE FROM MedicalRecords WHERE RecordID = @id', { id: Number(id) });

    res.json({
      success: true,
      message: 'Medical record deleted successfully',
    });
  } catch (error) {
    console.error('Delete medical record error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting medical record',
      error: error.message,
    });
  }
};
