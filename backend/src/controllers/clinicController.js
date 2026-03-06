/**
 * Clinic Controller - Manages clinic locations
 */

import { executeQuery } from '../config/database.js';

// Get all clinics
export const getAllClinics = async (req, res) => {
  try {
    const query = `SELECT * FROM clinics ORDER BY clinic_name`;
    const result = await executeQuery(query);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Get clinics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clinics',
      error: error.message
    });
  }
};

// Get clinic by ID
export const getClinicById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await executeQuery(`SELECT * FROM clinics WHERE clinic_id = @id`, { id });
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Get clinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clinic',
      error: error.message
    });
  }
};

// Create clinic
export const createClinic = async (req, res) => {
  try {
    const { clinicName, address, phone } = req.body;
    
    if (!clinicName || !address) {
      return res.status(400).json({
        success: false,
        message: 'Clinic name and address are required'
      });
    }
    
    const query = `
      INSERT INTO clinics (clinic_name, address, phone)
      OUTPUT INSERTED.*
      VALUES (@clinicName, @address, @phone)
    `;
    
    const result = await executeQuery(query, { clinicName, address, phone: phone || null });
    
    res.status(201).json({
      success: true,
      message: 'Clinic created successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Create clinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating clinic',
      error: error.message
    });
  }
};

// Update clinic
export const updateClinic = async (req, res) => {
  try {
    const { id } = req.params;
    const { clinicName, address, phone } = req.body;
    
    const query = `
      UPDATE clinics
      SET 
        clinic_name = COALESCE(@clinicName, clinic_name),
        address = COALESCE(@address, address),
        phone = @phone
      OUTPUT INSERTED.*
      WHERE clinic_id = @id
    `;
    
    const result = await executeQuery(query, { id, clinicName, address, phone });
    
    res.json({
      success: true,
      message: 'Clinic updated successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Update clinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating clinic',
      error: error.message
    });
  }
};

// Delete clinic
export const deleteClinic = async (req, res) => {
  try {
    const { id } = req.params;
    await executeQuery(`DELETE FROM clinics WHERE clinic_id = @id`, { id });
    
    res.json({
      success: true,
      message: 'Clinic deleted successfully'
    });
  } catch (error) {
    console.error('Delete clinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting clinic',
      error: error.message
    });
  }
};

export default { getAllClinics, getClinicById, createClinic, updateClinic, deleteClinic };
