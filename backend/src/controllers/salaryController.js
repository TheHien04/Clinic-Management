/**
 * Salary Controller - Manages salary calculations and records
 */

import { executeQuery } from '../config/database.js';

// Get all salary records with pagination and filtering
export const getAllSalaryRecords = async (req, res) => {
  try {
    const { month, year, employeeType, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereConditions = [];
    let params = { limit: parseInt(limit), offset };
    
    if (month) {
      whereConditions.push('MONTH(sr.month) = @month');
      params.month = month;
    }
    
    if (year) {
      whereConditions.push('YEAR(sr.month) = @year');
      params.year = year;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM salary_records sr
      ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, params);
    const total = countResult.recordset[0].total;
    
    // Get paginated records with employee details
    const query = `
      SELECT 
        sr.salary_record_id,
        sr.emp_id,
        e.fullname,
        e.type as employee_type,
        sr.month,
        sr.total_salary,
        sr.calculated_at,
        CASE 
          WHEN e.type = 'D' THEN dsr.appointment_count
          WHEN e.type = 'S' THEN ssr.kpi_allowance
          ELSE NULL
        END as detail_info
      FROM salary_records sr
      JOIN employees e ON sr.emp_id = e.emp_id
      LEFT JOIN doctor_salary_records dsr ON sr.salary_record_id = dsr.salary_record_id
      LEFT JOIN staff_salary_records ssr ON sr.salary_record_id = ssr.salary_record_id
      ${whereClause}
      ORDER BY sr.month DESC, sr.calculated_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;
    
    const result = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: result.recordset,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get salary records error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching salary records',
      error: error.message
    });
  }
};

// Get salary record by ID
export const getSalaryRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        sr.*,
        e.fullname,
        e.type as employee_type,
        dsr.appointment_count,
        dsr.base_salary as doctor_base_salary,
        dsr.bonus as doctor_bonus,
        ssr.base_salary as staff_base_salary,
        ssr.kpi_allowance
      FROM salary_records sr
      JOIN employees e ON sr.emp_id = e.emp_id
      LEFT JOIN doctor_salary_records dsr ON sr.salary_record_id = dsr.salary_record_id
      LEFT JOIN staff_salary_records ssr ON sr.salary_record_id = ssr.salary_record_id
      WHERE sr.salary_record_id = @id
    `;
    
    const result = await executeQuery(query, { id });
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found'
      });
    }
    
    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Get salary record error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching salary record',
      error: error.message
    });
  }
};

