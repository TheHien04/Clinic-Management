import fs from 'fs';
import sql from 'mssql';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const bootstrapPath = path.join(repoRoot, 'Data', 'create_clinicmanagement_core_schema.sql');
const advancedPath = path.join(repoRoot, 'Data', 'create_advanced_sqlserver_analytics.sql');
const backendEnvPath = path.join(repoRoot, 'backend', '.env');

dotenv.config({ path: backendEnvPath });

const cfg = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'ClinicManagement',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
  },
};

const splitBatches = (content) => content
  .split(/^\s*GO\s*$/gim)
  .map((s) => s.trim())
  .filter(Boolean);

const runScript = async (pool, path) => {
  const content = fs.readFileSync(path, 'utf8');
  const batches = splitBatches(content);

  for (const batch of batches) {
    await pool.request().batch(batch);
  }

  return batches.length;
};

const main = async () => {
  if (!cfg.password) {
    throw new Error('DB_PASSWORD is required. Set it in environment before running db:deploy.');
  }

  const pool = await sql.connect(cfg);

  const bootstrapBatches = await runScript(pool, bootstrapPath);
  const advancedBatches = await runScript(pool, advancedPath);

  const verify = await pool.request().query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME IN (
        'Specialties',
        'Doctors',
        'Patients',
        'Appointments',
        'MedicalRecords',
        'Accounts',
        'Clinics',
        'Staff',
        'SalaryRecords',
        'DoctorSalaryRecords',
        'StaffSalaryRecords'
      )
    ORDER BY TABLE_NAME;

    SELECT name
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Appointments')
      AND name IN (
        'IX_Appointments_Doctor_Date_Time_Status',
        'IX_Appointments_Date_Status',
        'IX_Appointments_Patient_Date'
      )
    ORDER BY name;

    SELECT OBJECT_ID('dbo.sp_GetAnalyticsAppointments') AS ProcedureId,
           OBJECT_ID('dbo.vw_AnalyticsMonthlyAppointments') AS ViewId;

    SELECT COUNT(*) AS AppointmentRows FROM dbo.Appointments;
  `);

  console.log('bootstrap_batches=', bootstrapBatches);
  console.log('advanced_batches=', advancedBatches);
  console.log('tables=', verify.recordsets[0]);
  console.log('indexes=', verify.recordsets[1]);
  console.log('objects=', verify.recordsets[2]);
  console.log('appointments=', verify.recordsets[3]);

  await pool.close();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
