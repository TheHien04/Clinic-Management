/**
 * Specialty Controller - Manages medical specialties
 */

import { executeQuery } from '../config/database.js';

// Get all specialties
export const getAllSpecialties = async (req, res) => {
  try {
    const query = `SELECT * FROM specialties ORDER BY specialty_name`;
    const result = await executeQuery(query);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Get specialties error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching specialties',
      error: error.message
    });
  }
};

// Get specialty by ID
export const getSpecialtyById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await executeQuery(`SELECT * FROM specialties WHERE specialty_id = @id`, { id });
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Specialty not found'
      });
    }
    
    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Get specialty error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching specialty',
      error: error.message
    });
  }
};

// Create specialty
export const createSpecialty = async (req, res) => {
  try {
    const { specialtyName } = req.body;
    
    if (!specialtyName) {
      return res.status(400).json({
        success: false,
        message: 'Specialty name is required'
      });
    }
    
    const query = `
      INSERT INTO specialties (specialty_name)
      OUTPUT INSERTED.*
      VALUES (@specialtyName)
    `;
    
    const result = await executeQuery(query, { specialtyName });
    
    res.status(201).json({
      success: true,
      message: 'Specialty created successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Create specialty error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating specialty',
      error: error.message
    });
  }
};

// Update specialty
export const updateSpecialty = async (req, res) => {
  try {
    const { id } = req.params;
    const { specialtyName } = req.body;
    
    const query = `
      UPDATE specialties
      SET specialty_name = @specialtyName
      OUTPUT INSERTED.*
      WHERE specialty_id = @id
    `;
    
    const result = await executeQuery(query, { id, specialtyName });
    
    res.json({
      success: true,
      message: 'Specialty updated successfully',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Update specialty error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating specialty',
      error: error.message
    });
  }
};

// Delete specialty
export const deleteSpecialty = async (req, res) => {
  try {
    const { id } = req.params;
    await executeQuery(`DELETE FROM specialties WHERE specialty_id = @id`, { id });
    
    res.json({
      success: true,
      message: 'Specialty deleted successfully'
    });
  } catch (error) {
    console.error('Delete specialty error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting specialty',
      error: error.message
    });
  }
};

export default { getAllSpecialties, getSpecialtyById, createSpecialty, updateSpecialty, deleteSpecialty };
