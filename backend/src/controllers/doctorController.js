/**
 * Doctor Controller
 */

import { executeQuery } from '../config/database.js';
import { isValidEmail, isValidPhone, sanitizeInput } from '../utils/validators.js';

/**
 * Get all doctors
 * GET /api/doctors
 */
export const getAllDoctors = async (req, res) => {
  try {
    const { specialtyId, search, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        d.DoctorID,
        d.FullName,
        d.PhoneNumber,
        d.Email,
        d.Qualifications,
        d.Experience,
        d.SpecialtyID,
        s.SpecialtyName,
        d.CreatedDate
      FROM Doctors d
      LEFT JOIN Specialties s ON d.SpecialtyID = s.SpecialtyID
      WHERE 1=1
    `;

    const params = { offset: parseInt(offset), limit: parseInt(limit) };

    if (specialtyId) {
      query += ` AND d.SpecialtyID = @specialtyId`;
      params.specialtyId = specialtyId;
    }

    if (search) {
      query += ` AND (d.FullName LIKE @search OR d.Email LIKE @search OR s.SpecialtyName LIKE @search)`;
      params.search = `%${search}%`;
    }

    query += ` ORDER BY d.CreatedDate DESC`;
    query += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    const result = await executeQuery(query, params);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get doctor by ID
 * GET /api/doctors/:id
 */
export const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        d.*,
        s.SpecialtyName
      FROM Doctors d
      LEFT JOIN Specialties s ON d.SpecialtyID = s.SpecialtyID
      WHERE d.DoctorID = @id
    `;

    const result = await executeQuery(query, { id });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Get doctor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Create new doctor
 * POST /api/doctors
 */
export const createDoctor = async (req, res) => {
  try {
    const { fullName, specialtyId, phoneNumber, email, qualifications, experience } = req.body;

    // Validate required fields
    if (!fullName || !specialtyId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Full name, specialty, and phone number are required'
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

    // Check if doctor with same email exists
    if (email) {
      const checkQuery = `SELECT DoctorID FROM Doctors WHERE Email = @email`;
      const existing = await executeQuery(checkQuery, { email });

      if (existing.recordset.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Doctor with this email already exists'
        });
      }
    }

    // Create doctor
    const insertQuery = `
      INSERT INTO Doctors (FullName, SpecialtyID, PhoneNumber, Email, Qualifications, Experience, CreatedDate)
      OUTPUT INSERTED.*
      VALUES (@fullName, @specialtyId, @phoneNumber, @email, @qualifications, @experience, GETDATE())
    `;

    const result = await executeQuery(insertQuery, {
      fullName: sanitizeInput(fullName),
      specialtyId,
      phoneNumber,
      email: email || null,
      qualifications: sanitizeInput(qualifications) || null,
      experience: experience || null
    });

    res.status(201).json({
      success: true,
      message: 'Doctor created successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Create doctor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update doctor
 * PUT /api/doctors/:id
 */
export const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, specialtyId, phoneNumber, email, qualifications, experience } = req.body;

    // Validate email if provided
    if (email && !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const updateQuery = `
      UPDATE Doctors
      SET 
        FullName = COALESCE(@fullName, FullName),
        SpecialtyID = COALESCE(@specialtyId, SpecialtyID),
        PhoneNumber = COALESCE(@phoneNumber, PhoneNumber),
        Email = COALESCE(@email, Email),
        Qualifications = COALESCE(@qualifications, Qualifications),
        Experience = COALESCE(@experience, Experience),
        UpdatedDate = GETDATE()
      OUTPUT INSERTED.*
      WHERE DoctorID = @id
    `;

    const result = await executeQuery(updateQuery, {
      id,
      fullName: fullName ? sanitizeInput(fullName) : null,
      specialtyId: specialtyId || null,
      phoneNumber: phoneNumber || null,
      email: email || null,
      qualifications: qualifications ? sanitizeInput(qualifications) : null,
      experience: experience || null
    });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    res.json({
      success: true,
      message: 'Doctor updated successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Update doctor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Delete doctor
 * DELETE /api/doctors/:id
 */
export const deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if doctor has appointments
    const checkQuery = `SELECT COUNT(*) as count FROM Appointments WHERE DoctorID = @id`;
    const check = await executeQuery(checkQuery, { id });

    if (check.recordset[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete doctor with existing appointments'
      });
    }

    const deleteQuery = `DELETE FROM Doctors WHERE DoctorID = @id`;
    const result = await executeQuery(deleteQuery, { id });

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    res.json({
      success: true,
      message: 'Doctor deleted successfully'
    });
  } catch (error) {
    console.error('Delete doctor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get doctor schedule
 * GET /api/doctors/:id/schedule
 */
export const getDoctorSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    let query = `
      SELECT 
        s.*,
        d.FullName as DoctorName
      FROM Schedules s
      LEFT JOIN Doctors d ON s.DoctorID = d.DoctorID
      WHERE s.DoctorID = @id
    `;

    const params = { id };

    if (date) {
      query += ` AND s.ScheduleDate = @date`;
      params.date = date;
    }

    query += ` ORDER BY s.ScheduleDate, s.StartTime`;

    const result = await executeQuery(query, params);

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Get doctor schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorSchedule
};
