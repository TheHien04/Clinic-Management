-- Enforce tenant integrity at the relational layer. API predicates remain a
-- defense-in-depth control; the database now rejects cross-clinic relations.

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Patients_Clinic_Required')
    ALTER TABLE dbo.Patients WITH CHECK ADD CONSTRAINT CK_Patients_Clinic_Required CHECK (ClinicID IS NOT NULL);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Doctors_Clinic_Required')
    ALTER TABLE dbo.Doctors WITH CHECK ADD CONSTRAINT CK_Doctors_Clinic_Required CHECK (ClinicID IS NOT NULL);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Appointments_Clinic_Required')
    ALTER TABLE dbo.Appointments WITH CHECK ADD CONSTRAINT CK_Appointments_Clinic_Required CHECK (ClinicID IS NOT NULL);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Accounts_Clinic_Required')
    ALTER TABLE dbo.Accounts WITH CHECK ADD CONSTRAINT CK_Accounts_Clinic_Required CHECK (ClinicID IS NOT NULL);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Patients') AND name = 'UX_Patients_ID_Clinic'
)
    CREATE UNIQUE INDEX UX_Patients_ID_Clinic ON dbo.Patients(PatientID, ClinicID);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Doctors') AND name = 'UX_Doctors_ID_Clinic'
)
    CREATE UNIQUE INDEX UX_Doctors_ID_Clinic ON dbo.Doctors(DoctorID, ClinicID);
GO

IF OBJECT_ID('dbo.FK_Appointments_Patient_Clinic', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Appointments WITH CHECK ADD CONSTRAINT FK_Appointments_Patient_Clinic
    FOREIGN KEY (PatientID, ClinicID) REFERENCES dbo.Patients(PatientID, ClinicID);
END;

IF OBJECT_ID('dbo.FK_Appointments_Doctor_Clinic', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Appointments WITH CHECK ADD CONSTRAINT FK_Appointments_Doctor_Clinic
    FOREIGN KEY (DoctorID, ClinicID) REFERENCES dbo.Doctors(DoctorID, ClinicID);
END;
GO
