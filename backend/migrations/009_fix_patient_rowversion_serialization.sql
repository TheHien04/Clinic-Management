-- Preserve migration immutability: correct the SQL Edge rowversion rendering
-- in a forward-only migration instead of editing migration 008.

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
    CONVERT(VARCHAR(18), sys.fn_varbintohexstr(p.RowVersion)) AS RecordVersion,
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
