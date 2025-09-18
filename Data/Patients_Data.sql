USE ClinicDB
GO

SET NOCOUNT ON;

-- Số bản ghi muốn chèn (thay nếu cần)
DECLARE @Count INT = 200000;

-- Kiểm tra an toàn: tránh chèn nếu số bản ghi quá lớn (tùy bạn)
IF @Count < 1 OR @Count > 200000
BEGIN
    RAISERROR('Please set @Count between 1 and 200000', 16, 1);
    RETURN;
END

;WITH nums AS (
    -- Tạo dãy 1..@Count (dùng cross join để đảm bảo đủ dòng)
    SELECT TOP (@Count)
        ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS rn
    FROM sys.all_objects a
    CROSS JOIN sys.all_objects b
)
INSERT INTO patients (fullname, date_of_birth, gender, address, phone, email, bhyt_info)
SELECT
    -- Full name: Patient 0001 ...
    N'Patient ' + RIGHT('00000' + CAST(n.rn AS VARCHAR(6)), 5) AS fullname,

    -- date_of_birth: rải đều, ví dụ từ 1940-01-01 -> 2010-12-31
    DATEADD(DAY, (n.rn * 37) % 25550 * -1, CAST('2010-12-31' AS DATE)) AS date_of_birth,

    -- gender luân phiên (Male / Female / Other)
    CASE (n.rn % 3)
        WHEN 1 THEN N'Male'
        WHEN 2 THEN N'Female'
        ELSE N'Other'
    END AS gender,

    -- address
    N'Auto Address ' + CAST(n.rn AS NVARCHAR(12)) AS address,

    -- phone: đảm bảo chỉ số và độ dài >= 9; bắt đầu từ 9000000000 (10 digits)
    CAST(9000000000 + n.rn AS VARCHAR(20)) AS phone,

    -- email: unique và hợp lệ
    'patient' + CAST(n.rn AS VARCHAR(10)) + '@example.com' AS email,

    -- bhyt_info unique
    'BHYT' + RIGHT('000000' + CAST(n.rn AS VARCHAR(6)), 6) AS bhyt_info

FROM nums n;

PRINT CONCAT('Inserted ', @@ROWCOUNT, ' rows into patients.');

-- Tổng số bản ghi mới
SELECT COUNT(*) AS total_patients FROM patients;

SELECT TOP (10) patient_id, fullname, phone, email, bhyt_info, date_of_birth, gender
FROM patients
ORDER BY patient_id DESC;

