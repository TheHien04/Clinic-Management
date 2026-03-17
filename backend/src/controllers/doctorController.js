/**
 * Doctor Controller
 */

import { executeQuery } from '../config/database.js';
import { isValidEmail, isValidPhone, sanitizeInput } from '../utils/validators.js';

const normalizeStatus = (status) => String(status || '').toLowerCase();

const toSpecialtyList = (specialtyName) => {
  if (!specialtyName) return [];
  return String(specialtyName)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const averageScore = (rows) => {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + Number(row.loadScore || 0), 0) / rows.length);
};

const capacityIntelligenceQuery = `
  SELECT
    d.DoctorID,
    d.FullName,
    ISNULL(d.Status, 'active') AS DoctorStatus,
    ISNULL(s.SpecialtyName, 'General') AS SpecialtyName,
    COUNT(a.AppointmentID) AS Visits,
    SUM(CASE WHEN LOWER(ISNULL(a.Status, '')) LIKE 'pending%' THEN 1 ELSE 0 END) AS PendingCount,
    SUM(CASE WHEN LOWER(ISNULL(a.Status, '')) LIKE 'cancel%' THEN 1 ELSE 0 END) AS CancelledCount,
    COUNT(DISTINCT a.PatientID) AS UniquePatients
  FROM Doctors d
  LEFT JOIN Specialties s ON d.SpecialtyID = s.SpecialtyID
  LEFT JOIN Appointments a ON a.DoctorID = d.DoctorID
  GROUP BY d.DoctorID, d.FullName, d.Status, s.SpecialtyName
  ORDER BY d.FullName ASC
`;

const buildIntelligencePayload = (rawRows = []) => {
  const capacityRows = rawRows.map((row) => {
    const visits = Number(row.Visits || 0);
    const pendingCount = Number(row.PendingCount || 0);
    const cancelledCount = Number(row.CancelledCount || 0);
    const uniquePatients = Number(row.UniquePatients || 0);
    const status = normalizeStatus(row.DoctorStatus || 'active');

    const loadScore = Math.min(100,
      visits * 8 +
      pendingCount * 11 +
      cancelledCount * 9 +
      (status === 'onleave' ? 18 : 0)
    );

    const burnoutBand = loadScore >= 70 ? 'high' : loadScore >= 45 ? 'medium' : 'low';
    const capacityState = loadScore >= 70 ? 'overloaded' : loadScore >= 40 ? 'balanced' : 'available';

    return {
      id: Number(row.DoctorID),
      name: row.FullName,
      specialties: toSpecialtyList(row.SpecialtyName),
      visits,
      pendingCount,
      cancelledCount,
      uniquePatients,
      loadScore: Math.round(loadScore),
      burnoutBand,
      capacityState,
    };
  }).sort((a, b) => b.loadScore - a.loadScore);

  const highRows = capacityRows.filter((row) => row.burnoutBand === 'high');
  const mediumRows = capacityRows.filter((row) => row.burnoutBand === 'medium');
  const lowRows = capacityRows.filter((row) => row.burnoutBand === 'low');

  const cohorts = {
    high: { count: highRows.length, avg: averageScore(highRows) },
    medium: { count: mediumRows.length, avg: averageScore(mediumRows) },
    low: { count: lowRows.length, avg: averageScore(lowRows) },
  };

  const overloaded = capacityRows.filter((row) => row.capacityState === 'overloaded');
  const available = capacityRows.filter((row) => row.capacityState === 'available');

  const rebalanceQueue = overloaded.map((source, index) => {
    const target = available.find((candidate) => {
      if (candidate.id === source.id) return false;
      if (!source.specialties.length || !candidate.specialties.length) return true;
      return source.specialties.some((specialty) => candidate.specialties.includes(specialty));
    });

    return {
      rank: index + 1,
      sourceDoctorId: source.id,
      sourceDoctorName: source.name,
      sourceSpecialty: source.specialties[0] || 'General',
      targetDoctorId: target?.id || null,
      targetDoctorName: target?.name || null,
      shiftUnits: source.pendingCount > 0 ? Math.min(3, source.pendingCount) : 1,
      eta: source.pendingCount > 2 ? 'Same day' : '24h',
    };
  }).slice(0, 6);

  return {
    generatedAt: new Date().toISOString(),
    capacityRows,
    cohorts,
    rebalanceQueue,
  };
};

