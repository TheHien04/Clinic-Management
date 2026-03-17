/**
 * Staff Controller - Manages non-doctor employees
 */

import { executeQuery } from '../config/database.js';

const baseSelect = `
  SELECT
    s.StaffID AS staff_id,
    s.Position AS position,
    s.ClinicID AS clinic_id,
    s.FullName AS fullname,
    s.DateOfBirth AS date_of_birth,
    s.Gender AS gender,
    s.PhoneNumber AS phone,
    s.Email AS email,
    s.Address AS address,
    s.Status AS status,
    c.ClinicName AS clinic_name,
    c.Address AS clinic_address,
    s.CreatedDate AS created_date,
    s.UpdatedDate AS updated_date
  FROM Staff s
  LEFT JOIN Clinics c ON s.ClinicID = c.ClinicID
`;

// Get all staff with filtering
export const getAllStaff = async (req, res) => {
  try {
    const { search, clinicId, position, status = 'active', limit = 100 } = req.query;

    let query = `${baseSelect} WHERE 1=1`;
    const params = { limit: Math.min(200, Math.max(1, Number(limit) || 100)) };

    if (status) {
      query += ' AND LOWER(s.Status) = LOWER(@status)';
      params.status = status;
    }

    if (search) {
      query += ' AND (s.FullName LIKE @search OR s.PhoneNumber LIKE @search OR s.Email LIKE @search)';
      params.search = `%${search}%`;
    }

    if (clinicId) {
      query += ' AND s.ClinicID = @clinicId';
      params.clinicId = Number(clinicId);
    }

    if (position) {
      query += ' AND s.Position = @position';
      params.position = position;
    }

    query += ' ORDER BY s.FullName OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY';

    const result = await executeQuery(query, params);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff',
      error: error.message,
    });
  }
};

// Get staff by ID
export const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `${baseSelect} WHERE s.StaffID = @id`;
    const result = await executeQuery(query, { id: Number(id) });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found',
      });
    }

    res.json({
      success: true,
      data: result.recordset[0],
    });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff',
      error: error.message,
    });
  }
};

// Create new staff
export const createStaff = async (req, res) => {
  try {
    const { fullname, dateOfBirth, gender, phone, email, address, position, clinicId } = req.body;

    if (!fullname || !phone || !position) {
      return res.status(400).json({
        success: false,
        message: 'Fullname, phone, and position are required',
      });
    }

    const insertQuery = `
      INSERT INTO Staff (FullName, DateOfBirth, Gender, PhoneNumber, Email, Address, Position, ClinicID, Status, CreatedDate)
      OUTPUT
        INSERTED.StaffID AS staff_id,
        INSERTED.Position AS position,
        INSERTED.ClinicID AS clinic_id,
        INSERTED.FullName AS fullname,
        INSERTED.DateOfBirth AS date_of_birth,
        INSERTED.Gender AS gender,
        INSERTED.PhoneNumber AS phone,
        INSERTED.Email AS email,
        INSERTED.Address AS address,
        INSERTED.Status AS status,
        INSERTED.CreatedDate AS created_date,
        INSERTED.UpdatedDate AS updated_date
      VALUES (@fullname, @dateOfBirth, @gender, @phone, @email, @address, @position, @clinicId, 'active', GETDATE())
    `;

    const result = await executeQuery(insertQuery, {
      fullname,
      dateOfBirth: dateOfBirth || null,
      gender: gender || 'Other',
      phone,
      email: email || null,
      address: address || null,
      position,
      clinicId: clinicId ? Number(clinicId) : null,
    });

    res.status(201).json({
      success: true,
      message: 'Staff created successfully',
      data: result.recordset[0],
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating staff',
      error: error.message,
    });
  }
};

// Update staff
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, dateOfBirth, gender, phone, email, address, position, clinicId, status } = req.body;

    const updateQuery = `
      UPDATE Staff
      SET
        FullName = COALESCE(@fullname, FullName),
        DateOfBirth = COALESCE(@dateOfBirth, DateOfBirth),
        Gender = COALESCE(@gender, Gender),
        PhoneNumber = COALESCE(@phone, PhoneNumber),
        Email = @email,
        Address = @address,
        Position = COALESCE(@position, Position),
        ClinicID = @clinicId,
        Status = COALESCE(@status, Status),
        UpdatedDate = GETDATE()
      OUTPUT
        INSERTED.StaffID AS staff_id,
        INSERTED.Position AS position,
        INSERTED.ClinicID AS clinic_id,
        INSERTED.FullName AS fullname,
        INSERTED.DateOfBirth AS date_of_birth,
        INSERTED.Gender AS gender,
        INSERTED.PhoneNumber AS phone,
        INSERTED.Email AS email,
        INSERTED.Address AS address,
        INSERTED.Status AS status,
        INSERTED.CreatedDate AS created_date,
        INSERTED.UpdatedDate AS updated_date
      WHERE StaffID = @id
    `;

    const result = await executeQuery(updateQuery, {
      id: Number(id),
      fullname: fullname || null,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      position: position || null,
      clinicId: clinicId ? Number(clinicId) : null,
      status: status || null,
    });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found',
      });
    }

    res.json({
      success: true,
      message: 'Staff updated successfully',
      data: result.recordset[0],
    });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating staff',
      error: error.message,
    });
  }
};

// Delete staff
export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    const check = await executeQuery('SELECT StaffID FROM Staff WHERE StaffID = @id', { id: Number(id) });
    if (check.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found',
      });
    }

    await executeQuery('DELETE FROM Staff WHERE StaffID = @id', { id: Number(id) });

    res.json({
      success: true,
      message: 'Staff deleted successfully',
    });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting staff',
      error: error.message,
    });
  }
};

export default {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
};
