-- Versioned migration 002
-- Source aligned from Data/create_advanced_sqlserver_analytics.sql

USE ClinicManagement;
GO

IF OBJECT_ID('dbo.Appointments', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_Appointments_Doctor_Date_Time_Status'
          AND object_id = OBJECT_ID('dbo.Appointments')
    )
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Appointments_Doctor_Date_Time_Status
        ON dbo.Appointments (DoctorID, AppointmentDate, AppointmentTime)
        INCLUDE (Status, PatientID, Notes, CreatedDate);
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_Appointments_Date_Status'
          AND object_id = OBJECT_ID('dbo.Appointments')
    )
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Appointments_Date_Status
        ON dbo.Appointments (AppointmentDate, Status)
        INCLUDE (DoctorID, PatientID, AppointmentTime);
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_Appointments_Patient_Date'
          AND object_id = OBJECT_ID('dbo.Appointments')
    )
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Appointments_Patient_Date
        ON dbo.Appointments (PatientID, AppointmentDate DESC)
        INCLUDE (DoctorID, Status, AppointmentTime);
    END;
END;
GO

IF OBJECT_ID('dbo.Doctors', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_Doctors_SpecialtyID'
          AND object_id = OBJECT_ID('dbo.Doctors')
    )
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Doctors_SpecialtyID
        ON dbo.Doctors (SpecialtyID)
        INCLUDE (FullName, DoctorID, Status);
    END;
END;
GO

IF OBJECT_ID('dbo.Patients', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_Patients_FullName'
          AND object_id = OBJECT_ID('dbo.Patients')
    )
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Patients_FullName
        ON dbo.Patients (FullName)
        INCLUDE (PatientID, PhoneNumber, Email);
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_Patients_PhoneNumber'
          AND object_id = OBJECT_ID('dbo.Patients')
    )
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Patients_PhoneNumber
        ON dbo.Patients (PhoneNumber)
        INCLUDE (PatientID, FullName);
    END;
END;
GO

IF OBJECT_ID('dbo.Appointments', 'U') IS NOT NULL UPDATE STATISTICS dbo.Appointments WITH FULLSCAN;
IF OBJECT_ID('dbo.Doctors', 'U') IS NOT NULL UPDATE STATISTICS dbo.Doctors WITH FULLSCAN;
IF OBJECT_ID('dbo.Patients', 'U') IS NOT NULL UPDATE STATISTICS dbo.Patients WITH FULLSCAN;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetAnalyticsAppointments
    @FromDate DATE = NULL,
    @ToDate DATE = NULL,
    @DoctorId INT = NULL,
    @Status NVARCHAR(50) = NULL,
    @Service NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        SELECT
            a.AppointmentID,
            a.AppointmentDate,
            a.AppointmentTime,
            a.Status,
            p.FullName AS PatientName,
            d.FullName AS DoctorName,
            s.SpecialtyName,
            CASE
                WHEN LOWER(ISNULL(s.SpecialtyName, '')) LIKE '%cardio%' THEN 320000
                WHEN LOWER(ISNULL(s.SpecialtyName, '')) LIKE '%derma%' THEN 250000
                WHEN LOWER(ISNULL(s.SpecialtyName, '')) LIKE '%ent%' THEN 220000
                WHEN LOWER(ISNULL(s.SpecialtyName, '')) LIKE '%pediatric%' THEN 210000
                WHEN LOWER(ISNULL(s.SpecialtyName, '')) LIKE '%eye%' THEN 240000
                ELSE 200000
            END AS FeeEstimate
        FROM dbo.Appointments a
        LEFT JOIN dbo.Patients p ON a.PatientID = p.PatientID
        LEFT JOIN dbo.Doctors d ON a.DoctorID = d.DoctorID
        LEFT JOIN dbo.Specialties s ON d.SpecialtyID = s.SpecialtyID
        WHERE (@FromDate IS NULL OR a.AppointmentDate >= @FromDate)
          AND (@ToDate IS NULL OR a.AppointmentDate <= @ToDate)
          AND (@DoctorId IS NULL OR a.DoctorID = @DoctorId)
          AND (@Status IS NULL OR LOWER(a.Status) = LOWER(@Status))
          AND (@Service IS NULL OR s.SpecialtyName = @Service)
        ORDER BY a.AppointmentDate ASC, a.AppointmentTime ASC;
    END TRY
    BEGIN CATCH
        DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE();
        THROW 50001, @Err, 1;
    END CATCH
END;
GO

CREATE OR ALTER VIEW dbo.vw_AnalyticsMonthlyAppointments
AS
SELECT
    CONVERT(CHAR(7), a.AppointmentDate, 126) AS YearMonth,
    COUNT_BIG(*) AS TotalAppointments,
    SUM(CASE WHEN LOWER(a.Status) = 'completed' THEN 1 ELSE 0 END) AS CompletedAppointments,
    SUM(CASE WHEN LOWER(a.Status) = 'cancelled' THEN 1 ELSE 0 END) AS CancelledAppointments,
    COUNT(DISTINCT a.PatientID) AS UniquePatients,
    COUNT(DISTINCT a.DoctorID) AS ActiveDoctors
FROM dbo.Appointments a
GROUP BY CONVERT(CHAR(7), a.AppointmentDate, 126);
GO
