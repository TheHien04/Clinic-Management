/**
 * Ensures the target SQL Server database exists (connects to `master` first).
 * Used by Docker entrypoint before versioned migrations.
 */
import sql from 'mssql';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendRoot, '.env') });

const dbName = process.env.DB_NAME || 'ClinicManagement';

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: 'master',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
  },
};

if (!config.password) {
  console.error('DB_PASSWORD is required.');
  process.exit(1);
}

const main = async () => {
  const pool = await sql.connect(config);
  try {
    await pool
      .request()
      .input('dbName', sql.NVarChar(128), dbName)
      .query(`
        IF DB_ID(@dbName) IS NULL
        BEGIN
          DECLARE @q NVARCHAR(MAX) = N'CREATE DATABASE ' + QUOTENAME(@dbName);
          EXEC(@q);
        END
      `);
    console.log(`ensure_database ok: ${dbName}`);
  } finally {
    await pool.close();
  }
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
