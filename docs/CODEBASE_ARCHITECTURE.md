# Codebase Architecture

This repository follows a pragmatic feature-oriented structure. Route files own page
orchestration; reusable UI, domain policy, persistence, and transport concerns live in
separate modules.

## Frontend boundaries

- `pages/`: route composition, data loading, and page-level state.
- `features/<feature>/`: feature-owned components, configuration, pure transforms, and tests.
- `components/`: shared cross-feature UI only.
- `services/`: HTTP and Socket.IO adapters; no rendering logic.
- `contexts/`: application-wide session and appointment state.
- `constants/` and `utils/`: stable cross-feature contracts and pure helpers.

Business rules should not be introduced directly inside JSX. New Reports and Dashboard
logic belongs under `features/reports/` or `features/dashboard/` and requires focused unit
tests before being wired into a route.

## Backend boundaries

- `routes/`: URL, authorization, validation, and rate-limit composition.
- `controllers/`: translate HTTP input/output and coordinate use cases.
- `services/`: domain rules and integration workflows such as triage scoring and the
  transactional clinical outbox relay.
- `middleware/`: cross-cutting security, audit, caching, upload, and error handling.
- `config/`: environment-backed infrastructure clients.
- `migrations/`: ordered, checksum-tracked SQL schema evolution.

SQL Server is the transactional source of truth. MongoDB is an optional privacy-minimized
clinical read model populated through the SQL outbox. Redis is an optional cache, never the
authoritative clinical store.

## Change rules

1. Preserve API and database contracts unless a versioned migration accompanies the change.
2. Keep clinical decision-support deterministic, explainable, and labelled non-diagnostic.
3. Never put secrets, refresh credentials, raw genomic payloads, or unrestricted PHI in
   browser storage, logs, fixtures, or MongoDB projections.
4. Add unit tests for pure domain logic and integration/E2E coverage for critical journeys.
5. Generated `dist`, coverage, Playwright reports, test results, and uploaded runtime files
   do not belong in source control.

## Quality gates

Run from the repository root:

```bash
npm --prefix frontend run lint
npm --prefix frontend test -- --run
npm --prefix frontend run build
npm --prefix backend run test:unit
npm run qa:e2e
npm run qa:security
```

The database-backed smoke suite additionally requires the Docker SQL Server service.
