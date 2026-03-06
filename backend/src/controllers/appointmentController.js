/**
 * Appointment Controller
 */

import { executeQuery } from '../config/database.js';
import { isValidDate } from '../utils/validators.js';

/**
 * Get all appointments
 * GET /api/appointments
 */
export const getAllAppointments = async (req, res) => {
  try {
    const { status, date, doctorId, patientId, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        a.AppointmentID,
        a.AppointmentDate,
        a.AppointmentTime,
        a.Status,
        a.Notes,
        p.PatientID,
        p.FullName as PatientName,
        p.PhoneNumber as PatientPhone,
        d.DoctorID,
        d.FullName as DoctorName,
        s.SpecialtyName
      FROM Appointments a
      LEFT JOIN Patients p ON a.PatientID = p.PatientID
      LEFT JOIN Doctors d ON a.DoctorID = d.DoctorID
      LEFT JOIN Specialties s ON d.SpecialtyID = s.SpecialtyID
      WHERE 1=1
    `;

    const params = {};

    if (status) {
      query += ` AND a.Status = @status`;
      params.status = status;
    }

    if (date) {
      query += ` AND a.AppointmentDate = @date`;
      params.date = date;
    }

    if (doctorId) {
      query += ` AND a.DoctorID = @doctorId`;
      params.doctorId = doctorId;
    }

    if (patientId) {
      query += ` AND a.PatientID = @patientId`;
      params.patientId = patientId;
    }

    query += ` ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC`;
    query += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    
    params.offset = parseInt(offset);
    params.limit = parseInt(limit);

    const result = await executeQuery(query, params);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get appointment by ID
 * GET /api/appointments/:id
 */
export const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        a.*,
        p.FullName as PatientName,
        p.PhoneNumber as PatientPhone,
        p.Email as PatientEmail,
        d.FullName as DoctorName,
        s.SpecialtyName
      FROM Appointments a
      LEFT JOIN Patients p ON a.PatientID = p.PatientID
      LEFT JOIN Doctors d ON a.DoctorID = d.DoctorID
      LEFT JOIN Specialties s ON d.SpecialtyID = s.SpecialtyID
      WHERE a.AppointmentID = @id
    `;

    const result = await executeQuery(query, { id });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Create new appointment
 * POST /api/appointments
 */
export const createAppointment = async (req, res) => {
  try {
    const { patientId, doctorId, appointmentDate, appointmentTime, notes } = req.body;

    // Validate required fields
    if (!patientId || !doctorId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate date
    if (!isValidDate(appointmentDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Check if slot is available
    const checkQuery = `
      SELECT AppointmentID 
      FROM Appointments 
      WHERE DoctorID = @doctorId 
      AND AppointmentDate = @appointmentDate 
      AND AppointmentTime = @appointmentTime
      AND Status != 'cancelled'
    `;

    const existing = await executeQuery(checkQuery, { doctorId, appointmentDate, appointmentTime });

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is not available'
      });
    }

    // Create appointment
    const insertQuery = `
      INSERT INTO Appointments (PatientID, DoctorID, AppointmentDate, AppointmentTime, Status, Notes, CreatedDate)
      OUTPUT INSERTED.*
      VALUES (@patientId, @doctorId, @appointmentDate, @appointmentTime, 'booked', @notes, GETDATE())
    `;

    const result = await executeQuery(insertQuery, {
      patientId,
      doctorId,
      appointmentDate,
      appointmentTime,
      notes: notes || null
    });

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update appointment
 * PUT /api/appointments/:id
 */
export const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { appointmentDate, appointmentTime, status, notes } = req.body;

    const updateQuery = `
      UPDATE Appointments
      SET 
        AppointmentDate = COALESCE(@appointmentDate, AppointmentDate),
        AppointmentTime = COALESCE(@appointmentTime, AppointmentTime),
        Status = COALESCE(@status, Status),
        Notes = COALESCE(@notes, Notes),
        UpdatedDate = GETDATE()
      OUTPUT INSERTED.*
      WHERE AppointmentID = @id
    `;

    const result = await executeQuery(updateQuery, {
      id,
      appointmentDate: appointmentDate || null,
      appointmentTime: appointmentTime || null,
      status: status || null,
      notes: notes || null
    });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      message: 'Appointment updated successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Delete appointment
 * DELETE /api/appointments/:id
 */
export const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    const deleteQuery = `
      DELETE FROM Appointments
      WHERE AppointmentID = @id
    `;

    const result = await executeQuery(deleteQuery, { id });

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment
};
