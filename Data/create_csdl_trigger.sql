-- Tạo DB
IF DB_ID('ClinicDB') IS NULL
BEGIN
    CREATE DATABASE ClinicDB;
END
GO
USE ClinicDB;
GO


-- Bảng 1: patients (Bệnh nhân)
CREATE TABLE patients (
    patient_id INT IDENTITY(1,1) PRIMARY KEY,
    fullname NVARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender NVARCHAR(10) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    address NVARCHAR(MAX),
    phone NVARCHAR(20) UNIQUE NOT NULL,
    email NVARCHAR(255) UNIQUE,
    bhyt_info NVARCHAR(20) UNIQUE,
    created_at DATETIME2 DEFAULT GETDATE()
);


-- Bảng 2: accounts (Tài khoản bệnh nhân)
CREATE TABLE accounts (
    account_id INT IDENTITY(1,1) PRIMARY KEY,
    patient_id INT UNIQUE NOT NULL,
    username NVARCHAR(255) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    last_login DATETIME2,
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_account_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(patient_id)
        ON DELETE CASCADE
);

-- Bảng 3: specialties (Chuyên khoa)
CREATE TABLE specialties (
    specialty_id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) UNIQUE NOT NULL,
    description NVARCHAR(MAX)
);

-- Bảng 4: employees (Nhân viên - Supertype)
CREATE TABLE employees (
    emp_id INT IDENTITY(1,1) PRIMARY KEY,
    fullname NVARCHAR(255) NOT NULL,
    email NVARCHAR(255) UNIQUE NOT NULL,
    phone NVARCHAR(20) NOT NULL,
    address NVARCHAR(MAX),
    employee_type CHAR(1) NOT NULL CHECK (employee_type IN ('D', 'S')),
    created_at DATETIME2 DEFAULT GETDATE()
);

-- Bảng 5: doctors (Bác sĩ - Subtype)
CREATE TABLE doctors (
    doctor_id INT PRIMARY KEY,
    salary_per_appointment DECIMAL(12, 2) NOT NULL CHECK (salary_per_appointment >= 0),
    CONSTRAINT fk_doctor_employee
        FOREIGN KEY (doctor_id)
        REFERENCES employees(emp_id)
        ON DELETE CASCADE
);

-- Bảng 6: doctor_specialties (Quan hệ Bác sĩ - Chuyên khoa)
CREATE TABLE doctor_specialties (
    doctor_id INT NOT NULL,
    specialty_id INT NOT NULL,
    PRIMARY KEY (doctor_id, specialty_id),
    CONSTRAINT fk_doctorspec_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_doctorspec_specialty
        FOREIGN KEY (specialty_id)
        REFERENCES specialties(specialty_id)
        ON DELETE CASCADE
);

-- Bảng 7: clinics (Phòng khám)
CREATE TABLE clinics (
    clinic_id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(255) UNIQUE NOT NULL,
    address NVARCHAR(255) UNIQUE NOT NULL,
    opening_hours NVARCHAR(MAX),
    status NVARCHAR(10) DEFAULT 'active' CHECK (status IN ('active', 'inactive')) NOT NULL
);

