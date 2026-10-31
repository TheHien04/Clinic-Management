-- Advanced database capstone controls.
-- Adds temporal history, optimistic concurrency, governed directory access,
-- integrity checks, and indexes aligned with the application's read patterns.

IF COL_LENGTH('dbo.Patients', 'RowVersion') IS NULL
    ALTER TABLE dbo.Patients ADD RowVersion ROWVERSION;
GO

IF COL_LENGTH('dbo.Patients', 'ValidFrom') IS NULL
BEGIN
    ALTER TABLE dbo.Patients ADD
        ValidFrom DATETIME2(7) GENERATED ALWAYS AS ROW START HIDDEN
            CONSTRAINT DF_Patients_ValidFrom DEFAULT SYSUTCDATETIME(),
        ValidTo DATETIME2(7) GENERATED ALWAYS AS ROW END HIDDEN
            CONSTRAINT DF_Patients_ValidTo DEFAULT '9999-12-31 23:59:59.9999999',
        PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
END;
GO

IF EXISTS (
    SELECT 1 FROM sys.tables
    WHERE object_id = OBJECT_ID('dbo.Patients') AND temporal_type = 0
)
BEGIN
    ALTER TABLE dbo.Patients
    SET (SYSTEM_VERSIONING = ON (
        HISTORY_TABLE = dbo.PatientsHistory,
        DATA_CONSISTENCY_CHECK = ON
    ));
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Appointments')
      AND name = 'CK_Appointments_Status_Governed'
)
BEGIN
    ALTER TABLE dbo.Appointments WITH CHECK ADD CONSTRAINT CK_Appointments_Status_Governed
    CHECK (LOWER(Status) IN ('pending', 'confirmed', 'checked-in', 'completed', 'cancelled'));
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Patients') AND name = 'UX_Patients_Clinic_Phone'
)
    CREATE UNIQUE INDEX UX_Patients_Clinic_Phone
    ON dbo.Patients(ClinicID, PhoneNumber)
    WHERE PhoneNumber IS NOT NULL;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Appointments') AND name = 'IX_Appointments_Clinic_Patient_Status_Date'
)
    CREATE INDEX IX_Appointments_Clinic_Patient_Status_Date
    ON dbo.Appointments(ClinicID, PatientID, Status, AppointmentDate DESC)
    INCLUDE (DoctorID, AppointmentTime);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.ClinicalEventOutbox') AND name = 'IX_ClinicalEventOutbox_Relay'
)
    CREATE INDEX IX_ClinicalEventOutbox_Relay
    ON dbo.ClinicalEventOutbox(Status, NextAttemptAt, OccurredAt)
    INCLUDE (Attempts, LockID, LockedAt, EventType, AggregateType, AggregateID);
GO

CREATE OR ALTER VIEW dbo.vw_PatientCareSummary
AS
SELECT
    p.PatientID,
    p.ClinicID,
    p.FullName,
    p.DateOfBirth,
    p.Gender,
    p.PhoneNumber,
    p.Email,
    p.Address,
    p.MedicalHistory,
    p.CreatedDate,
    CONVERT(VARCHAR(18), p.RowVersion, 1) AS RecordVersion,
    COUNT(DISTINCT CASE
        WHEN LOWER(ISNULL(a.Status, '')) = 'completed'
          AND a.AppointmentDate <= CAST(GETDATE() AS DATE)
        THEN a.AppointmentID
    END) AS CompletedVisitCount,
    MAX(CASE
        WHEN LOWER(ISNULL(a.Status, '')) = 'completed'
          AND a.AppointmentDate <= CAST(GETDATE() AS DATE)
        THEN a.AppointmentDate
    END) AS LastCompletedVisit,
    COUNT(DISTINCT CASE WHEN LOWER(ISNULL(a.Status, '')) = 'cancelled' THEN a.AppointmentID END) AS CancelledVisitCount,
    COUNT(DISTINCT mr.RecordID) AS ClinicalRecordCount
