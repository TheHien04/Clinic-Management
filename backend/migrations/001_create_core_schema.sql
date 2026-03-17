-- Versioned migration 001
-- Source aligned from Data/create_clinicmanagement_core_schema.sql

IF DB_ID('ClinicManagement') IS NULL
BEGIN
    CREATE DATABASE ClinicManagement;
END;
GO

USE ClinicManagement;
GO

PRINT '=== START core schema bootstrap for ClinicManagement ===';
GO

IF OBJECT_ID('dbo.Specialties', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Specialties (
        SpecialtyID INT IDENTITY(1,1) PRIMARY KEY,
        SpecialtyName NVARCHAR(120) NOT NULL UNIQUE,
        CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END;
GO

IF OBJECT_ID('dbo.Patients', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Patients (
        PatientID INT IDENTITY(1,1) PRIMARY KEY,
        FullName NVARCHAR(200) NOT NULL,
        DateOfBirth DATE NULL,
        Gender NVARCHAR(20) NULL,
        PhoneNumber NVARCHAR(20) NULL,
        Email NVARCHAR(255) NULL,
        Address NVARCHAR(255) NULL,
        MedicalHistory NVARCHAR(MAX) NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedDate DATETIME2 NULL
    );

    CREATE UNIQUE INDEX UX_Patients_PhoneNumber
    ON dbo.Patients(PhoneNumber)
    WHERE PhoneNumber IS NOT NULL;

    CREATE UNIQUE INDEX UX_Patients_Email
    ON dbo.Patients(Email)
    WHERE Email IS NOT NULL;
END;
GO

IF OBJECT_ID('dbo.Doctors', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Doctors (
        DoctorID INT IDENTITY(1,1) PRIMARY KEY,
        FullName NVARCHAR(200) NOT NULL,
        SpecialtyID INT NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT 'active',
        PhoneNumber NVARCHAR(20) NULL,
        Email NVARCHAR(255) NULL,
        Qualifications NVARCHAR(400) NULL,
        Experience INT NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedDate DATETIME2 NULL,
        CONSTRAINT FK_Doctors_Specialties
            FOREIGN KEY (SpecialtyID) REFERENCES dbo.Specialties(SpecialtyID)
    );

    CREATE UNIQUE INDEX UX_Doctors_Email
    ON dbo.Doctors(Email)
    WHERE Email IS NOT NULL;
END;
GO

IF OBJECT_ID('dbo.Clinics', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Clinics (
        ClinicID INT IDENTITY(1,1) PRIMARY KEY,
        ClinicName NVARCHAR(200) NOT NULL UNIQUE,
        Address NVARCHAR(255) NULL,
        PhoneNumber NVARCHAR(20) NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END;
GO

IF OBJECT_ID('dbo.Staff', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Staff (
        StaffID INT IDENTITY(1,1) PRIMARY KEY,
        FullName NVARCHAR(200) NOT NULL,
        DateOfBirth DATE NULL,
        Gender NVARCHAR(20) NULL,
        PhoneNumber NVARCHAR(20) NULL,
        Email NVARCHAR(255) NULL,
        Address NVARCHAR(255) NULL,
        Position NVARCHAR(80) NOT NULL,
        ClinicID INT NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT 'active',
        CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedDate DATETIME2 NULL,
        CONSTRAINT FK_Staff_Clinics
            FOREIGN KEY (ClinicID) REFERENCES dbo.Clinics(ClinicID)
    );

    CREATE UNIQUE INDEX UX_Staff_Email
    ON dbo.Staff(Email)
    WHERE Email IS NOT NULL;
END;
GO

IF OBJECT_ID('dbo.SalaryRecords', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SalaryRecords (
        SalaryRecordID INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeType CHAR(1) NOT NULL,
        EmployeeID INT NOT NULL,
        MonthDate DATE NOT NULL,
        TotalSalary DECIMAL(15,2) NOT NULL,
        CalculatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT CK_SalaryRecords_EmployeeType CHECK (EmployeeType IN ('D', 'S')),
        CONSTRAINT UQ_SalaryRecords_Employee UNIQUE (EmployeeType, EmployeeID, MonthDate)
    );
END;
GO

IF OBJECT_ID('dbo.DoctorSalaryRecords', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DoctorSalaryRecords (
        SalaryRecordID INT PRIMARY KEY,
        AppointmentCount INT NOT NULL,
        BaseSalary DECIMAL(15,2) NOT NULL,
        Bonus DECIMAL(15,2) NOT NULL,
        CONSTRAINT FK_DoctorSalaryRecords_SalaryRecords
            FOREIGN KEY (SalaryRecordID) REFERENCES dbo.SalaryRecords(SalaryRecordID)
            ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID('dbo.StaffSalaryRecords', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.StaffSalaryRecords (
        SalaryRecordID INT PRIMARY KEY,
        BaseSalary DECIMAL(15,2) NOT NULL,
        KPIAllowance DECIMAL(15,2) NOT NULL,
        CONSTRAINT FK_StaffSalaryRecords_SalaryRecords
            FOREIGN KEY (SalaryRecordID) REFERENCES dbo.SalaryRecords(SalaryRecordID)
            ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID('dbo.Accounts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Accounts (
        AccountID INT IDENTITY(1,1) PRIMARY KEY,
        Email NVARCHAR(255) NOT NULL,
        Password NVARCHAR(255) NOT NULL,
        FullName NVARCHAR(200) NOT NULL,
        Role NVARCHAR(30) NOT NULL DEFAULT 'user',
        PhoneNumber NVARCHAR(20) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedDate DATETIME2 NULL
    );

    CREATE UNIQUE INDEX UX_Accounts_Email ON dbo.Accounts(Email);
END;
GO

IF OBJECT_ID('dbo.Appointments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Appointments (
        AppointmentID INT IDENTITY(1,1) PRIMARY KEY,
        PatientID INT NOT NULL,
        DoctorID INT NOT NULL,
        AppointmentDate DATE NOT NULL,
        AppointmentTime TIME NOT NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT 'pending',
        Notes NVARCHAR(1000) NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedDate DATETIME2 NULL,
        CONSTRAINT FK_Appointments_Patients
            FOREIGN KEY (PatientID) REFERENCES dbo.Patients(PatientID),
        CONSTRAINT FK_Appointments_Doctors
            FOREIGN KEY (DoctorID) REFERENCES dbo.Doctors(DoctorID),
        CONSTRAINT CK_Appointments_Status
            CHECK (LOWER(Status) IN ('pending', 'booked', 'confirmed', 'cancelled', 'completed', 'checked-in'))
    );
END;
GO

IF OBJECT_ID('dbo.Patients', 'U') IS NOT NULL AND COL_LENGTH('dbo.Patients', 'MedicalHistory') IS NULL
BEGIN
    ALTER TABLE dbo.Patients ADD MedicalHistory NVARCHAR(MAX) NULL;
END;
GO

IF OBJECT_ID('dbo.Doctors', 'U') IS NOT NULL AND COL_LENGTH('dbo.Doctors', 'Qualifications') IS NULL
BEGIN
    ALTER TABLE dbo.Doctors ADD Qualifications NVARCHAR(400) NULL;
END;
GO

IF OBJECT_ID('dbo.Doctors', 'U') IS NOT NULL AND COL_LENGTH('dbo.Doctors', 'Experience') IS NULL
BEGIN
    ALTER TABLE dbo.Doctors ADD Experience INT NULL;
END;
GO

IF OBJECT_ID('dbo.MedicalRecords', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MedicalRecords (
        RecordID INT IDENTITY(1,1) PRIMARY KEY,
        AppointmentID INT NOT NULL UNIQUE,
        DiagnosisCode NVARCHAR(50) NOT NULL,
        Prescription NVARCHAR(MAX) NULL,
        Notes NVARCHAR(MAX) NULL,
        FollowUpDate DATE NULL,
        CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_MedicalRecords_Appointments
            FOREIGN KEY (AppointmentID) REFERENCES dbo.Appointments(AppointmentID)
            ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Specialties)
BEGIN
    INSERT INTO dbo.Specialties (SpecialtyName)
    VALUES ('Cardiology'), ('ENT'), ('Dermatology'), ('General Medicine');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Clinics)
BEGIN
    INSERT INTO dbo.Clinics (ClinicName, Address, PhoneNumber)
    VALUES ('Central Clinic', 'District 1', '0280000001'),
           ('West Clinic', 'District 5', '0280000002');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Doctors)
BEGIN
    INSERT INTO dbo.Doctors (FullName, SpecialtyID, Status, PhoneNumber, Email)
    SELECT 'Dr. Smith', s.SpecialtyID, 'active', '0901000001', 'dr.smith@clinic.local'
    FROM dbo.Specialties s WHERE s.SpecialtyName = 'Cardiology'
    UNION ALL
    SELECT 'Dr. John', s.SpecialtyID, 'active', '0901000002', 'dr.john@clinic.local'
    FROM dbo.Specialties s WHERE s.SpecialtyName = 'ENT'
    UNION ALL
    SELECT 'Dr. Anna', s.SpecialtyID, 'active', '0901000003', 'dr.anna@clinic.local'
    FROM dbo.Specialties s WHERE s.SpecialtyName = 'Dermatology';
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Patients)
BEGIN
    INSERT INTO dbo.Patients (FullName, DateOfBirth, Gender, PhoneNumber, Email, Address)
    VALUES
      ('Nguyen Van A', '1988-04-12', 'Male', '0902000001', 'nva@example.com', 'District 1'),
      ('Tran Thi B', '1991-08-21', 'Female', '0902000002', 'ttb@example.com', 'District 3'),
      ('Le Van C', '1979-01-05', 'Male', '0902000003', 'lvc@example.com', 'District 5'),
      ('Pham Thi D', '1996-11-03', 'Female', '0902000004', 'ptd@example.com', 'District 7'),
      ('Hoang Van E', '2000-06-19', 'Male', '0902000005', 'hve@example.com', 'District 10'),
      ('Vu Thi F', '1984-12-30', 'Female', '0902000006', 'vtf@example.com', 'Thu Duc');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Staff)
BEGIN
    DECLARE @CentralClinicId INT = (SELECT TOP 1 ClinicID FROM dbo.Clinics ORDER BY ClinicID);

    INSERT INTO dbo.Staff (FullName, DateOfBirth, Gender, PhoneNumber, Email, Address, Position, ClinicID, Status)
    VALUES
      ('Le Thi Admin', '1990-03-04', 'Female', '0903000001', 'admin.staff@clinic.local', 'District 1', 'Manager', @CentralClinicId, 'active'),
      ('Tran Van Reception', '1994-07-16', 'Male', '0903000002', 'reception.staff@clinic.local', 'District 1', 'Receptionist', @CentralClinicId, 'active');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Appointments)
BEGIN
    ;WITH p AS (
      SELECT PatientID, ROW_NUMBER() OVER (ORDER BY PatientID) AS rn
      FROM dbo.Patients
    ),
    d AS (
      SELECT DoctorID, ROW_NUMBER() OVER (ORDER BY DoctorID) AS rn
      FROM dbo.Doctors
    )
    INSERT INTO dbo.Appointments (PatientID, DoctorID, AppointmentDate, AppointmentTime, Status, Notes)
    SELECT p.PatientID, d.DoctorID, v.AppointmentDate, v.AppointmentTime, v.Status, v.Notes
    FROM (VALUES
      (1, 1, '2025-04-10', '09:00', 'completed', 'Routine checkup'),
      (2, 2, '2025-04-21', '10:00', 'pending', 'ENT follow-up'),
      (3, 1, '2025-05-03', '11:00', 'completed', 'Cardio monitoring'),
      (4, 3, '2025-05-22', '14:00', 'cancelled', 'Skin consult'),
      (5, 1, '2025-06-05', '09:30', 'completed', 'Cardio follow-up'),
      (6, 2, '2025-06-18', '13:00', 'completed', 'ENT consult'),
      (1, 1, '2025-07-11', '08:45', 'completed', 'Periodic review'),
      (2, 3, '2025-07-17', '10:30', 'completed', 'Dermatology treatment'),
      (3, 1, '2025-08-01', '15:00', 'pending', 'Cardio screening'),
      (4, 2, '2025-08-23', '16:00', 'completed', 'ENT treatment')
    ) v(PatientOrder, DoctorOrder, AppointmentDate, AppointmentTime, Status, Notes)
    INNER JOIN p ON p.rn = v.PatientOrder
    INNER JOIN d ON d.rn = v.DoctorOrder;
END;
GO

PRINT '=== DONE core schema bootstrap for ClinicManagement ===';
GO
