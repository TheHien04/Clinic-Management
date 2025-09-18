USE ClinicDB
GO


SET NOCOUNT ON;

-- Số staff muốn tạo (tùy chỉnh)
DECLARE @Count INT = 240; -- thay nếu cần

IF @Count < 1 OR @Count > 10000
BEGIN
    RAISERROR('Please set @Count between 1 and 10000', 16, 1);
    RETURN;
END

-- Kiểm tra có clinic không
IF NOT EXISTS (SELECT 1 FROM clinics)
BEGIN
    RAISERROR('No clinics found. Insert clinics before inserting staff.', 16, 1);
    RETURN;
END

-- Lấy danh sách clinic vào temp table để phân phối
IF OBJECT_ID('tempdb..#Clinics') IS NOT NULL DROP TABLE #Clinics;
SELECT ROW_NUMBER() OVER (ORDER BY clinic_id) AS rn, clinic_id
INTO #Clinics
FROM clinics;

DECLARE @ClinicCount INT = (SELECT COUNT(*) FROM #Clinics);

-- Chuẩn bị danh sách employees loại 'S' chưa có trong staff (upto @Count)
IF OBJECT_ID('tempdb..#EmpCandidates') IS NOT NULL DROP TABLE #EmpCandidates;
SELECT TOP (@Count)
    ROW_NUMBER() OVER (ORDER BY emp_id) AS rn,
    emp_id
INTO #EmpCandidates
FROM employees e
WHERE e.employee_type = 'S'
  AND NOT EXISTS (SELECT 1 FROM staff s WHERE s.staff_id = e.emp_id)
ORDER BY e.emp_id;

-- Nếu không đủ nhân viên S để chèn, báo cho bạn biết và vẫn tiếp với những gì có
DECLARE @Available INT = (SELECT COUNT(*) FROM #EmpCandidates);
IF @Available = 0
BEGIN
    PRINT 'No eligible employees of type S found to insert into staff. Nothing to do.';
    RETURN;
END

PRINT CONCAT('Will insert ', @Available, ' staff rows (requested ', @Count, ').');

-- Insert with position distribution and base_salary
-- Distribution rule (approx):
-- rn % 10 = 1           => Accountant (~10%)
-- rn % 10 = 2           => Manager (~10%)
-- rn % 10 IN (3,4,5,6)  => Receptionist (~40%)
-- else                 => Other (~40%)

INSERT INTO staff (staff_id, position, base_salary, clinic_id)
SELECT 
    ec.emp_id AS staff_id,
    CASE (ec.rn % 10)
        WHEN 1 THEN 'Accountant'
        WHEN 2 THEN 'Manager'
        WHEN 3 THEN 'Receptionist'
        WHEN 4 THEN 'Receptionist'
        WHEN 5 THEN 'Receptionist'
        WHEN 6 THEN 'Receptionist'
        ELSE 'Other'
    END AS position,
    -- base_salary by position (you can adjust these)
    CASE 
        WHEN (ec.rn % 10) = 1 THEN 7000000.00 -- Accountant
        WHEN (ec.rn % 10) = 2 THEN 8000000.00 -- Manager
        WHEN (ec.rn % 10) IN (3,4,5,6) THEN 4000000.00 -- Receptionist
        ELSE 3500000.00 -- Other
    END
    + (ec.rn % 100) * 1000.00 AS base_salary, -- small variation
    -- assign clinic by round-robin from #Clinics
    c.clinic_id
FROM #EmpCandidates ec
JOIN #Clinics c ON c.rn = ((ec.rn - 1) % @ClinicCount) + 1;

PRINT CONCAT('Inserted ', @@ROWCOUNT, ' rows into staff.');

-- Quick verification queries
SELECT COUNT(*) AS total_staff FROM staff;
SELECT position, COUNT(*) cnt FROM staff GROUP BY position;
SELECT TOP (20) s.staff_id, e.fullname, s.position, s.base_salary, s.clinic_id, c.name AS clinic_name
FROM staff s
JOIN employees e ON s.staff_id = e.emp_id
JOIN clinics c ON s.clinic_id = c.clinic_id
ORDER BY s.staff_id DESC;

-- Show any employees of type S that remain not in staff (optional)
SELECT TOP (20) e.emp_id, e.fullname FROM employees e
WHERE e.employee_type = 'S'
  AND NOT EXISTS (SELECT 1 FROM staff s WHERE s.staff_id = e.emp_id)
ORDER BY e.emp_id;


