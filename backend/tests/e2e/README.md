# Database-backed API scenarios

Executable release scenarios live in `backend/scripts/smoke_test.mjs` and run
through `npm run test:smoke`. The smoke runner starts the API when necessary and
uses a migrated SQL Server to verify:

- public registration cannot mint a privileged role;
- privileged login and MFA completion;
- cookie-only refresh authentication;
- patient creation and deletion;
- appointment create, read, update and delete;
- analytics, staff, security posture and signed triage packages;
- signing-key rotation, compliance evidence, retention cleanup and payroll.

This directory intentionally contains no disconnected Playwright specs. Browser
critical flows are maintained in `frontend/e2e`, while database/API behavior is
owned by the smoke runner so CI has one reproducible full-stack entry point.
