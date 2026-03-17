/**
 * Salary Controller - Manages salary calculations and records
 */

import { executeQuery } from '../config/database.js';

const firstDayOfMonth = (year, month) => `${year}-${String(month).padStart(2, '0')}-01`;

// Get all salary records with pagination and filtering
export const getAllSalaryRecords = async (req, res) => {
  try {
    const { month, year, employeeType, page = 1, limit = 20 } = req.query;
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const where = [];
    const params = { limit: safeLimit, offset };

    if (month) {
      where.push('MONTH(sr.MonthDate) = @month');
      params.month = Number(month);
    }

    if (year) {
      where.push('YEAR(sr.MonthDate) = @year');
      params.year = Number(year);
    }

    if (employeeType) {
      where.push('sr.EmployeeType = @employeeType');
      params.employeeType = String(employeeType).toUpperCase();
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM SalaryRecords sr
      ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, params);
    const total = Number(countResult.recordset[0]?.total || 0);

    const query = `
      SELECT
        sr.SalaryRecordID AS salary_record_id,
        sr.EmployeeID AS emp_id,
        sr.EmployeeType AS employee_type,
        CASE
          WHEN sr.EmployeeType = 'D' THEN d.FullName
          WHEN sr.EmployeeType = 'S' THEN st.FullName
          ELSE NULL
        END AS fullname,
        sr.MonthDate AS month,
        sr.TotalSalary AS total_salary,
        sr.CalculatedAt AS calculated_at,
        CASE
          WHEN sr.EmployeeType = 'D' THEN dsr.AppointmentCount
          WHEN sr.EmployeeType = 'S' THEN ssr.KPIAllowance
          ELSE NULL
        END AS detail_info
      FROM SalaryRecords sr
      LEFT JOIN Doctors d ON sr.EmployeeType = 'D' AND sr.EmployeeID = d.DoctorID
      LEFT JOIN Staff st ON sr.EmployeeType = 'S' AND sr.EmployeeID = st.StaffID
      LEFT JOIN DoctorSalaryRecords dsr ON sr.SalaryRecordID = dsr.SalaryRecordID
      LEFT JOIN StaffSalaryRecords ssr ON sr.SalaryRecordID = ssr.SalaryRecordID
      ${whereClause}
      ORDER BY sr.MonthDate DESC, sr.CalculatedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const result = await executeQuery(query, params);

    res.json({
      success: true,
      data: result.recordset,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error) {
    console.error('Get salary records error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching salary records',
      error: error.message,
    });
  }
};

// Get salary record by ID
export const getSalaryRecordById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        sr.SalaryRecordID AS salary_record_id,
        sr.EmployeeID AS emp_id,
        sr.EmployeeType AS employee_type,
        CASE
          WHEN sr.EmployeeType = 'D' THEN d.FullName
          WHEN sr.EmployeeType = 'S' THEN st.FullName
          ELSE NULL
        END AS fullname,
        sr.MonthDate AS month,
        sr.TotalSalary AS total_salary,
        sr.CalculatedAt AS calculated_at,
        dsr.AppointmentCount AS appointment_count,
        dsr.BaseSalary AS doctor_base_salary,
        dsr.Bonus AS doctor_bonus,
        ssr.BaseSalary AS staff_base_salary,
        ssr.KPIAllowance AS kpi_allowance
      FROM SalaryRecords sr
      LEFT JOIN Doctors d ON sr.EmployeeType = 'D' AND sr.EmployeeID = d.DoctorID
      LEFT JOIN Staff st ON sr.EmployeeType = 'S' AND sr.EmployeeID = st.StaffID
      LEFT JOIN DoctorSalaryRecords dsr ON sr.SalaryRecordID = dsr.SalaryRecordID
      LEFT JOIN StaffSalaryRecords ssr ON sr.SalaryRecordID = ssr.SalaryRecordID
      WHERE sr.SalaryRecordID = @id
    `;

    const result = await executeQuery(query, { id: Number(id) });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found',
      });
    }

    res.json({
      success: true,
      data: result.recordset[0],
    });
  } catch (error) {
    console.error('Get salary record error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching salary record',
      error: error.message,
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
        message: 'Month and year are required',
      });
    }

    const monthNum = Number(month);
    const yearNum = Number(year);
    const targetMonth = firstDayOfMonth(yearNum, monthNum);

    const checkQuery = `
      SELECT COUNT(*) AS count
      FROM SalaryRecords
      WHERE MonthDate = @targetMonth
    `;

    const checkResult = await executeQuery(checkQuery, { targetMonth });

    if (Number(checkResult.recordset[0]?.count || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Salaries already calculated for this month',
      });
    }

    const doctorStatsQuery = `
      SELECT
        d.DoctorID,
        COUNT(a.AppointmentID) AS appointment_count
      FROM Doctors d
      LEFT JOIN Appointments a ON a.DoctorID = d.DoctorID
        AND MONTH(a.AppointmentDate) = @month
        AND YEAR(a.AppointmentDate) = @year
        AND LOWER(a.Status) = 'completed'
      WHERE LOWER(d.Status) = 'active'
      GROUP BY d.DoctorID
    `;

    const doctorStats = await executeQuery(doctorStatsQuery, { month: monthNum, year: yearNum });

    let doctorCount = 0;
    for (const row of doctorStats.recordset) {
      const appointmentCount = Number(row.appointment_count || 0);
      const baseSalary = 10000000;
      const bonus = appointmentCount * 200000;
      const totalSalary = baseSalary + bonus;

      const salaryInsert = await executeQuery(
        `
          INSERT INTO SalaryRecords (EmployeeType, EmployeeID, MonthDate, TotalSalary, CalculatedAt)
          OUTPUT INSERTED.SalaryRecordID AS salary_record_id
          VALUES ('D', @employeeId, @monthDate, @totalSalary, GETDATE())
        `,
        {
          employeeId: row.DoctorID,
          monthDate: targetMonth,
          totalSalary,
        }
      );

      await executeQuery(
        `
          INSERT INTO DoctorSalaryRecords (SalaryRecordID, AppointmentCount, BaseSalary, Bonus)
          VALUES (@salaryRecordId, @appointmentCount, @baseSalary, @bonus)
        `,
        {
          salaryRecordId: salaryInsert.recordset[0].salary_record_id,
          appointmentCount,
          baseSalary,
          bonus,
        }
      );

      doctorCount += 1;
    }

    const staffStatsQuery = `
      SELECT StaffID
      FROM Staff
      WHERE LOWER(Status) = 'active'
    `;

    const staffStats = await executeQuery(staffStatsQuery);

    let staffCount = 0;
    for (const row of staffStats.recordset) {
      const baseSalary = 8000000;
      const kpiAllowance = 2000000;
      const totalSalary = baseSalary + kpiAllowance;

      const salaryInsert = await executeQuery(
        `
          INSERT INTO SalaryRecords (EmployeeType, EmployeeID, MonthDate, TotalSalary, CalculatedAt)
          OUTPUT INSERTED.SalaryRecordID AS salary_record_id
          VALUES ('S', @employeeId, @monthDate, @totalSalary, GETDATE())
        `,
        {
          employeeId: row.StaffID,
          monthDate: targetMonth,
          totalSalary,
        }
      );

      await executeQuery(
        `
          INSERT INTO StaffSalaryRecords (SalaryRecordID, BaseSalary, KPIAllowance)
          VALUES (@salaryRecordId, @baseSalary, @kpiAllowance)
        `,
        {
          salaryRecordId: salaryInsert.recordset[0].salary_record_id,
          baseSalary,
          kpiAllowance,
        }
      );

      staffCount += 1;
    }

    const totalRecords = doctorCount + staffCount;

    res.status(201).json({
      success: true,
      message: `Successfully calculated salaries for ${totalRecords} employees`,
      data: {
        month: targetMonth,
        doctorCount,
        staffCount,
        totalRecords,
      },
    });
  } catch (error) {
    console.error('Calculate salaries error:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating salaries',
      error: error.message,
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
        message: 'Month and year are required',
      });
    }

    const query = `
      SELECT
        sr.EmployeeType AS employee_type,
        COUNT(*) AS employee_count,
        SUM(sr.TotalSalary) AS total_salary,
        AVG(sr.TotalSalary) AS average_salary,
        MIN(sr.TotalSalary) AS min_salary,
        MAX(sr.TotalSalary) AS max_salary
      FROM SalaryRecords sr
      WHERE MONTH(sr.MonthDate) = @month
        AND YEAR(sr.MonthDate) = @year
      GROUP BY sr.EmployeeType
    `;

    const result = await executeQuery(query, {
      month: Number(month),
      year: Number(year),
    });

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error('Get salary summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching salary summary',
      error: error.message,
    });
  }
};

// Delete salary record
export const deleteSalaryRecord = async (req, res) => {
  try {
    const { id } = req.params;

    const recordResult = await executeQuery(
      'SELECT SalaryRecordID FROM SalaryRecords WHERE SalaryRecordID = @id',
      { id: Number(id) }
    );

    if (recordResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found',
      });
    }

    await executeQuery('DELETE FROM SalaryRecords WHERE SalaryRecordID = @id', { id: Number(id) });

    res.json({
      success: true,
      message: 'Salary record deleted successfully',
    });
  } catch (error) {
    console.error('Delete salary record error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting salary record',
      error: error.message,
    });
  }
};

export default {
  getAllSalaryRecords,
  getSalaryRecordById,
  calculateSalaries,
  getSalarySummary,
  deleteSalaryRecord,
};
