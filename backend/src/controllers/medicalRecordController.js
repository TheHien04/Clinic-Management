/**
 * Medical Records Controller
 * Handles CRUD operations for medical records (diagnosis, prescription, notes)
 */

import { executeQuery } from '../config/database.js';

// @desc    Get all medical records with patient & appointment details
// @route   GET /api/medical-records
// @access  Private
export const getMedicalRecords = async (req, res) => {
  try {
    const { patientId, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let query = `
      SELECT 
        mr.record_id,
        mr.app_id,
        mr.diagnosis_code,
        mr.prescription,
        mr.notes,
        mr.follow_up_date,
        mr.created_at,
        a.scheduled_time,
        a.status AS appointment_status,
        p.patient_id,
        p.fullname AS patient_name,
        p.date_of_birth,
        p.phone,
        e.fullname AS doctor_name,
        s.specialty_name
      FROM medical_records mr
      JOIN appointments a ON mr.app_id = a.app_id
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN schedules sch ON a.schedule_id = sch.schedule_id
      JOIN doctors d ON sch.doctor_id = d.doctor_id
      JOIN employees e ON d.doctor_id = e.emp_id
      LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
      LEFT JOIN specialties s ON ds.specialty_id = s.specialty_id
      WHERE 1=1
    `;
    
    const params = {};
    
    if (patientId) {
      query += ` AND p.patient_id = @patientId`;
      params.patientId = patientId;
    }
    
    if (startDate) {
      query += ` AND mr.created_at >= @startDate`;
      params.startDate = startDate;
    }
    
    if (endDate) {
      query += ` AND mr.created_at <= @endDate`;
      params.endDate = endDate;
    }
    
    query += ` ORDER BY mr.created_at DESC`;
    
    // Pagination
    const offset = (page - 1) * limit;
    query += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    params.offset = offset;
    params.limit = limit;
    
    const result = await executeQuery(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM medical_records mr
      JOIN appointments a ON mr.app_id = a.app_id
      JOIN patients p ON a.patient_id = p.patient_id
      WHERE 1=1
    `;
    
    const countParams = {};
    if (patientId) {
      countQuery += ` AND p.patient_id = @patientId`;
      countParams.patientId = patientId;
    }
    if (startDate) {
      countQuery += ` AND mr.created_at >= @startDate`;
      countParams.startDate = startDate;
    }
    if (endDate) {
      countQuery += ` AND mr.created_at <= @endDate`;
      countParams.endDate = endDate;
    }
    
    const countResult = await executeQuery(countQuery, countParams);
    const total = countResult.recordset[0].total;
    
    res.json({
      success: true,
      data: result.recordset,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get medical records error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medical records',
      error: error.message
    });
  }
};

// @desc    Get medical record by ID
// @route   GET /api/medical-records/:id
// @access  Private
export const getMedicalRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        mr.*,
        a.scheduled_time,
        a.status AS appointment_status,
        p.patient_id,
        p.fullname AS patient_name,
        p.date_of_birth,
        p.gender,
        p.phone,
        p.email,
        p.address,
        p.bhyt_info,
        e.fullname AS doctor_name,
        s.specialty_name,
        c.clinic_name
      FROM medical_records mr
      JOIN appointments a ON mr.app_id = a.app_id
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN schedules sch ON a.schedule_id = sch.schedule_id
      JOIN doctors d ON sch.doctor_id = d.doctor_id
      JOIN employees e ON d.doctor_id = e.emp_id
      LEFT JOIN clinics c ON sch.clinic_id = c.clinic_id
      LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
      LEFT JOIN specialties s ON ds.specialty_id = s.specialty_id
      WHERE mr.record_id = @id
    `;
    
    const result = await executeQuery(query, { id });
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found'
      });
    }
    
    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Get medical record error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medical record',
      error: error.message
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
      SELECT 
        mr.record_id,
        mr.app_id,
        mr.diagnosis_code,
        mr.prescription,
        mr.notes,
        mr.follow_up_date,
        mr.created_at,
        a.scheduled_time,
        e.fullname AS doctor_name,
        s.specialty_name
      FROM medical_records mr
      JOIN appointments a ON mr.app_id = a.app_id
      JOIN schedules sch ON a.schedule_id = sch.schedule_id
      JOIN doctors d ON sch.doctor_id = d.doctor_id
      JOIN employees e ON d.doctor_id = e.emp_id
      LEFT JOIN doctor_specialties ds ON d.doctor_id = ds.doctor_id
      LEFT JOIN specialties s ON ds.specialty_id = s.specialty_id
      WHERE a.patient_id = @patientId
      ORDER BY mr.created_at DESC
    `;
    
    const result = await executeQuery(query, { patientId });
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Get patient medical records error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patient medical records',
      error: error.message
    });
  }
};

// @desc    Create new medical record
// @route   POST /api/medical-records
// @access  Private
export const createMedicalRecord = async (req, res) => {
  try {
    const { appId, diagnosisCode, prescription, notes, followUpDate } = req.body;
    
    // Validate required fields
    if (!appId || !diagnosisCode) {
      return res.status(400).json({
        success: false,
        message: 'Appointment ID and diagnosis code are required'
      });
    }
    
    // Check if appointment exists and is completed
    const appointmentQuery = `
      SELECT app_id, status 
      FROM appointments 
      WHERE app_id = @appId
    `;
    const appointmentResult = await executeQuery(appointmentQuery, { appId });
    
    if (appointmentResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if medical record already exists for this appointment
    const existingQuery = `
      SELECT record_id 
      FROM medical_records 
      WHERE app_id = @appId
    `;
    const existingResult = await executeQuery(existingQuery, { appId });
    
    if (existingResult.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Medical record already exists for this appointment'
      });
    }
    
    // Create medical record
    const insertQuery = `
      INSERT INTO medical_records (app_id, diagnosis_code, prescription, notes, follow_up_date)
      OUTPUT INSERTED.*
      VALUES (@appId, @diagnosisCode, @prescription, @notes, @followUpDate)
    `;
    
    const result = await executeQuery(insertQuery, {
      appId,
      diagnosisCode,
      prescription: prescription || null,
      notes: notes || null,
      followUpDate: followUpDate || null
    });
    
    res.status(201).json({
      success: true,
      message: 'Medical record created successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Create medical record error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating medical record',
      error: error.message
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
    
    // Check if record exists
    const checkQuery = `SELECT record_id FROM medical_records WHERE record_id = @id`;
    const checkResult = await executeQuery(checkQuery, { id });
    
    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found'
      });
    }
    
    // Update record
    const updateQuery = `
      UPDATE medical_records
      SET 
        diagnosis_code = COALESCE(@diagnosisCode, diagnosis_code),
        prescription = @prescription,
        notes = @notes,
        follow_up_date = @followUpDate
      OUTPUT INSERTED.*
      WHERE record_id = @id
    `;
    
    const result = await executeQuery(updateQuery, {
      id,
      diagnosisCode: diagnosisCode || null,
      prescription: prescription || null,
      notes: notes || null,
      followUpDate: followUpDate || null
    });
    
    res.json({
      success: true,
      message: 'Medical record updated successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Update medical record error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating medical record',
      error: error.message
    });
  }
};

// @desc    Delete medical record
// @route   DELETE /api/medical-records/:id
// @access  Private
export const deleteMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if record exists
    const checkQuery = `SELECT record_id FROM medical_records WHERE record_id = @id`;
    const checkResult = await executeQuery(checkQuery, { id });
    
    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found'
      });
    }
    
    // Delete record
    const deleteQuery = `DELETE FROM medical_records WHERE record_id = @id`;
    await executeQuery(deleteQuery, { id });
    
    res.json({
      success: true,
      message: 'Medical record deleted successfully'
    });
  } catch (error) {
    console.error('Delete medical record error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting medical record',
      error: error.message
    });
  }
};
