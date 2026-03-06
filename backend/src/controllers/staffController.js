/**
 * Staff Controller - Manages non-doctor employees (receptionist, accountant, manager)
 */

import { executeQuery } from '../config/database.js';

// Get all staff with employee details
export const getAllStaff = async (req, res) => {
  try {
    const { search, clinicId, position, status = 'active', limit = 100 } = req.query;
    
    let query = `
      SELECT 
        s.staff_id,
        s.position,
        s.clinic_id,
        e.fullname,
        e.date_of_birth,
        e.gender,
        e.phone,
        e.email,
        e.address,
        e.status,
        c.clinic_name,
        c.address AS clinic_address
      FROM staff s
      JOIN employees e ON s.staff_id = e.emp_id
      LEFT JOIN clinics c ON s.clinic_id = c.clinic_id
      WHERE e.employee_type = 'S'
    `;
    
    const params = {};
    
    if (status) {
      query += ` AND e.status = @status`;
      params.status = status;
    }
    
    if (search) {
      query += ` AND (e.fullname LIKE @search OR e.phone LIKE @search OR e.email LIKE @search)`;
      params.search = `%${search}%`;
    }
    
    if (clinicId) {
      query += ` AND s.clinic_id = @clinicId`;
      params.clinicId = clinicId;
    }
    
    if (position) {
      query += ` AND s.position = @position`;
      params.position = position;
    }
    
    query += ` ORDER BY e.fullname OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY`;
    params.limit = parseInt(limit);
    
    const result = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff',
      error: error.message
    });
  }
};

// Get staff by ID
export const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        s.*,
        e.fullname,
        e.date_of_birth,
        e.gender,
        e.phone,
        e.email,
        e.address,
        e.status,
        c.clinic_name
      FROM staff s
      JOIN employees e ON s.staff_id = e.emp_id
      LEFT JOIN clinics c ON s.clinic_id = c.clinic_id
      WHERE s.staff_id = @id
    `;
    
    const result = await executeQuery(query, { id });
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }
    
    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff',
      error: error.message
    });
  }
};

// Create new staff
export const createStaff = async (req, res) => {
  try {
    const { fullname, dateOfBirth, gender, phone, email, address, position, clinicId } = req.body;
    
    // Validate required fields
    if (!fullname || !phone || !position) {
      return res.status(400).json({
        success: false,
        message: 'Fullname, phone, and position are required'
      });
    }
    
    // Create employee first
    const empQuery = `
      INSERT INTO employees (fullname, date_of_birth, gender, phone, email, address, employee_type, status)
      OUTPUT INSERTED.emp_id
      VALUES (@fullname, @dateOfBirth, @gender, @phone, @email, @address, 'S', 'active')
    `;
    
    const empResult = await executeQuery(empQuery, {
      fullname,
      dateOfBirth: dateOfBirth || null,
      gender: gender || 'Other',
      phone,
      email: email || null,
      address: address || null
    });
    
    const empId = empResult.recordset[0].emp_id;
    
    // Create staff record
    const staffQuery = `
      INSERT INTO staff (staff_id, position, clinic_id)
      OUTPUT INSERTED.*
      VALUES (@empId, @position, @clinicId)
    `;
    
    const staffResult = await executeQuery(staffQuery, {
      empId,
      position,
      clinicId: clinicId || null
    });
    
    res.status(201).json({
      success: true,
      message: 'Staff created successfully',
      data: { emp_id: empId, ...staffResult.recordset[0] }
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating staff',
      error: error.message
    });
  }
};

// Update staff
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, dateOfBirth, gender, phone, email, address, position, clinicId, status } = req.body;
    
    // Update employee
    const empQuery = `
      UPDATE employees
      SET 
        fullname = COALESCE(@fullname, fullname),
        date_of_birth = COALESCE(@dateOfBirth, date_of_birth),
        gender = COALESCE(@gender, gender),
        phone = COALESCE(@phone, phone),
        email = @email,
        address = @address,
        status = COALESCE(@status, status)
      WHERE emp_id = @id AND employee_type = 'S'
    `;
    
    await executeQuery(empQuery, {
      id,
      fullname,
      dateOfBirth,
      gender,
      phone,
      email,
      address,
      status
    });
    
    // Update staff
    const staffQuery = `
      UPDATE staff
      SET 
        position = COALESCE(@position, position),
        clinic_id = @clinicId
      OUTPUT INSERTED.*
      WHERE staff_id = @id
    `;
    
    const result = await executeQuery(staffQuery, {
      id,
      position,
      clinicId
    });
    
    res.json({
      success: true,
      message: 'Staff updated successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating staff',
      error: error.message
    });
  }
};

// Delete staff
export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete staff (cascade will handle employee)
    await executeQuery(`DELETE FROM staff WHERE staff_id = @id`, { id });
    await executeQuery(`DELETE FROM employees WHERE emp_id = @id`, { id });
    
    res.json({
      success: true,
      message: 'Staff deleted successfully'
    });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting staff',
      error: error.message
    });
  }
};

export default {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff
};
