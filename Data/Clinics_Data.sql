USE ClinicDB;
GO

SET NOCOUNT ON;

-- Số clinic muốn tạo (mặc định)
DECLARE @Count INT = 10;

IF @Count < 1 OR @Count > 10000
BEGIN
    RAISERROR('Please set @Count between 1 and 10000', 16, 1);
    RETURN;
END

-- Khai báo table variable trước (PHẢI khai báo trước CTE)
DECLARE @InsertedOutput TABLE (
    action_taken NVARCHAR(20),
    clinic_id INT,
    name NVARCHAR(255),
    address NVARCHAR(255)
);

-- Tạo danh sách tên/địa chỉ giả (CTE) - CTE phải ngay lập tức theo sau bởi MERGE
;WITH nums AS (
    SELECT TOP (@Count)
        ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS rn
    FROM sys.all_objects a
    CROSS JOIN sys.all_objects b
)
, src AS (
    SELECT
        N'Clinic Bulk ' + RIGHT('00000' + CAST(n.rn AS VARCHAR(6)),5) AS name,
        N'Bulk Address ' + CAST(n.rn AS NVARCHAR(10)) AS address,
        N'8-17' AS opening_hours,
        N'active' AS status
    FROM nums n
)
MERGE INTO clinics AS T
USING src AS S
    ON T.name = S.name
WHEN NOT MATCHED BY TARGET THEN
    INSERT (name, address, opening_hours, status)
    VALUES (S.name, S.address, S.opening_hours, S.status)
OUTPUT
    $action AS action_taken,
    inserted.clinic_id, inserted.name, inserted.address
INTO @InsertedOutput;

-- Quick check: how many clinics now
SELECT COUNT(*) AS total_clinics FROM clinics;

-- Show newly inserted (or matched) sample
SELECT TOP (10) clinic_id, name, address, opening_hours, status
FROM clinics
ORDER BY clinic_id DESC;


