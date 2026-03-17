import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(backendRoot, 'migrations');
const envPath = path.join(backendRoot, '.env');

dotenv.config({ path: envPath });

const config = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'ClinicManagement',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
  },
};

if (!config.password) {
  console.error('DB_PASSWORD is required for migrations.');
  process.exit(1);
}

const splitBatches = (content) => content
  .split(/^\s*GO\s*$/gim)
  .map((s) => s.trim())
  .filter(Boolean);

const checksum = (content) => crypto.createHash('sha256').update(content).digest('hex');

const getMigrationFiles = () => {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d+_.+\.sql$/i.test(name))
    .sort()
    .map((name) => path.join(migrationsDir, name));
};

const ensureMigrationTable = async (pool) => {
  await pool.request().batch(`
    IF OBJECT_ID('dbo.SchemaMigrations', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.SchemaMigrations (
        MigrationId NVARCHAR(255) NOT NULL PRIMARY KEY,
        Checksum NVARCHAR(64) NOT NULL,
        AppliedAt DATETIME2 NOT NULL DEFAULT GETDATE()
      );
    END;
  `);
};

const main = async () => {
  const pool = await sql.connect(config);

  try {
    await ensureMigrationTable(pool);

    const appliedRows = await pool.request().query('SELECT MigrationId, Checksum FROM dbo.SchemaMigrations');
    const applied = new Map(appliedRows.recordset.map((r) => [r.MigrationId, r.Checksum]));

    const files = getMigrationFiles();
    let appliedCount = 0;

    for (const filePath of files) {
      const migrationId = path.basename(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const currentChecksum = checksum(content);

      if (applied.has(migrationId)) {
        const oldChecksum = applied.get(migrationId);
        if (oldChecksum !== currentChecksum) {
          throw new Error(`Checksum mismatch for applied migration ${migrationId}.`);
        }
        console.log(`skip ${migrationId}`);
        continue;
      }

      const batches = splitBatches(content);
      for (const batch of batches) {
        await pool.request().batch(batch);
      }

      await pool
        .request()
        .input('migrationId', sql.NVarChar(255), migrationId)
        .input('checksum', sql.NVarChar(64), currentChecksum)
        .query(`
          INSERT INTO dbo.SchemaMigrations (MigrationId, Checksum)
          VALUES (@migrationId, @checksum)
        `);

      appliedCount += 1;
      console.log(`applied ${migrationId}`);
    }

    const countResult = await pool.request().query('SELECT COUNT(*) AS count FROM dbo.SchemaMigrations');
    console.log(`migration_applied_now=${appliedCount}`);
    console.log(`migration_total=${countResult.recordset[0].count}`);
  } finally {
    await pool.close();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
