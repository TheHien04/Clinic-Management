# Backend SQL Migrations

This folder stores versioned SQL migrations applied by `npm run db:migrate`.

## Naming

- Use `NNN_description.sql` (e.g. `003_add_audit_table.sql`).
- Files are applied in lexicographic order.

## Safety Rules

- Never edit an already-applied migration file.
- Add a new migration for every schema/data change.
- Keep each migration idempotent when possible.

## Commands

- Apply migrations: `npm run db:migrate`
- Backward-compatible alias: `npm run db:deploy`

Applied migrations are tracked in table `dbo.SchemaMigrations` with checksum validation.
