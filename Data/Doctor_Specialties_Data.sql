USE ClinicDB;
GO
SET NOCOUNT ON;

-- Cấu hình: tối thiểu và tối đa chuyên khoa gán cho mỗi bác sĩ
DECLARE @MinPerDoctor INT = 1;
DECLARE @MaxPerDoctor INT = 3;

IF @MinPerDoctor < 1 OR @MaxPerDoctor < @MinPerDoctor
BEGIN
    RAISERROR('Invalid configuration for @MinPerDoctor/@MaxPerDoctor', 16, 1);
    RETURN;
END

-- Kiểm tra dữ liệu bắt buộc
IF NOT EXISTS (SELECT 1 FROM doctors)
BEGIN
    RAISERROR('No doctors found. Insert doctors before inserting doctor_specialties.', 16, 1);
    RETURN;
END

IF NOT EXISTS (SELECT 1 FROM specialties)
BEGIN
    RAISERROR('No specialties found. Insert specialties before inserting doctor_specialties.', 16, 1);
    RETURN;
END

-- Thực hiện chèn: với mỗi doctor, chọn ngẫu nhiên TOP (randCount) specialties (không chọn những cặp đã tồn tại)
;WITH DocList AS (
    SELECT doctor_id FROM doctors
)
INSERT INTO doctor_specialties (doctor_id, specialty_id)
SELECT d.doctor_id, s.specialty_id
FROM DocList d
CROSS APPLY (
    -- Với mỗi bác sĩ, chọn ngẫu nhiên một số chuyên khoa giữa Min..Max
    SELECT TOP (
        (ABS(CHECKSUM(NEWID())) % (@MaxPerDoctor - @MinPerDoctor + 1)) + @MinPerDoctor
    ) sp.specialty_id
    FROM specialties sp
    WHERE NOT EXISTS (
        SELECT 1 FROM doctor_specialties ds
        WHERE ds.doctor_id = d.doctor_id
          AND ds.specialty_id = sp.specialty_id
    )
    ORDER BY NEWID()
) s;

PRINT CONCAT('Inserted ', @@ROWCOUNT, ' rows into doctor_specialties.');

-- Kiểm tra nhanh
SELECT COUNT(*) AS total_doctor_specialties FROM doctor_specialties;
SELECT TOP (50) ds.doctor_id, e.fullname AS doctor_name, ds.specialty_id, sp.name AS specialty_name
FROM doctor_specialties ds
JOIN employees e ON ds.doctor_id = e.emp_id
JOIN specialties sp ON ds.specialty_id = sp.specialty_id
ORDER BY ds.doctor_id, ds.specialty_id;
GO
