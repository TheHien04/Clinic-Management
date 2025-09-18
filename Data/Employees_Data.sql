USE ClinicDB;
GO

SET NOCOUNT ON;

-- Số nhân viên muốn tạo (tùy chỉnh)
DECLARE @Count INT = 300;       -- thay nếu muốn (ví dụ 500)
DECLARE @DoctorRatio FLOAT = 0.20;  -- tỉ lệ bác sĩ (D)
DECLARE @NumDoctors INT = CEILING(@Count * @DoctorRatio);

-- Nếu cần đổi dải phone để tránh trùng, sửa BASE_PHONE
DECLARE @BASE_PHONE BIGINT = 9700000000; -- phones sẽ là BASE_PHONE + rn

IF @Count < 1 OR @Count > 200000
BEGIN
    RAISERROR('Set @Count between 1 and 200000', 16, 1);
    RETURN;
END

;WITH nums AS (
    SELECT TOP (@Count)
        ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS rn
    FROM sys.all_objects a
    CROSS JOIN sys.all_objects b
)
INSERT INTO employees (fullname, email, phone, address, employee_type)
SELECT
    N'Employee ' + RIGHT('00000' + CAST(n.rn AS VARCHAR(6)), 5) AS fullname,
    'employee' + CAST(n.rn AS VARCHAR(12)) + '@example.com' AS email,
    CAST(@BASE_PHONE + n.rn AS VARCHAR(20)) AS phone,
    N'Auto Address ' + CAST(n.rn AS NVARCHAR(10)) AS address,
    CASE WHEN n.rn <= @NumDoctors THEN 'D' ELSE 'S' END AS employee_type
FROM nums n;

PRINT CONCAT('Inserted ', @@ROWCOUNT, ' rows into employees.');

-- Quick checks (run after insertion)
SELECT COUNT(*) AS total_employees FROM employees;
SELECT employee_type, COUNT(*) cnt FROM employees GROUP BY employee_type;
SELECT TOP (10) emp_id, fullname, email, phone, employee_type FROM employees ORDER BY emp_id DESC;
