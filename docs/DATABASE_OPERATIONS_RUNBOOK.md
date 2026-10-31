# Database operations runbook

This runbook turns backup, recovery, integrity, and performance claims into repeatable evidence. It targets the Docker development stack; production should write encrypted backups to independent object storage with managed keys and retention policies.

## Verified full backup

Run inside the backend container so credentials are not copied into the shell history:

```bash
docker compose -f docker-compose.yml -f docker-compose.apple.yml exec -T backend npm run db:backup
```

The command creates a SQL Server `COPY_ONLY` full backup, enables page checksums, immediately runs `RESTORE VERIFYONLY`, and prints the corresponding `msdb` backup-history row. The default artifact is stored in the dedicated shared backup volume at `/var/opt/mssql/backups/ClinicManagement_full.bak`.

`RESTORE VERIFYONLY` validates readability and backup structure; it is not a substitute for a scheduled restore drill.

## Restore drill

Use an isolated SQL Server instance. Never overwrite the active database during a drill.

```sql
RESTORE FILELISTONLY
FROM DISK = N'/var/opt/mssql/data/ClinicManagement_full.bak';

RESTORE DATABASE ClinicManagement_RestoreDrill
FROM DISK = N'/var/opt/mssql/data/ClinicManagement_full.bak'
WITH MOVE N'ClinicManagement' TO N'/var/opt/mssql/data/ClinicManagement_RestoreDrill.mdf',
     MOVE N'ClinicManagement_log' TO N'/var/opt/mssql/data/ClinicManagement_RestoreDrill_log.ldf',
     RECOVERY, CHECKSUM;

DBCC CHECKDB (ClinicManagement_RestoreDrill) WITH NO_INFOMSGS;
```

Record the recovery point, elapsed recovery time, `DBCC CHECKDB` result, and operator in the release evidence. Delete the drill database only after evidence has been retained.

## Integrity and performance evidence

Execute `Data/verify_health_data_integrity.sql`. Passing criteria:

- orphan appointments, orphan records, invalid ICD codes, invalid consent JSON, and outbox backlog are all zero;
- `Patients` reports `SYSTEM_VERSIONED_TEMPORAL_TABLE`;
- all eleven migrations appear with SHA-256 checksums;
- `sp_GetPatientDirectory` returns no more than the requested page size and exposes `TotalRows`;
- the captured `STATISTICS IO/TIME` output is attached to the database report.

## Concurrency behavior

Every patient row carries a SQL Server `ROWVERSION`. The API returns it as `RecordVersion`; updates send it back. A stale writer receives HTTP `409 Conflict` instead of silently overwriting a newer change.
