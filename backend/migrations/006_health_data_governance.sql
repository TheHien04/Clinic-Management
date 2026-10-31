-- Health-data governance foundation.
-- SQL Server remains the transactional source of truth; MongoDB is populated
-- asynchronously from the outbox created in this migration.

IF COL_LENGTH('dbo.Patients', 'ClinicID') IS NULL
    ALTER TABLE dbo.Patients ADD ClinicID INT NULL;
IF COL_LENGTH('dbo.Patients', 'SyntheticKey') IS NULL
    ALTER TABLE dbo.Patients ADD SyntheticKey NVARCHAR(80) NULL;

IF COL_LENGTH('dbo.Doctors', 'ClinicID') IS NULL
    ALTER TABLE dbo.Doctors ADD ClinicID INT NULL;
IF COL_LENGTH('dbo.Doctors', 'SyntheticKey') IS NULL
    ALTER TABLE dbo.Doctors ADD SyntheticKey NVARCHAR(80) NULL;

IF COL_LENGTH('dbo.Appointments', 'ClinicID') IS NULL
    ALTER TABLE dbo.Appointments ADD ClinicID INT NULL;
IF COL_LENGTH('dbo.Appointments', 'SyntheticKey') IS NULL
    ALTER TABLE dbo.Appointments ADD SyntheticKey NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.MedicalRecords', 'SyntheticKey') IS NULL
    ALTER TABLE dbo.MedicalRecords ADD SyntheticKey NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.Accounts', 'ClinicID') IS NULL
    ALTER TABLE dbo.Accounts ADD ClinicID INT NULL;
GO

DECLARE @DefaultClinicID INT = (SELECT TOP (1) ClinicID FROM dbo.Clinics ORDER BY ClinicID);

UPDATE dbo.Patients SET ClinicID = @DefaultClinicID WHERE ClinicID IS NULL;
UPDATE dbo.Doctors SET ClinicID = @DefaultClinicID WHERE ClinicID IS NULL;
UPDATE a
SET a.ClinicID = COALESCE(d.ClinicID, p.ClinicID, @DefaultClinicID)
FROM dbo.Appointments a
JOIN dbo.Patients p ON p.PatientID = a.PatientID
JOIN dbo.Doctors d ON d.DoctorID = a.DoctorID
WHERE a.ClinicID IS NULL;
UPDATE dbo.Accounts SET ClinicID = @DefaultClinicID WHERE ClinicID IS NULL;
GO

IF OBJECT_ID('dbo.FK_Patients_Clinics', 'F') IS NULL
    ALTER TABLE dbo.Patients ADD CONSTRAINT FK_Patients_Clinics FOREIGN KEY (ClinicID) REFERENCES dbo.Clinics(ClinicID);
IF OBJECT_ID('dbo.FK_Doctors_Clinics', 'F') IS NULL
    ALTER TABLE dbo.Doctors ADD CONSTRAINT FK_Doctors_Clinics FOREIGN KEY (ClinicID) REFERENCES dbo.Clinics(ClinicID);
IF OBJECT_ID('dbo.FK_Appointments_Clinics', 'F') IS NULL
    ALTER TABLE dbo.Appointments ADD CONSTRAINT FK_Appointments_Clinics FOREIGN KEY (ClinicID) REFERENCES dbo.Clinics(ClinicID);
