/**
 * Patient Controller
 */

import { executeQuery } from '../config/database.js';
import { isValidEmail, isValidPhone, sanitizeInput } from '../utils/validators.js';

/**
 * Get all patients
 * GET /api/patients
 */
export const getAllPatients = async (req, res) => {
  try {
    const { search, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        PatientID,
        FullName,
        DateOfBirth,
        Gender,
        PhoneNumber,
        Email,
        Address,
        MedicalHistory,
        CreatedDate
      FROM Patients
      WHERE 1=1
    `;

    const params = { offset: parseInt(offset), limit: parseInt(limit) };

    if (search) {
      query += ` AND (FullName LIKE @search OR PhoneNumber LIKE @search OR Email LIKE @search)`;
      params.search = `%${search}%`;
    }

    query += ` ORDER BY CreatedDate DESC`;
    query += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    const result = await executeQuery(query, params);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
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

    const query = `
      SELECT * FROM Patients WHERE PatientID = @id
    `;

    const result = await executeQuery(query, { id });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      data: result.recordset[0]
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
    const checkQuery = `SELECT PatientID FROM Patients WHERE PhoneNumber = @phoneNumber`;
    const existing = await executeQuery(checkQuery, { phoneNumber });

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Patient with this phone number already exists'
      });
    }

    // Create patient
    const insertQuery = `
      INSERT INTO Patients (FullName, DateOfBirth, Gender, PhoneNumber, Email, Address, MedicalHistory, CreatedDate)
      OUTPUT INSERTED.*
      VALUES (@fullName, @dateOfBirth, @gender, @phoneNumber, @email, @address, @medicalHistory, GETDATE())
    `;

    const result = await executeQuery(insertQuery, {
      fullName: sanitizeInput(fullName),
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      phoneNumber,
      email: email || null,
      address: sanitizeInput(address) || null,
      medicalHistory: sanitizeInput(medicalHistory) || null
    });

    res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      data: result.recordset[0]
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
    const { fullName, dateOfBirth, gender, phoneNumber, email, address, medicalHistory } = req.body;

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
    `;

    const result = await executeQuery(updateQuery, {
      id,
      fullName: fullName ? sanitizeInput(fullName) : null,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      phoneNumber: phoneNumber || null,
      email: email || null,
      address: address ? sanitizeInput(address) : null,
      medicalHistory: medicalHistory ? sanitizeInput(medicalHistory) : null
    });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      message: 'Patient updated successfully',
      data: result.recordset[0]
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
    const checkQuery = `SELECT COUNT(*) as count FROM Appointments WHERE PatientID = @id`;
    const check = await executeQuery(checkQuery, { id });

    if (check.recordset[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete patient with existing appointments'
      });
    }

    const deleteQuery = `DELETE FROM Patients WHERE PatientID = @id`;
    const result = await executeQuery(deleteQuery, { id });

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

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
      WHERE a.PatientID = @id
      ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC
    `;

    const result = await executeQuery(query, { id });

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
  getPatientHistory
};
