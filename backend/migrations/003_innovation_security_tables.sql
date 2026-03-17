-- Versioned migration 003
-- Innovation governance and signing key lifecycle tables

USE ClinicManagement;
GO

IF OBJECT_ID('dbo.InnovationTriagePolicies', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InnovationTriagePolicies (
        PolicyVersion INT NOT NULL PRIMARY KEY,
        PolicyJson NVARCHAR(MAX) NOT NULL,
        ChangedAt DATETIME2 NOT NULL,
        ChangedBy NVARCHAR(255) NOT NULL,
        Note NVARCHAR(255) NULL
    );
END;
GO

IF OBJECT_ID('dbo.InnovationTriageAudits', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InnovationTriageAudits (
        AuditId NVARCHAR(80) NOT NULL PRIMARY KEY,
        Urgency NVARCHAR(20) NOT NULL,
        RiskScore INT NOT NULL,
        RequestedBy NVARCHAR(255) NOT NULL,
        PolicyVersion INT NOT NULL,
        GeneratedAt DATETIME2 NOT NULL,
        Digest NVARCHAR(128) NOT NULL
    );
END;
GO

IF OBJECT_ID('dbo.InnovationSigningKeys', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InnovationSigningKeys (
        KeyId NVARCHAR(100) NOT NULL PRIMARY KEY,
        PrivateKeyPem NVARCHAR(MAX) NOT NULL,
        PublicKeyPem NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIME2 NOT NULL,
        Source NVARCHAR(50) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 0,
        RevokedAt DATETIME2 NULL
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_InnovationSigningKeys_Active'
      AND object_id = OBJECT_ID('dbo.InnovationSigningKeys')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_InnovationSigningKeys_Active
    ON dbo.InnovationSigningKeys (IsActive)
    INCLUDE (CreatedAt, Source)
    WHERE RevokedAt IS NULL;
END;
GO