IF OBJECT_ID('dbo.FK_Accounts_Clinics', 'F') IS NULL
    ALTER TABLE dbo.Accounts ADD CONSTRAINT FK_Accounts_Clinics FOREIGN KEY (ClinicID) REFERENCES dbo.Clinics(ClinicID);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Patients') AND name = 'IX_Patients_Clinic_Created')
    CREATE INDEX IX_Patients_Clinic_Created ON dbo.Patients(ClinicID, CreatedDate DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Appointments') AND name = 'IX_Appointments_Clinic_Date_Status')
    CREATE INDEX IX_Appointments_Clinic_Date_Status ON dbo.Appointments(ClinicID, AppointmentDate DESC, Status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.MedicalRecords') AND name = 'IX_MedicalRecords_Diagnosis_Created')
    CREATE INDEX IX_MedicalRecords_Diagnosis_Created ON dbo.MedicalRecords(DiagnosisCode, CreatedDate DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Patients') AND name = 'UX_Patients_SyntheticKey')
    CREATE UNIQUE INDEX UX_Patients_SyntheticKey ON dbo.Patients(SyntheticKey) WHERE SyntheticKey IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Doctors') AND name = 'UX_Doctors_SyntheticKey')
    CREATE UNIQUE INDEX UX_Doctors_SyntheticKey ON dbo.Doctors(SyntheticKey) WHERE SyntheticKey IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Appointments') AND name = 'UX_Appointments_SyntheticKey')
    CREATE UNIQUE INDEX UX_Appointments_SyntheticKey ON dbo.Appointments(SyntheticKey) WHERE SyntheticKey IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.MedicalRecords') AND name = 'UX_MedicalRecords_SyntheticKey')
    CREATE UNIQUE INDEX UX_MedicalRecords_SyntheticKey ON dbo.MedicalRecords(SyntheticKey) WHERE SyntheticKey IS NOT NULL;
GO

IF OBJECT_ID('dbo.ClinicalTerminologyCodes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClinicalTerminologyCodes (
        CodeSystem NVARCHAR(30) NOT NULL,
        Code NVARCHAR(50) NOT NULL,
        DisplayName NVARCHAR(200) NOT NULL,
        ClinicalGroup NVARCHAR(80) NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_ClinicalTerminologyCodes_IsActive DEFAULT 1,
        CONSTRAINT PK_ClinicalTerminologyCodes PRIMARY KEY (CodeSystem, Code)
    );
END;
GO

MERGE dbo.ClinicalTerminologyCodes AS target
USING (VALUES
    ('ICD-10', 'I10', 'Essential hypertension', 'Cardiovascular'),
    ('ICD-10', 'E11.9', 'Type 2 diabetes mellitus without complications', 'Endocrine'),
    ('ICD-10', 'J45.9', 'Asthma, unspecified', 'Respiratory'),
    ('ICD-10', 'J06.9', 'Acute upper respiratory infection', 'Respiratory'),
    ('ICD-10', 'K21.9', 'Gastro-esophageal reflux disease', 'Digestive'),
    ('ICD-10', 'M54.5', 'Low back pain', 'Musculoskeletal'),
    ('ICD-10', 'L30.9', 'Dermatitis, unspecified', 'Dermatology'),
    ('ICD-10', 'H66.9', 'Otitis media, unspecified', 'ENT'),
    ('ICD-10', 'G43.9', 'Migraine, unspecified', 'Neurology'),
    ('ICD-10', 'N18.2', 'Chronic kidney disease, stage 2', 'Renal'),
    ('ICD-10', 'F41.1', 'Generalized anxiety disorder', 'Behavioral health'),
    ('ICD-10', 'Z00.0', 'General adult medical examination', 'Preventive')
) AS source(CodeSystem, Code, DisplayName, ClinicalGroup)
ON target.CodeSystem = source.CodeSystem AND target.Code = source.Code
WHEN MATCHED THEN UPDATE SET DisplayName = source.DisplayName, ClinicalGroup = source.ClinicalGroup, IsActive = 1
WHEN NOT MATCHED THEN INSERT (CodeSystem, Code, DisplayName, ClinicalGroup)
VALUES (source.CodeSystem, source.Code, source.DisplayName, source.ClinicalGroup);
GO

IF OBJECT_ID('dbo.PatientConsents', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PatientConsents (
        ConsentID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        PatientID INT NOT NULL,
        ClinicID INT NOT NULL,
        ConsentType NVARCHAR(40) NOT NULL,
        Status NVARCHAR(20) NOT NULL,
        ScopeJson NVARCHAR(MAX) NULL,
        EffectiveAt DATETIME2 NOT NULL CONSTRAINT DF_PatientConsents_EffectiveAt DEFAULT SYSUTCDATETIME(),
        ExpiresAt DATETIME2 NULL,
        CapturedByAccountID INT NULL,
        Version INT NOT NULL CONSTRAINT DF_PatientConsents_Version DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_PatientConsents_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_PatientConsents_Patients FOREIGN KEY (PatientID) REFERENCES dbo.Patients(PatientID),
        CONSTRAINT FK_PatientConsents_Clinics FOREIGN KEY (ClinicID) REFERENCES dbo.Clinics(ClinicID),
        CONSTRAINT FK_PatientConsents_Accounts FOREIGN KEY (CapturedByAccountID) REFERENCES dbo.Accounts(AccountID),
        CONSTRAINT CK_PatientConsents_Type CHECK (ConsentType IN ('care', 'analytics', 'research', 'genomics', 'data-sharing')),
        CONSTRAINT CK_PatientConsents_Status CHECK (Status IN ('granted', 'denied', 'withdrawn', 'expired')),
        CONSTRAINT CK_PatientConsents_ScopeJson CHECK (ScopeJson IS NULL OR ISJSON(ScopeJson) = 1)
    );
    CREATE INDEX IX_PatientConsents_Latest ON dbo.PatientConsents(ClinicID, PatientID, ConsentType, CreatedAt DESC);
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_PatientConsents_AppendOnly
ON dbo.PatientConsents
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    THROW 51011, 'PatientConsents is append-only. Record a new consent decision instead.', 1;
END;
GO

IF OBJECT_ID('dbo.ClinicalAuditEvents', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClinicalAuditEvents (
        AuditEventID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ClinicID INT NULL,
        ActorAccountID INT NULL,
        ActorEmailHash CHAR(64) NULL,
        ActionName NVARCHAR(80) NOT NULL,
        ResourceType NVARCHAR(80) NOT NULL,
        ResourceID NVARCHAR(100) NULL,
        PatientID INT NULL,
        PurposeOfUse NVARCHAR(40) NOT NULL,
        MetadataJson NVARCHAR(MAX) NULL,
        OccurredAt DATETIME2 NOT NULL CONSTRAINT DF_ClinicalAuditEvents_OccurredAt DEFAULT SYSUTCDATETIME(),
        PrevHash VARBINARY(32) NULL,
        EventHash VARBINARY(32) NOT NULL,
        CONSTRAINT FK_ClinicalAuditEvents_Clinics FOREIGN KEY (ClinicID) REFERENCES dbo.Clinics(ClinicID),
        CONSTRAINT FK_ClinicalAuditEvents_Accounts FOREIGN KEY (ActorAccountID) REFERENCES dbo.Accounts(AccountID),
        CONSTRAINT CK_ClinicalAuditEvents_MetadataJson CHECK (MetadataJson IS NULL OR ISJSON(MetadataJson) = 1)
    );
    CREATE INDEX IX_ClinicalAuditEvents_Clinic_Time ON dbo.ClinicalAuditEvents(ClinicID, OccurredAt DESC);
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_ClinicalAuditEvents_Immutable
ON dbo.ClinicalAuditEvents
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    THROW 51012, 'ClinicalAuditEvents is immutable.', 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_AppendClinicalAuditEvent
    @ClinicID INT = NULL,
    @ActorAccountID INT = NULL,
    @ActorEmail NVARCHAR(255) = NULL,
    @ActionName NVARCHAR(80),
    @ResourceType NVARCHAR(80),
    @ResourceID NVARCHAR(100) = NULL,
    @PatientID INT = NULL,
    @PurposeOfUse NVARCHAR(40),
    @MetadataJson NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    DECLARE @PrevHash VARBINARY(32);
    DECLARE @OccurredAt DATETIME2 = SYSUTCDATETIME();
    DECLARE @ActorEmailHash CHAR(64) = CASE WHEN @ActorEmail IS NULL THEN NULL ELSE CONVERT(CHAR(64), HASHBYTES('SHA2_256', LOWER(@ActorEmail)), 2) END;

    SELECT TOP (1) @PrevHash = EventHash
    FROM dbo.ClinicalAuditEvents WITH (UPDLOCK, HOLDLOCK)
    ORDER BY AuditEventID DESC;

    DECLARE @Canonical NVARCHAR(MAX) = CONCAT(
        COALESCE(CONVERT(VARCHAR(64), @PrevHash, 2), ''), '|',
        COALESCE(CONVERT(NVARCHAR(20), @ClinicID), ''), '|',
        COALESCE(CONVERT(NVARCHAR(20), @ActorAccountID), ''), '|',
        COALESCE(@ActorEmailHash, ''), '|', @ActionName, '|', @ResourceType, '|',
        COALESCE(@ResourceID, ''), '|', COALESCE(CONVERT(NVARCHAR(20), @PatientID), ''), '|',
        @PurposeOfUse, '|', COALESCE(@MetadataJson, ''), '|', CONVERT(NVARCHAR(33), @OccurredAt, 126)
    );

    INSERT INTO dbo.ClinicalAuditEvents (
        ClinicID, ActorAccountID, ActorEmailHash, ActionName, ResourceType,
        ResourceID, PatientID, PurposeOfUse, MetadataJson, OccurredAt, PrevHash, EventHash
    )
    VALUES (
        @ClinicID, @ActorAccountID, @ActorEmailHash, @ActionName, @ResourceType,
        @ResourceID, @PatientID, @PurposeOfUse, @MetadataJson, @OccurredAt,
        @PrevHash, HASHBYTES('SHA2_256', @Canonical)
    );

    COMMIT TRANSACTION;
END;
GO

IF OBJECT_ID('dbo.ClinicalEventOutbox', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClinicalEventOutbox (
        OutboxID UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_ClinicalEventOutbox_ID DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        EventType NVARCHAR(100) NOT NULL,
        AggregateType NVARCHAR(80) NOT NULL,
        AggregateID NVARCHAR(100) NOT NULL,
        PatientID INT NULL,
        ClinicID INT NULL,
        PayloadJson NVARCHAR(MAX) NOT NULL,
        OccurredAt DATETIME2 NOT NULL CONSTRAINT DF_ClinicalEventOutbox_OccurredAt DEFAULT SYSUTCDATETIME(),
        Status NVARCHAR(20) NOT NULL CONSTRAINT DF_ClinicalEventOutbox_Status DEFAULT 'pending',
        Attempts INT NOT NULL CONSTRAINT DF_ClinicalEventOutbox_Attempts DEFAULT 0,
        NextAttemptAt DATETIME2 NOT NULL CONSTRAINT DF_ClinicalEventOutbox_NextAttemptAt DEFAULT SYSUTCDATETIME(),
        LastError NVARCHAR(1000) NULL,
        PublishedAt DATETIME2 NULL,
        LockID UNIQUEIDENTIFIER NULL,
        LockedAt DATETIME2 NULL,
        CONSTRAINT CK_ClinicalEventOutbox_PayloadJson CHECK (ISJSON(PayloadJson) = 1),
        CONSTRAINT CK_ClinicalEventOutbox_Status CHECK (Status IN ('pending', 'processing', 'published', 'failed'))
    );
    CREATE INDEX IX_ClinicalEventOutbox_Dispatch ON dbo.ClinicalEventOutbox(Status, NextAttemptAt, OccurredAt);
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_MedicalRecords_Outbox
ON dbo.MedicalRecords
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.ClinicalEventOutbox (EventType, AggregateType, AggregateID, PatientID, ClinicID, PayloadJson)
    SELECT
        CASE WHEN i.RecordID IS NOT NULL AND d.RecordID IS NOT NULL THEN 'medical-record.updated'
             WHEN i.RecordID IS NOT NULL THEN 'medical-record.created'
             ELSE 'medical-record.deleted' END,
        'MedicalRecord',
        CONVERT(NVARCHAR(100), COALESCE(i.RecordID, d.RecordID)),
        a.PatientID,
        a.ClinicID,
        (SELECT
            COALESCE(i.RecordID, d.RecordID) AS recordId,
            COALESCE(i.AppointmentID, d.AppointmentID) AS appointmentId,
            a.PatientID AS patientId,
            COALESCE(i.DiagnosisCode, d.DiagnosisCode) AS diagnosisCode,
            'ICD-10' AS codeSystem,
            'privacy-minimized' AS payloadClass
         FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.RecordID = i.RecordID
    LEFT JOIN dbo.Appointments a ON a.AppointmentID = COALESCE(i.AppointmentID, d.AppointmentID);
END;
GO

IF OBJECT_ID('dbo.MolecularProfileRegistry', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MolecularProfileRegistry (
        MolecularProfileID UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_MolecularProfileRegistry_ID DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        SyntheticKey NVARCHAR(100) NULL,
        PatientID INT NOT NULL,
        ClinicID INT NOT NULL,
        ConsentID BIGINT NOT NULL,
        AssayType NVARCHAR(80) NOT NULL,
        GenomeBuild NVARCHAR(30) NOT NULL,
        SpecimenType NVARCHAR(60) NOT NULL,
        SourceFormat NVARCHAR(20) NOT NULL,
        ChecksumSha256 CHAR(64) NOT NULL,
        VariantCount INT NOT NULL,
        InterpretationStatus NVARCHAR(30) NOT NULL,
        CollectedAt DATETIME2 NOT NULL,
        IngestedAt DATETIME2 NOT NULL CONSTRAINT DF_MolecularProfileRegistry_IngestedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_MolecularProfileRegistry_Patient FOREIGN KEY (PatientID) REFERENCES dbo.Patients(PatientID),
        CONSTRAINT FK_MolecularProfileRegistry_Clinic FOREIGN KEY (ClinicID) REFERENCES dbo.Clinics(ClinicID),
        CONSTRAINT FK_MolecularProfileRegistry_Consent FOREIGN KEY (ConsentID) REFERENCES dbo.PatientConsents(ConsentID),
        CONSTRAINT CK_MolecularProfileRegistry_VariantCount CHECK (VariantCount >= 0)
    );
    CREATE UNIQUE INDEX UX_MolecularProfileRegistry_SyntheticKey ON dbo.MolecularProfileRegistry(SyntheticKey) WHERE SyntheticKey IS NOT NULL;
    CREATE INDEX IX_MolecularProfileRegistry_Patient ON dbo.MolecularProfileRegistry(ClinicID, PatientID, CollectedAt DESC);
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_MolecularProfileRegistry_Outbox
ON dbo.MolecularProfileRegistry
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.ClinicalEventOutbox (EventType, AggregateType, AggregateID, PatientID, ClinicID, PayloadJson)
    SELECT
        'molecular-profile.registered', 'MolecularProfile', CONVERT(NVARCHAR(100), i.MolecularProfileID),
        i.PatientID, i.ClinicID,
        (SELECT
            CONVERT(NVARCHAR(100), i.MolecularProfileID) AS molecularProfileId,
            i.PatientID AS patientId,
            i.AssayType AS assayType,
            i.GenomeBuild AS genomeBuild,
            i.SpecimenType AS specimenType,
            i.SourceFormat AS sourceFormat,
            i.ChecksumSha256 AS checksumSha256,
            i.VariantCount AS variantCount,
            i.InterpretationStatus AS interpretationStatus,
            i.CollectedAt AS collectedAt,
            'metadata-only' AS payloadClass
         FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i;
END;
GO

IF OBJECT_ID('dbo.SyntheticDatasetRuns', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SyntheticDatasetRuns (
        DatasetVersion NVARCHAR(80) NOT NULL PRIMARY KEY,
        Description NVARCHAR(400) NOT NULL,
        PatientRows INT NOT NULL,
        AppointmentRows INT NOT NULL,
        MedicalRecordRows INT NOT NULL,
        SeededAt DATETIME2 NOT NULL CONSTRAINT DF_SyntheticDatasetRuns_SeededAt DEFAULT SYSUTCDATETIME()
    );
END;
GO
