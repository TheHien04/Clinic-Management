-- =============================================================
-- INNOVATION OPERATIONS TABLES (ClinicManagement)
-- Purpose: Persist hospital operations artifacts for Dashboard
-- =============================================================

IF DB_ID('ClinicManagement') IS NULL
BEGIN
    CREATE DATABASE ClinicManagement;
END;
GO

USE ClinicManagement;
GO

IF OBJECT_ID('dbo.InnovationOperationsHandovers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InnovationOperationsHandovers (
        HandoverId BIGINT NOT NULL PRIMARY KEY,
        Situation NVARCHAR(1200) NOT NULL,
        Background NVARCHAR(1200) NOT NULL,
        Assessment NVARCHAR(1200) NOT NULL,
        Recommendation NVARCHAR(1200) NOT NULL,
        AuthoredBy NVARCHAR(255) NOT NULL,
        SavedAt DATETIME2 NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_InnovationOperationsHandovers_SavedAt
        ON dbo.InnovationOperationsHandovers (SavedAt DESC);
END;
GO

IF OBJECT_ID('dbo.InnovationOperationsHandoverAudits', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InnovationOperationsHandoverAudits (
        AuditId BIGINT NOT NULL PRIMARY KEY,
        EventType NVARCHAR(40) NOT NULL,
        Actor NVARCHAR(255) NOT NULL,
        FiltersJson NVARCHAR(1200) NULL,
        HandoverId BIGINT NULL,
        LoggedAt DATETIME2 NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_InnovationOperationsHandoverAudits_LoggedAt
        ON dbo.InnovationOperationsHandoverAudits (LoggedAt DESC);
END;
GO
