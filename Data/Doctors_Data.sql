USE ClinicDB;
GO

SET NOCOUNT ON;

-- Số bác sĩ tối đa chèn (tự động chỉ chèn những employee_type='D' chưa có trong doctors)
DECLARE @MaxInsert INT = 100;  -- bạn thay nếu cần
DECLARE @MinSalary DECIMAL(12,2) = 100000.00; -- salary_per_appointment min
DECLARE @MaxSalary DECIMAL(12,2) = 500000.00; -- salary_per_appointment max

-- Kiểm tra có employee type D không
IF NOT EXISTS (SELECT 1 FROM employees WHERE employee_type = 'D')
BEGIN
    RAISERROR('No employees with employee_type = ''D'' found. Insert doctors'' employees first.', 16, 1);
    RETURN;
END

-- Lấy danh sách candidate employees (type D) chưa có trong doctors
IF OBJECT_ID('tempdb..#DocCandidates') IS NOT NULL DROP TABLE #DocCandidates;

SELECT TOP (@MaxInsert)
    ROW_NUMBER() OVER (ORDER BY e.emp_id) AS rn,
    e.emp_id
INTO #DocCandidates
FROM employees e
WHERE e.employee_type = 'D'
  AND NOT EXISTS (SELECT 1 FROM doctors d WHERE d.doctor_id = e.emp_id)
ORDER BY e.emp_id;

DECLARE @ToInsert INT = (SELECT COUNT(*) FROM #DocCandidates);
IF @ToInsert = 0
BEGIN
    PRINT 'No eligible doctor employees found to insert into doctors. Nothing to do.';
    RETURN;
END

PRINT CONCAT('Will insert ', @ToInsert, ' doctor rows (requested MaxInsert = ', @MaxInsert, ').');

-- Insert into doctors with randomized salary_per_appointment between min and max
-- Using a deterministic pseudo-random: ABS(CHECKSUM(NEWID())) % (Max-Min+1) + Min
INSERT INTO doctors (doctor_id, salary_per_appointment)
SELECT 
    dc.emp_id,
    CAST(@MinSalary + (ABS(CHECKSUM(NEWID())) % (CAST((@MaxSalary - @MinSalary) AS BIGINT) + 1)) 
         AS DECIMAL(12,2)) AS salary_per_appointment
FROM #DocCandidates dc;

PRINT CONCAT('Inserted ', @@ROWCOUNT, ' rows into doctors.');

-- Quick checks
SELECT COUNT(*) AS total_doctors FROM doctors;
SELECT TOP (20) d.doctor_id, e.fullname, e.email, d.salary_per_appointment
FROM doctors d
JOIN employees e ON d.doctor_id = e.emp_id
ORDER BY d.doctor_id DESC;