FROM dbo.Patients p
LEFT JOIN dbo.Appointments a ON a.PatientID = p.PatientID AND a.ClinicID = p.ClinicID
LEFT JOIN dbo.MedicalRecords mr ON mr.AppointmentID = a.AppointmentID
GROUP BY
    p.PatientID, p.ClinicID, p.FullName, p.DateOfBirth, p.Gender,
    p.PhoneNumber, p.Email, p.Address, p.MedicalHistory, p.CreatedDate, p.RowVersion;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetPatientDirectory
    @ClinicID INT = NULL,
    @Search NVARCHAR(120) = NULL,
    @Offset INT = 0,
    @Limit INT = 25
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Offset = CASE WHEN @Offset < 0 THEN 0 ELSE @Offset END;
    SET @Limit = CASE WHEN @Limit < 1 THEN 25 WHEN @Limit > 500 THEN 500 ELSE @Limit END;
    SET @Search = NULLIF(LTRIM(RTRIM(@Search)), '');

    SELECT
        PatientID, FullName, DateOfBirth, Gender, PhoneNumber, Email,
        Address, MedicalHistory, CreatedDate, RecordVersion,
        CompletedVisitCount, LastCompletedVisit, CancelledVisitCount,
        ClinicalRecordCount,
        COUNT_BIG(*) OVER () AS TotalRows
    FROM dbo.vw_PatientCareSummary
    WHERE (@ClinicID IS NULL OR ClinicID = @ClinicID)
      AND (
        @Search IS NULL
        OR FullName LIKE '%' + @Search + '%'
        OR PhoneNumber LIKE '%' + @Search + '%'
        OR Email LIKE '%' + @Search + '%'
      )
    ORDER BY CreatedDate DESC, PatientID DESC
    OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_VerifyClinicalDataIntegrity
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        (SELECT COUNT_BIG(*) FROM dbo.Patients) AS Patients,
        (SELECT COUNT_BIG(*) FROM dbo.Doctors) AS Doctors,
        (SELECT COUNT_BIG(*) FROM dbo.Appointments) AS Appointments,
        (SELECT COUNT_BIG(*) FROM dbo.MedicalRecords) AS MedicalRecords,
        (SELECT COUNT_BIG(*) FROM dbo.PatientConsents) AS ConsentEvents,
        (SELECT COUNT_BIG(*) FROM dbo.MolecularProfileRegistry) AS MolecularProfiles;

    SELECT CheckName, ViolationCount
    FROM (VALUES
        ('orphan_appointments', (SELECT COUNT_BIG(*) FROM dbo.Appointments a LEFT JOIN dbo.Patients p ON p.PatientID = a.PatientID WHERE p.PatientID IS NULL)),
        ('orphan_medical_records', (SELECT COUNT_BIG(*) FROM dbo.MedicalRecords mr LEFT JOIN dbo.Appointments a ON a.AppointmentID = mr.AppointmentID WHERE a.AppointmentID IS NULL)),
        ('invalid_icd_codes', (SELECT COUNT_BIG(*) FROM dbo.MedicalRecords mr LEFT JOIN dbo.ClinicalTerminologyCodes c ON c.CodeSystem = 'ICD-10' AND c.Code = mr.DiagnosisCode AND c.IsActive = 1 WHERE mr.DiagnosisCode IS NOT NULL AND c.Code IS NULL)),
        ('invalid_consent_json', (SELECT COUNT_BIG(*) FROM dbo.PatientConsents WHERE ScopeJson IS NOT NULL AND ISJSON(ScopeJson) = 0)),
        ('outbox_backlog', (SELECT COUNT_BIG(*) FROM dbo.ClinicalEventOutbox WHERE Status IN ('pending', 'processing', 'failed')))
    ) checks(CheckName, ViolationCount)
    ORDER BY CheckName;

    SELECT
        t.name AS TableName,
        t.temporal_type_desc AS TemporalMode,
        OBJECT_NAME(t.history_table_id) AS HistoryTable
    FROM sys.tables t
    WHERE t.object_id = OBJECT_ID('dbo.Patients');
END;
GO

UPDATE STATISTICS dbo.Patients WITH FULLSCAN;
UPDATE STATISTICS dbo.Appointments WITH FULLSCAN;
UPDATE STATISTICS dbo.MedicalRecords WITH FULLSCAN;
GO
