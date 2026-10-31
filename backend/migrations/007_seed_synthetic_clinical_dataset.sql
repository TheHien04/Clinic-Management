-- Deterministic, synthetic hospital dataset for analytics and product demos.
-- No row represents a real person. The version marker makes this migration idempotent.

IF NOT EXISTS (SELECT 1 FROM dbo.SyntheticDatasetRuns WHERE DatasetVersion = 'health-synthetic-v1')
BEGIN
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    DECLARE @ClinicID INT = (SELECT TOP (1) ClinicID FROM dbo.Clinics ORDER BY ClinicID);

    MERGE dbo.Specialties AS target
    USING (VALUES
        ('Pediatrics'), ('Neurology'), ('Endocrinology'), ('Orthopedics'),
        ('Oncology'), ('Psychiatry'), ('Ophthalmology'), ('Gastroenterology'),
        ('Pulmonology'), ('Nephrology')
    ) AS source(SpecialtyName)
    ON target.SpecialtyName = source.SpecialtyName
    WHEN NOT MATCHED THEN INSERT (SpecialtyName) VALUES (source.SpecialtyName);

    ;WITH DoctorSeed AS (
        SELECT * FROM (VALUES
            ('SYN-DOC-001', 'Dr. Synthetic Minh Tran', 'Cardiology', 'synthetic.doctor.001@demo.clinic', '0919000001', 14),
            ('SYN-DOC-002', 'Dr. Synthetic Linh Nguyen', 'Endocrinology', 'synthetic.doctor.002@demo.clinic', '0919000002', 11),
            ('SYN-DOC-003', 'Dr. Synthetic An Le', 'Pediatrics', 'synthetic.doctor.003@demo.clinic', '0919000003', 9),
            ('SYN-DOC-004', 'Dr. Synthetic Vy Pham', 'Neurology', 'synthetic.doctor.004@demo.clinic', '0919000004', 16),
            ('SYN-DOC-005', 'Dr. Synthetic Khoa Hoang', 'Orthopedics', 'synthetic.doctor.005@demo.clinic', '0919000005', 12),
            ('SYN-DOC-006', 'Dr. Synthetic Mai Vu', 'Dermatology', 'synthetic.doctor.006@demo.clinic', '0919000006', 8),
            ('SYN-DOC-007', 'Dr. Synthetic Nam Do', 'Gastroenterology', 'synthetic.doctor.007@demo.clinic', '0919000007', 15),
            ('SYN-DOC-008', 'Dr. Synthetic Nhi Bui', 'Pulmonology', 'synthetic.doctor.008@demo.clinic', '0919000008', 10),
            ('SYN-DOC-009', 'Dr. Synthetic Son Dang', 'Nephrology', 'synthetic.doctor.009@demo.clinic', '0919000009', 13),
            ('SYN-DOC-010', 'Dr. Synthetic Yen Truong', 'Psychiatry', 'synthetic.doctor.010@demo.clinic', '0919000010', 7),
            ('SYN-DOC-011', 'Dr. Synthetic Long Ly', 'ENT', 'synthetic.doctor.011@demo.clinic', '0919000011', 18),
            ('SYN-DOC-012', 'Dr. Synthetic Ha Vo', 'General Medicine', 'synthetic.doctor.012@demo.clinic', '0919000012', 20)
        ) v(SyntheticKey, FullName, SpecialtyName, Email, PhoneNumber, Experience)
    )
    INSERT INTO dbo.Doctors (SyntheticKey, FullName, SpecialtyID, ClinicID, Status, PhoneNumber, Email, Qualifications, Experience)
    SELECT ds.SyntheticKey, ds.FullName, s.SpecialtyID, @ClinicID,
           CASE WHEN ds.SyntheticKey = 'SYN-DOC-010' THEN 'on-leave' ELSE 'active' END,
           ds.PhoneNumber, ds.Email, 'Board certified; synthetic training profile', ds.Experience
    FROM DoctorSeed ds
    JOIN dbo.Specialties s ON s.SpecialtyName = ds.SpecialtyName
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Doctors d WHERE d.SyntheticKey = ds.SyntheticKey);

    ;WITH n AS (
        SELECT TOP (240) ROW_NUMBER() OVER (ORDER BY a.object_id, b.object_id) AS n
        FROM sys.all_objects a CROSS JOIN sys.all_objects b
    )
    INSERT INTO dbo.Patients (
        SyntheticKey, ClinicID, FullName, DateOfBirth, Gender, PhoneNumber,
        Email, Address, MedicalHistory, CreatedDate
    )
    SELECT
        CONCAT('SYN-PAT-', RIGHT(CONCAT('000', n), 3)),
        @ClinicID,
        CONCAT('Synthetic Patient ', RIGHT(CONCAT('000', n), 3)),
        DATEADD(DAY, -((n * 97) % 26000 + 365), CAST(GETDATE() AS DATE)),
        CASE n % 4 WHEN 0 THEN 'Female' WHEN 1 THEN 'Male' WHEN 2 THEN 'Female' ELSE 'Non-binary' END,
        CONCAT('0988', RIGHT(CONCAT('000000', n), 6)),
        CONCAT('synthetic.patient.', RIGHT(CONCAT('000', n), 3), '@demo.clinic'),
        CONCAT('Synthetic District ', (n % 12) + 1, ', Ho Chi Minh City'),
        CASE n % 10
            WHEN 0 THEN 'Hypertension; ongoing monitoring'
            WHEN 1 THEN 'Type 2 diabetes; lifestyle and medication review'
            WHEN 2 THEN 'Asthma; seasonal symptoms'
            WHEN 3 THEN 'Chronic kidney disease stage 2'
            WHEN 4 THEN 'Migraine; episodic'
            WHEN 5 THEN 'GERD; dietary management'
            WHEN 6 THEN 'Generalized anxiety; care plan active'
            WHEN 7 THEN 'Low back pain; physiotherapy pathway'
            ELSE 'No chronic condition recorded'
        END,
        DATEADD(DAY, -((n * 17) % 365), SYSUTCDATETIME())
    FROM n
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.Patients p
        WHERE p.SyntheticKey = CONCAT('SYN-PAT-', RIGHT(CONCAT('000', n), 3))
    );

    ;WITH PatientRows AS (
        SELECT PatientID, SyntheticKey,
               ROW_NUMBER() OVER (ORDER BY SyntheticKey) AS n
        FROM dbo.Patients
        WHERE SyntheticKey LIKE 'SYN-PAT-%'
    ),
    DoctorRows AS (
        SELECT DoctorID, ROW_NUMBER() OVER (ORDER BY SyntheticKey) AS rn
        FROM dbo.Doctors WHERE SyntheticKey LIKE 'SYN-DOC-%'
    ),
    VisitNumbers AS (
        SELECT visitNo FROM (VALUES (1), (2), (3), (4), (5), (6)) v(visitNo)
    )
    INSERT INTO dbo.Appointments (
        SyntheticKey, ClinicID, PatientID, DoctorID, AppointmentDate,
        AppointmentTime, Status, Notes, CreatedDate
    )
    SELECT
        CONCAT(p.SyntheticKey, '-VIS-', v.visitNo),
        @ClinicID,
        p.PatientID,
        d.DoctorID,
        dates.AppointmentDate,
        TIMEFROMPARTS(8 + ((p.n + v.visitNo) % 9), ((p.n * 7 + v.visitNo * 5) % 4) * 15, 0, 0, 0),
        CASE
            WHEN v.visitNo = 6 THEN CASE WHEN p.n % 3 = 0 THEN 'pending' ELSE 'confirmed' END
            WHEN (p.n * 11 + v.visitNo * 7) % 100 < 74 THEN 'completed'
            WHEN (p.n * 11 + v.visitNo * 7) % 100 < 86 THEN 'cancelled'
            WHEN (p.n * 11 + v.visitNo * 7) % 100 < 94 THEN 'checked-in'
            ELSE 'confirmed'
        END,
        CASE p.n % 6
            WHEN 0 THEN 'Synthetic chronic-care follow-up'
            WHEN 1 THEN 'Synthetic preventive screening'
            WHEN 2 THEN 'Synthetic medication review'
            WHEN 3 THEN 'Synthetic specialist consultation'
            WHEN 4 THEN 'Synthetic diagnostic follow-up'
            ELSE 'Synthetic routine review'
        END,
        DATEADD(DAY, -7, CAST(dates.AppointmentDate AS DATETIME2))
    FROM PatientRows p
    CROSS JOIN VisitNumbers v
    JOIN DoctorRows d ON d.rn = ((p.n + v.visitNo - 2) % 12) + 1
    CROSS APPLY (
        SELECT CASE
            WHEN v.visitNo = 6 THEN DATEADD(DAY, (p.n % 45) + 1, CAST(GETDATE() AS DATE))
            ELSE DATEADD(DAY, -(((p.n * 13 + v.visitNo * 31) % 330) + 7), CAST(GETDATE() AS DATE))
        END AS AppointmentDate
    ) dates
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.Appointments a
        WHERE a.SyntheticKey = CONCAT(p.SyntheticKey, '-VIS-', v.visitNo)
    );

    ;WITH CompletedVisits AS (
        SELECT a.AppointmentID, a.PatientID, a.AppointmentDate, a.SyntheticKey,
               ABS(CHECKSUM(a.SyntheticKey)) % 12 AS DiagnosisIndex
        FROM dbo.Appointments a
        WHERE a.SyntheticKey LIKE 'SYN-PAT-%-VIS-%' AND LOWER(a.Status) = 'completed'
    )
    INSERT INTO dbo.MedicalRecords (
        SyntheticKey, AppointmentID, DiagnosisCode, Prescription, Notes, FollowUpDate, CreatedDate
    )
    SELECT
        CONCAT(v.SyntheticKey, '-REC'),
        v.AppointmentID,
        codes.Code,
        CASE codes.Code
            WHEN 'I10' THEN 'Synthetic care plan: blood-pressure review'
            WHEN 'E11.9' THEN 'Synthetic care plan: glucose monitoring'
            WHEN 'J45.9' THEN 'Synthetic care plan: inhaler technique review'
            ELSE 'Synthetic treatment plan documented'
        END,
        CONCAT('Synthetic encounter record; terminology group: ', codes.ClinicalGroup, '. Not for clinical use.'),
        DATEADD(DAY, 30 + (v.DiagnosisIndex * 3), v.AppointmentDate),
        DATEADD(HOUR, 2, CAST(v.AppointmentDate AS DATETIME2))
    FROM CompletedVisits v
    JOIN (
        SELECT Code, ClinicalGroup, ROW_NUMBER() OVER (ORDER BY Code) - 1 AS rn
        FROM dbo.ClinicalTerminologyCodes WHERE CodeSystem = 'ICD-10' AND IsActive = 1
    ) codes ON codes.rn = v.DiagnosisIndex
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.MedicalRecords mr WHERE mr.SyntheticKey = CONCAT(v.SyntheticKey, '-REC')
    );

    INSERT INTO dbo.PatientConsents (PatientID, ClinicID, ConsentType, Status, ScopeJson, EffectiveAt, Version)
    SELECT p.PatientID, @ClinicID, t.ConsentType,
           CASE WHEN t.ConsentType = 'research' AND p.PatientID % 5 = 0 THEN 'denied' ELSE 'granted' END,
           CONCAT('{"dataset":"synthetic","scope":"', t.ConsentType, '"}'),
           DATEADD(DAY, -((p.PatientID * 7) % 180), SYSUTCDATETIME()), 1
    FROM dbo.Patients p
    CROSS JOIN (VALUES ('care'), ('analytics'), ('research')) t(ConsentType)
    WHERE p.SyntheticKey LIKE 'SYN-PAT-%'
      AND NOT EXISTS (
          SELECT 1 FROM dbo.PatientConsents pc
          WHERE pc.PatientID = p.PatientID AND pc.ConsentType = t.ConsentType
      );

    INSERT INTO dbo.PatientConsents (PatientID, ClinicID, ConsentType, Status, ScopeJson, EffectiveAt, Version)
    SELECT TOP (40) p.PatientID, @ClinicID, 'genomics', 'granted',
           '{"dataset":"synthetic","scope":"metadata-and-derived-variants"}',
           DATEADD(DAY, -(p.PatientID % 120), SYSUTCDATETIME()), 1
    FROM dbo.Patients p
    WHERE p.SyntheticKey LIKE 'SYN-PAT-%'
      AND NOT EXISTS (SELECT 1 FROM dbo.PatientConsents pc WHERE pc.PatientID = p.PatientID AND pc.ConsentType = 'genomics')
    ORDER BY p.SyntheticKey;

    INSERT INTO dbo.MolecularProfileRegistry (
        SyntheticKey, PatientID, ClinicID, ConsentID, AssayType, GenomeBuild,
        SpecimenType, SourceFormat, ChecksumSha256, VariantCount,
        InterpretationStatus, CollectedAt
    )
    SELECT
        CONCAT('SYN-MOL-', RIGHT(CONCAT('000', ROW_NUMBER() OVER (ORDER BY pc.PatientID)), 3)),
        pc.PatientID, @ClinicID, pc.ConsentID,
        CASE pc.PatientID % 3 WHEN 0 THEN 'Targeted cancer panel' WHEN 1 THEN 'Pharmacogenomics panel' ELSE 'Whole exome sequencing' END,
        CASE pc.PatientID % 2 WHEN 0 THEN 'GRCh38' ELSE 'GRCh37' END,
        CASE pc.PatientID % 3 WHEN 0 THEN 'FFPE tissue' WHEN 1 THEN 'Whole blood' ELSE 'Saliva' END,
        'VCF',
        CONVERT(CHAR(64), HASHBYTES('SHA2_256', CONCAT('synthetic-molecular-profile-', pc.PatientID)), 2),
        80 + ((pc.PatientID * 137) % 4200),
        CASE pc.PatientID % 4 WHEN 0 THEN 'reviewed' WHEN 1 THEN 'interpreted' ELSE 'quality-checked' END,
        DATEADD(DAY, -(pc.PatientID % 90), SYSUTCDATETIME())
    FROM dbo.PatientConsents pc
    WHERE pc.ConsentType = 'genomics' AND pc.Status = 'granted'
      AND NOT EXISTS (
          SELECT 1 FROM dbo.MolecularProfileRegistry mp WHERE mp.PatientID = pc.PatientID
      );

    DECLARE @PatientRows INT = (SELECT COUNT(*) FROM dbo.Patients WHERE SyntheticKey LIKE 'SYN-PAT-%');
    DECLARE @AppointmentRows INT = (SELECT COUNT(*) FROM dbo.Appointments WHERE SyntheticKey LIKE 'SYN-PAT-%-VIS-%');
    DECLARE @MedicalRecordRows INT = (SELECT COUNT(*) FROM dbo.MedicalRecords WHERE SyntheticKey LIKE 'SYN-PAT-%-VIS-%-REC');

    INSERT INTO dbo.SyntheticDatasetRuns (DatasetVersion, Description, PatientRows, AppointmentRows, MedicalRecordRows)
    VALUES (
        'health-synthetic-v1',
        'Deterministic synthetic hospital operations dataset. No real-person or production PHI.',
        @PatientRows, @AppointmentRows, @MedicalRecordRows
    );

    COMMIT TRANSACTION;
END;
GO
