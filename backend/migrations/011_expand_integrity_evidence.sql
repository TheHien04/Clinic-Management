-- Expand the executable integrity evidence after tenant constraints are live.

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

    ;WITH AuditChain AS (
        SELECT AuditEventID, PrevHash,
               LAG(EventHash) OVER (ORDER BY AuditEventID) AS ExpectedPrevHash
        FROM dbo.ClinicalAuditEvents
    )
    SELECT CheckName, ViolationCount
    FROM (VALUES
        ('audit_chain_link_mismatch', (SELECT COUNT_BIG(*) FROM AuditChain WHERE (ExpectedPrevHash IS NULL AND PrevHash IS NOT NULL) OR (ExpectedPrevHash IS NOT NULL AND (PrevHash IS NULL OR PrevHash <> ExpectedPrevHash)))),
        ('cross_clinic_appointments', (SELECT COUNT_BIG(*) FROM dbo.Appointments a JOIN dbo.Patients p ON p.PatientID = a.PatientID JOIN dbo.Doctors d ON d.DoctorID = a.DoctorID WHERE a.ClinicID <> p.ClinicID OR a.ClinicID <> d.ClinicID)),
        ('duplicate_patient_phone_per_clinic', (SELECT COUNT_BIG(*) FROM (SELECT ClinicID, PhoneNumber FROM dbo.Patients WHERE PhoneNumber IS NOT NULL GROUP BY ClinicID, PhoneNumber HAVING COUNT_BIG(*) > 1) duplicates)),
        ('invalid_consent_json', (SELECT COUNT_BIG(*) FROM dbo.PatientConsents WHERE ScopeJson IS NOT NULL AND ISJSON(ScopeJson) = 0)),
        ('invalid_icd_codes', (SELECT COUNT_BIG(*) FROM dbo.MedicalRecords mr LEFT JOIN dbo.ClinicalTerminologyCodes c ON c.CodeSystem = 'ICD-10' AND c.Code = mr.DiagnosisCode AND c.IsActive = 1 WHERE mr.DiagnosisCode IS NOT NULL AND c.Code IS NULL)),
        ('missing_tenant_keys', (
            (SELECT COUNT_BIG(*) FROM dbo.Patients WHERE ClinicID IS NULL)
            + (SELECT COUNT_BIG(*) FROM dbo.Doctors WHERE ClinicID IS NULL)
            + (SELECT COUNT_BIG(*) FROM dbo.Appointments WHERE ClinicID IS NULL)
            + (SELECT COUNT_BIG(*) FROM dbo.Accounts WHERE ClinicID IS NULL)
        )),
        ('orphan_appointments', (SELECT COUNT_BIG(*) FROM dbo.Appointments a LEFT JOIN dbo.Patients p ON p.PatientID = a.PatientID WHERE p.PatientID IS NULL)),
        ('orphan_medical_records', (SELECT COUNT_BIG(*) FROM dbo.MedicalRecords mr LEFT JOIN dbo.Appointments a ON a.AppointmentID = mr.AppointmentID WHERE a.AppointmentID IS NULL)),
        ('outbox_backlog', (SELECT COUNT_BIG(*) FROM dbo.ClinicalEventOutbox WHERE Status IN ('pending', 'processing', 'failed'))),
        ('stale_outbox_locks', (SELECT COUNT_BIG(*) FROM dbo.ClinicalEventOutbox WHERE Status = 'processing' AND LockedAt < DATEADD(MINUTE, -10, SYSUTCDATETIME())))
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