const fetchDoctorsIntelligenceSnapshot = async () => {
  const result = await executeQuery(capacityIntelligenceQuery, {});
  return buildIntelligencePayload(result.recordset || []);
};

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

/**
 * Get doctors capacity intelligence
 * GET /api/doctors/intelligence
 */
export const getDoctorsIntelligence = async (req, res) => {
  try {
    const snapshot = await fetchDoctorsIntelligenceSnapshot();

    res.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    console.error('Get doctors intelligence error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

/**
 * Apply doctors rebalance plan by reassigning pending appointments.
 * POST /api/doctors/rebalance/apply
 */
export const applyDoctorsRebalance = async (req, res) => {
  try {
    const snapshot = await fetchDoctorsIntelligenceSnapshot();
    const requestedPlans = Array.isArray(req.body?.plans) ? req.body.plans : null;
    const maxPlans = Math.max(1, Math.min(5, Number(req.body?.maxPlans || 2)));

    const basePlans = (requestedPlans && requestedPlans.length ? requestedPlans : snapshot.rebalanceQueue)
      .slice(0, maxPlans)
      .map((plan) => ({
        sourceDoctorId: Number(plan.sourceDoctorId || plan.source?.id || 0),
        targetDoctorId: Number(plan.targetDoctorId || plan.candidate?.id || 0),
        shiftUnits: Math.max(1, Math.min(5, Number(plan.shiftUnits || 1))),
      }))
      .filter((plan) => plan.sourceDoctorId > 0 && plan.targetDoctorId > 0 && plan.sourceDoctorId !== plan.targetDoctorId);

    if (!basePlans.length) {
      return res.json({
        success: true,
        message: 'No applicable rebalance plan found.',
        data: {
          appliedCount: 0,
          movedAppointments: 0,
          details: [],
          intelligence: snapshot,
        },
      });
    }

    const details = [];
    let movedAppointments = 0;

    for (const plan of basePlans) {
      const note = `Auto-rebalanced ${new Date().toISOString().slice(0, 16)} from doctor ${plan.sourceDoctorId} to ${plan.targetDoctorId}`;
      const updateResult = await executeQuery(
        `
          ;WITH cte AS (
            SELECT TOP (@shiftUnits) a.AppointmentID
            FROM Appointments a
            WHERE a.DoctorID = @sourceDoctorId
              AND LOWER(ISNULL(a.Status, '')) IN ('pending', 'confirmed', 'booked')
            ORDER BY a.AppointmentDate ASC, a.AppointmentTime ASC, a.AppointmentID ASC
          )
          UPDATE a
          SET
            a.DoctorID = @targetDoctorId,
            a.Notes = CASE
              WHEN a.Notes IS NULL OR LTRIM(RTRIM(a.Notes)) = '' THEN @note
              ELSE CONCAT(a.Notes, N' | ', @note)
            END
          FROM Appointments a
          INNER JOIN cte ON cte.AppointmentID = a.AppointmentID;
        `,
        {
          shiftUnits: plan.shiftUnits,
          sourceDoctorId: plan.sourceDoctorId,
          targetDoctorId: plan.targetDoctorId,
          note,
        }
      );

      const moved = Number(updateResult?.rowsAffected?.[0] || 0);
      movedAppointments += moved;
      details.push({
        ...plan,
        moved,
      });
    }

    const updatedSnapshot = await fetchDoctorsIntelligenceSnapshot();

    res.json({
      success: true,
      message: movedAppointments > 0
        ? `Rebalance applied. Moved ${movedAppointments} appointment(s).`
        : 'Rebalance attempted but no pending appointments were moved.',
      data: {
        appliedCount: details.length,
        movedAppointments,
        details,
        intelligence: updatedSnapshot,
      },
    });
  } catch (error) {
    console.error('Apply doctors rebalance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

export default {
  getAllDoctors,
  getDoctorsIntelligence,
  applyDoctorsRebalance,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorSchedule
};