-- Bảng 8: staff (Nhân viên hành chính - Subtype)
CREATE TABLE staff (
    staff_id INT PRIMARY KEY,
    position NVARCHAR(100) NOT NULL CHECK (position IN ('Receptionist', 'Accountant', 'Manager', 'Other')),
    base_salary DECIMAL(12, 2) NOT NULL CHECK (base_salary >= 0),
    clinic_id INT NOT NULL,
    CONSTRAINT fk_staff_employee
        FOREIGN KEY (staff_id)
        REFERENCES employees(emp_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_staff_clinic
        FOREIGN KEY (clinic_id)
        REFERENCES clinics(clinic_id)
);

DROP TABLE staff

-- Bảng 9: schedules (Lịch làm việc)
CREATE TABLE schedules (
    schedule_id INT IDENTITY(1,1) PRIMARY KEY,
    doctor_id INT NOT NULL,
    clinic_id INT NOT NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_patients INT NOT NULL CHECK (max_patients > 0),
    manager_id INT NOT NULL,
    CONSTRAINT fk_schedule_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(doctor_id),
    CONSTRAINT fk_schedule_clinic
        FOREIGN KEY (clinic_id)
        REFERENCES clinics(clinic_id),
    CONSTRAINT fk_schedule_manager
        FOREIGN KEY (manager_id)
        REFERENCES employees(emp_id),
    CONSTRAINT chk_end_time_after_start 
        CHECK (end_time > start_time)
);


-- Bảng 10: appointments (Lịch hẹn)
CREATE TABLE appointments (
    app_id INT IDENTITY(1,1) PRIMARY KEY,
    patient_id INT NOT NULL,
    schedule_id INT NOT NULL,
    scheduled_time DATETIME2 NOT NULL,
    status NVARCHAR(20) DEFAULT 'booked' CHECK (status IN ('booked', 'confirmed', 'cancelled', 'completed')) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_appointment_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(patient_id),
    CONSTRAINT fk_appointment_schedule
        FOREIGN KEY (schedule_id)
        REFERENCES schedules(schedule_id)
);


-- Bảng 11: medical_records (Hồ sơ bệnh án)
CREATE TABLE medical_records (
    record_id INT IDENTITY(1,1) PRIMARY KEY,
    app_id INT UNIQUE NOT NULL,
    diagnosis_code NVARCHAR(10) NOT NULL,
    prescription NVARCHAR(MAX),
    notes NVARCHAR(MAX),
    follow_up_date DATE,
    created_at DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT fk_medicalrecord_appointment
        FOREIGN KEY (app_id)
        REFERENCES appointments(app_id)
        ON DELETE CASCADE
);


-- Bảng 12: salary_records (Bảng lương - Supertype)
CREATE TABLE salary_records (
    emp_id INT NOT NULL,
    month CHAR(7) NOT NULL CHECK (month LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
    calculated_at DATETIME2 DEFAULT GETDATE(),
    total_salary DECIMAL(12, 2) NOT NULL CHECK (total_salary >= 0),
    accountant_id INT NOT NULL,
    PRIMARY KEY (emp_id, month),
    CONSTRAINT fk_salaryrecord_employee
        FOREIGN KEY (emp_id)
        REFERENCES employees(emp_id),
    CONSTRAINT fk_salaryrecord_accountant
        FOREIGN KEY (accountant_id)
        REFERENCES employees(emp_id)
);

-- Bảng 13: doctor_salary_records (Lương bác sĩ - Subtype)
CREATE TABLE doctor_salary_records (
    emp_id INT NOT NULL,
    month CHAR(7) NOT NULL,
    appointment_count INT NOT NULL CHECK (appointment_count >= 0),
    PRIMARY KEY (emp_id, month),
    CONSTRAINT fk_doctorsalary_salary
        FOREIGN KEY (emp_id, month)
        REFERENCES salary_records(emp_id, month)
        ON DELETE CASCADE
);


-- Bảng 14: staff_salary_records (Lương nhân viên - Subtype)
CREATE TABLE staff_salary_records (
    emp_id INT NOT NULL,
    month CHAR(7) NOT NULL,
    allowance_kpi DECIMAL(12, 2) NOT NULL CHECK (allowance_kpi >= 0),
    PRIMARY KEY (emp_id, month),
    CONSTRAINT fk_staffsalary_salary
        FOREIGN KEY (emp_id, month)
        REFERENCES salary_records(emp_id, month)
        ON DELETE CASCADE
);

-------------Tạo stored procedure và triggers cần thiết--------------

-- Function kiểm tra định dạng email
CREATE FUNCTION dbo.IsValidEmail (@Email NVARCHAR(255))
RETURNS BIT
AS
BEGIN
    RETURN CASE 
        WHEN @Email LIKE '%_@_%_.__%' AND @Email NOT LIKE '%@%@%' THEN 1
        ELSE 0
    END
END;
GO


-- Function kiểm tra định dạng số điện thoại (cơ bản)
CREATE FUNCTION dbo.IsValidPhone (@Phone NVARCHAR(20))
RETURNS BIT
AS
BEGIN
    RETURN CASE 
        WHEN @Phone NOT LIKE '%[^0-9+]%' AND LEN(@Phone) >= 9 THEN 1
        ELSE 0
    END
END;
GO


-----TRIGGERS cho bảng employees------
-- Trigger kiểm tra định dạng email và phone khi thêm/sửa nhân viên
CREATE TRIGGER trg_employees_validate_email_phone
ON employees
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1 FROM inserted i 
        WHERE dbo.IsValidEmail(i.email) = 0
    )
    BEGIN
        RAISERROR('Invalid email format', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
    
    IF EXISTS (
        SELECT 1 FROM inserted i 
        WHERE dbo.IsValidPhone(i.phone) = 0
    )
    BEGIN
        RAISERROR('Invalid phone format', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO


------TRIGGERS cho bảng patients------
-- Trigger kiểm tra định dạng email và phone khi thêm/sửa bệnh nhân
CREATE TRIGGER trg_patients_validate_email_phone
ON patients
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1 FROM inserted i 
        WHERE i.email IS NOT NULL AND dbo.IsValidEmail(i.email) = 0
    )
    BEGIN
        RAISERROR('Invalid email format', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
    
    IF EXISTS (
        SELECT 1 FROM inserted i 
        WHERE dbo.IsValidPhone(i.phone) = 0
    )
    BEGIN
        RAISERROR('Invalid phone format', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO


------TRIGGERS cho bảng schedules
-- Trigger kiểm tra manager_id phải là nhân viên có vị trí là "Manager" không
CREATE TRIGGER trg_schedules_check_manager
ON schedules
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1 FROM inserted i
        WHERE NOT EXISTS (
            SELECT 1 FROM employees e
            JOIN staff s ON e.emp_id = s.staff_id
            WHERE e.emp_id = i.manager_id 
            AND s.position = 'Manager'
        )
    )
    BEGIN
        RAISERROR('Manager ID must belong to an employee with Manager position', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO


------TRIGGERS cho bảng appoinments-------
-- Trigger kiểm tra thời gian hẹn có trong khung giờ làm việc
CREATE TRIGGER trg_appointments_validate_time
ON appointments
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1 FROM inserted i
        JOIN schedules s ON i.schedule_id = s.schedule_id
        WHERE 
            -- Điều chỉnh theo DATEFIRST setting
            (DATEPART(WEEKDAY, i.scheduled_time) + @@DATEFIRST - 2) % 7 + 1 <> s.day_of_week -- monday = 1, sunday = 7
            OR CAST(i.scheduled_time AS TIME) < s.start_time
            OR CAST(i.scheduled_time AS TIME) > s.end_time
    )
    BEGIN
        RAISERROR('Appointment time must be within the schedule working hours', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO
-- Trigger kiểm tra số lượng patients không vượt quá max_patients
--DROP TRIGGER trg_appointments_check_max_patients
--GO

CREATE OR ALTER TRIGGER trg_appointments_check_max_patients
ON appointments
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Kiểm tra từng schedule và ngày trong inserted records
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN schedules s ON i.schedule_id = s.schedule_id
        CROSS APPLY (
            SELECT COUNT(*) as total_count
            FROM (
                -- Appointments đã có trong database
                SELECT a.app_id
                FROM appointments a
                WHERE a.schedule_id = i.schedule_id
                AND CAST(a.scheduled_time AS DATE) = CAST(i.scheduled_time AS DATE)
                AND a.status NOT IN ('cancelled')
                AND a.app_id NOT IN (SELECT app_id FROM inserted)
                
                UNION ALL
                
                -- Appointments mới đang insert (trừ cancelled)
                SELECT i2.app_id
                FROM inserted i2
                WHERE i2.schedule_id = i.schedule_id
                AND CAST(i2.scheduled_time AS DATE) = CAST(i.scheduled_time AS DATE)
                AND i2.status NOT IN ('cancelled')
            ) as combined
        ) as count_query
        WHERE count_query.total_count > s.max_patients
    )
    BEGIN
        DECLARE @ErrorMsg NVARCHAR(500) = 'Maximum patients exceeded for one or more schedules';
        RAISERROR(@ErrorMsg, 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO

-- Trigger kiểm tra bệnh nhân chỉ có 1 appointment chưa completed
CREATE TRIGGER trg_appointments_check_patient_conflict
ON appointments
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1 FROM inserted i
        WHERE i.status NOT IN ('completed', 'cancelled')
        AND EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.patient_id = i.patient_id
            AND a.schedule_id = i.schedule_id
            AND a.status NOT IN ('completed', 'cancelled')
            AND a.app_id <> i.app_id
        )
    )
    BEGIN
        RAISERROR('Patient already has an active appointment for this schedule', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO



---------TRIGGERS cho bảng salary_records----------
-- Trigger kiểm tra accountant_id phải là Accountant
CREATE TRIGGER trg_salary_records_check_accountant
ON salary_records
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1 FROM inserted i
        WHERE NOT EXISTS (
            SELECT 1 FROM employees e
            JOIN staff s ON e.emp_id = s.staff_id
            WHERE e.emp_id = i.accountant_id 
            AND s.position = 'Accountant'
        )
    )
    BEGIN
        RAISERROR('Accountant ID must belong to an employee with Accountant position', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO


-------TRIGGERS cho bảng medical_records-----------
-- Trigger tự động tạo medical record khi appointment completed
CREATE TRIGGER trg_appointments_create_medical_record
ON appointments
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO medical_records (app_id, diagnosis_code, created_at)
    SELECT i.app_id, 'UNKNOWN', GETDATE()
    FROM inserted i
    JOIN deleted d ON i.app_id = d.app_id
    WHERE i.status = 'completed' 
    AND d.status <> 'completed'
    AND NOT EXISTS (
        SELECT 1 FROM medical_records mr 
        WHERE mr.app_id = i.app_id
    );
END;
GO


----------------STORE PROCEDURE tính lương-----------------

-- Stored Procedure tính lương cho tất cả nhân viên trong tháng
CREATE PROCEDURE dbo.CalculateSalariesForMonth
    @Month CHAR(7), -- Format: 'YYYY-MM'
    @AccountantId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Kiểm tra accountant_id hợp lệ
        IF NOT EXISTS (
            SELECT 1 FROM staff 
            WHERE staff_id = @AccountantId 
            AND position = 'Accountant'
        )
        BEGIN
            RAISERROR('Invalid accountant ID', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN;
        END
        
        -- Tính lương cho từng employee
        DECLARE @EmpId INT, @EmpType CHAR(1);
        DECLARE emp_cursor CURSOR FOR 
        SELECT emp_id, employee_type FROM employees;
        
        OPEN emp_cursor;
        FETCH NEXT FROM emp_cursor INTO @EmpId, @EmpType;
        
        WHILE @@FETCH_STATUS = 0
        BEGIN
            DECLARE @TotalSalary DECIMAL(12, 2);
            
            IF @EmpType = 'D'
            BEGIN
                -- Tính lương cho Bác sĩ
                DECLARE @AppointmentCount INT;
                DECLARE @SalaryPerAppointment DECIMAL(12, 2);
                
                SELECT @AppointmentCount = COUNT(*)
                FROM appointments a
                JOIN schedules s ON a.schedule_id = s.schedule_id
                WHERE s.doctor_id = @EmpId
                AND a.status = 'completed'
                AND CONVERT(CHAR(7), a.scheduled_time, 126) = @Month;
                
                SELECT @SalaryPerAppointment = salary_per_appointment
                FROM doctors
                WHERE doctor_id = @EmpId;
                
                SET @TotalSalary = @AppointmentCount * @SalaryPerAppointment;
                
                -- Insert/Update salary record
                MERGE INTO salary_records AS target
                USING (SELECT @EmpId AS emp_id, @Month AS month) AS source
                ON target.emp_id = source.emp_id AND target.month = source.month
                WHEN MATCHED THEN
                    UPDATE SET total_salary = @TotalSalary, 
                             calculated_at = GETDATE(),
                             accountant_id = @AccountantId
                WHEN NOT MATCHED THEN
                    INSERT (emp_id, month, total_salary, accountant_id)
                    VALUES (@EmpId, @Month, @TotalSalary, @AccountantId);
                
                -- Insert/Update doctor salary detail
                MERGE INTO doctor_salary_records AS target
                USING (SELECT @EmpId AS emp_id, @Month AS month) AS source
                ON target.emp_id = source.emp_id AND target.month = source.month
                WHEN MATCHED THEN
                    UPDATE SET appointment_count = @AppointmentCount
                WHEN NOT MATCHED THEN
                    INSERT (emp_id, month, appointment_count)
                    VALUES (@EmpId, @Month, @AppointmentCount);
            END
            ELSE IF @EmpType = 'S'
            BEGIN
                -- Tính lương cho Nhân viên
                DECLARE @BaseSalary DECIMAL(12, 2);
                DECLARE @AllowanceKPI DECIMAL(12, 2) = 500000; -- Example value
                
                SELECT @BaseSalary = base_salary
                FROM staff
                WHERE staff_id = @EmpId;
                
                SET @TotalSalary = @BaseSalary + @AllowanceKPI;
                
                -- Insert/Update salary record
                MERGE INTO salary_records AS target
                USING (SELECT @EmpId AS emp_id, @Month AS month) AS source
                ON target.emp_id = source.emp_id AND target.month = source.month
                WHEN MATCHED THEN
                    UPDATE SET total_salary = @TotalSalary, 
                             calculated_at = GETDATE(),
                             accountant_id = @AccountantId
                WHEN NOT MATCHED THEN
                    INSERT (emp_id, month, total_salary, accountant_id)
                    VALUES (@EmpId, @Month, @TotalSalary, @AccountantId);
                
                -- Insert/Update staff salary detail
                MERGE INTO staff_salary_records AS target
                USING (SELECT @EmpId AS emp_id, @Month AS month) AS source
                ON target.emp_id = source.emp_id AND target.month = source.month
                WHEN MATCHED THEN
                    UPDATE SET allowance_kpi = @AllowanceKPI
                WHEN NOT MATCHED THEN
                    INSERT (emp_id, month, allowance_kpi)
                    VALUES (@EmpId, @Month, @AllowanceKPI);
            END
            
            FETCH NEXT FROM emp_cursor INTO @EmpId, @EmpType;
        END
        
        CLOSE emp_cursor;
        DEALLOCATE emp_cursor;
        
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END;
GO


---------------- Additional Constraints (sử dụng Trigger)------------------

-- Trigger đảm bảo doctor type consistency
CREATE TRIGGER trg_doctors_check_type
ON doctors
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1 FROM inserted i
        JOIN employees e ON i.doctor_id = e.emp_id
        WHERE e.employee_type <> 'D'
    )
    BEGIN
        RAISERROR('Doctor must have employee type D', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO

-- Trigger đảm bảo staff type consistency
CREATE TRIGGER trg_staff_check_type
ON staff
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1 FROM inserted i
        JOIN employees e ON i.staff_id = e.emp_id
        WHERE e.employee_type <> 'S'
    )
    BEGIN
        RAISERROR('Staff must have employee type S', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO


