import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const backupPath = process.env.DB_BACKUP_PATH || '/var/opt/mssql/backups/ClinicManagement_full.bak';
if (!/^\/var\/opt\/mssql\/[A-Za-z0-9_./-]+\.bak$/.test(backupPath)) {
  throw new Error('DB_BACKUP_PATH must be an absolute .bak path under /var/opt/mssql');
}

const database = process.env.DB_NAME || 'ClinicManagement';
if (!/^[A-Za-z0-9_]+$/.test(database)) {
  throw new Error('DB_NAME contains unsupported characters');
}

const pool = await sql.connect({
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  database: 'master',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
  },
});

try {
  await pool.request().batch(`
    BACKUP DATABASE [${database}]
    TO DISK = N'${backupPath}'
    WITH COPY_ONLY, INIT, CHECKSUM, STATS = 10;

    RESTORE VERIFYONLY
    FROM DISK = N'${backupPath}'
    WITH CHECKSUM;
  `);

  const evidence = await pool.request().query(`
    SELECT TOP (1)
      bs.database_name AS DatabaseName,
      bs.backup_start_date AS BackupStartedAt,
      bs.backup_finish_date AS BackupFinishedAt,
      bs.backup_size AS BackupBytes,
      bs.has_backup_checksums AS HasChecksum,
      bmf.physical_device_name AS BackupPath
    FROM msdb.dbo.backupset bs
    JOIN msdb.dbo.backupmediafamily bmf ON bmf.media_set_id = bs.media_set_id
    WHERE bs.database_name = '${database}' AND bs.type = 'D'
    ORDER BY bs.backup_finish_date DESC;
  `);

  console.log(JSON.stringify({ verified: true, ...evidence.recordset[0] }, null, 2));
} finally {
  await pool.close();
}
