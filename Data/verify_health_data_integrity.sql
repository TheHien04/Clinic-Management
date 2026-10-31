USE ClinicManagement;
GO

-- A single executable evidence script for the advanced-database report.
EXEC dbo.sp_VerifyClinicalDataIntegrity;
GO

SELECT
    sm.MigrationId,
    sm.Checksum,
    sm.AppliedAt
FROM dbo.SchemaMigrations sm
ORDER BY sm.MigrationId;
GO

SELECT
    OBJECT_SCHEMA_NAME(i.object_id) AS SchemaName,
    OBJECT_NAME(i.object_id) AS TableName,
    i.name AS IndexName,
    i.type_desc,
    i.is_unique
FROM sys.indexes i
WHERE i.name IN (
    'UX_Patients_Clinic_Phone',
    'IX_Appointments_Clinic_Patient_Status_Date',
    'IX_ClinicalEventOutbox_Relay'
)
ORDER BY TableName, IndexName;
GO

SET STATISTICS IO ON;
SET STATISTICS TIME ON;
EXEC dbo.sp_GetPatientDirectory @ClinicID = 1, @Search = NULL, @Offset = 0, @Limit = 25;
SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;
GO