// Calculate and generate salaries for a specific month
export const calculateSalaries = async (req, res) => {
  try {
    const { month, year } = req.body;
    
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required'
      });
    }
    
    const targetMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    
    // Check if salaries already calculated for this month
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM salary_records
      WHERE MONTH(month) = @month AND YEAR(month) = @year
    `;
    const checkResult = await executeQuery(checkQuery, { month, year });
    
    if (checkResult.recordset[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Salaries already calculated for this month'
      });
    }
    
    // Calculate doctor salaries
    const doctorQuery = `
      INSERT INTO salary_records (emp_id, month, total_salary, calculated_at)
      OUTPUT INSERTED.salary_record_id, INSERTED.emp_id, INSERTED.total_salary
      SELECT 
        d.doctor_id as emp_id,
        @targetMonth as month,
        10000000 + (COUNT(a.app_id) * 200000) as total_salary,
        GETDATE() as calculated_at
      FROM doctors d
      LEFT JOIN schedules s ON d.doctor_id = s.doctor_id
      LEFT JOIN appointments a ON s.sche_id = a.sche_id 
        AND MONTH(a.app_date) = @month 
        AND YEAR(a.app_date) = @year
        AND a.status = 'completed'
      WHERE d.status = 'active'
      GROUP BY d.doctor_id
    `;
    
    const doctorResult = await executeQuery(doctorQuery, { targetMonth, month, year });
    
    // Insert doctor salary details
    for (const record of doctorResult.recordset) {
      const detailQuery = `
        INSERT INTO doctor_salary_records (salary_record_id, appointment_count, base_salary, bonus)
        SELECT 
          @salaryRecordId,
          COUNT(a.app_id),
          10000000,
          COUNT(a.app_id) * 200000
        FROM doctors d
        LEFT JOIN schedules s ON d.doctor_id = s.doctor_id
        LEFT JOIN appointments a ON s.sche_id = a.sche_id 
          AND MONTH(a.app_date) = @month 
          AND YEAR(a.app_date) = @year
          AND a.status = 'completed'
        WHERE d.doctor_id = @empId
        GROUP BY d.doctor_id
      `;
      
      await executeQuery(detailQuery, { 
        salaryRecordId: record.salary_record_id,
        empId: record.emp_id,
        month,
        year
      });
    }
    
    // Calculate staff salaries
    const staffQuery = `
      INSERT INTO salary_records (emp_id, month, total_salary, calculated_at)
      OUTPUT INSERTED.salary_record_id, INSERTED.emp_id, INSERTED.total_salary
      SELECT 
        s.staff_id as emp_id,
        @targetMonth as month,
        8000000 + 2000000 as total_salary,
        GETDATE() as calculated_at
      FROM staff s
      JOIN employees e ON s.staff_id = e.emp_id
      WHERE e.status = 'active'
    `;
    
    const staffResult = await executeQuery(staffQuery, { targetMonth });
    
    // Insert staff salary details
    for (const record of staffResult.recordset) {
      const detailQuery = `
        INSERT INTO staff_salary_records (salary_record_id, base_salary, kpi_allowance)
        VALUES (@salaryRecordId, 8000000, 2000000)
      `;
      
      await executeQuery(detailQuery, { salaryRecordId: record.salary_record_id });
    }
    
    const totalRecords = doctorResult.recordset.length + staffResult.recordset.length;
    
    res.status(201).json({
      success: true,
      message: `Successfully calculated salaries for ${totalRecords} employees`,
      data: {
        month: targetMonth,
        doctorCount: doctorResult.recordset.length,
        staffCount: staffResult.recordset.length,
        totalRecords
      }
    });
  } catch (error) {
    console.error('Calculate salaries error:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating salaries',
      error: error.message
    });
  }
};

// Get salary summary by month
export const getSalarySummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required'
      });
    }
    
    const query = `
      SELECT 
        e.type as employee_type,
        COUNT(*) as employee_count,
        SUM(sr.total_salary) as total_salary,
        AVG(sr.total_salary) as average_salary,
        MIN(sr.total_salary) as min_salary,
        MAX(sr.total_salary) as max_salary
      FROM salary_records sr
      JOIN employees e ON sr.emp_id = e.emp_id
      WHERE MONTH(sr.month) = @month AND YEAR(sr.month) = @year
      GROUP BY e.type
    `;
    
    const result = await executeQuery(query, { month, year });
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Get salary summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching salary summary',
      error: error.message
    });
  }
};

// Delete salary record
export const deleteSalaryRecord = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get record details first to determine type
    const recordQuery = `
      SELECT sr.*, e.type
      FROM salary_records sr
      JOIN employees e ON sr.emp_id = e.emp_id
      WHERE sr.salary_record_id = @id
    `;
    const recordResult = await executeQuery(recordQuery, { id });
    
    if (recordResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found'
      });
    }
    
    const record = recordResult.recordset[0];
    
    // Delete detail records first
    if (record.type === 'D') {
      await executeQuery(`DELETE FROM doctor_salary_records WHERE salary_record_id = @id`, { id });
    } else if (record.type === 'S') {
      await executeQuery(`DELETE FROM staff_salary_records WHERE salary_record_id = @id`, { id });
    }
    
    // Delete main record
    await executeQuery(`DELETE FROM salary_records WHERE salary_record_id = @id`, { id });
    
    res.json({
      success: true,
      message: 'Salary record deleted successfully'
    });
  } catch (error) {
    console.error('Delete salary record error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting salary record',
      error: error.message
    });
  }
};

export default { 
  getAllSalaryRecords, 
  getSalaryRecordById, 
  calculateSalaries, 
  getSalarySummary,
  deleteSalaryRecord 
};
