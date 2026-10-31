# Testing, performance, and security runbook

This runbook describes checks that exist in the repository today. It is an
engineering quality baseline for an academic healthcare application, not a
claim of clinical validation, regulatory certification, or production approval.

## Quality gates

Run from the repository root:

```bash
npm run qa:release
npm run qa:e2e
npm run qa:security
```

- `qa:release` runs frontend ESLint, Vitest integration tests and a production
  build, then backend Vitest unit tests and the API smoke test.
- `qa:e2e` starts a temporary Vite server and runs critical Playwright browser
  flows. API calls are deterministically stubbed in these UI journeys;
  database-backed behavior belongs to the smoke and backend E2E suites.
- `qa:security` checks all three lockfiles against the npm advisory service.
- `qa:ultimate` combines release, browser, dependency and runtime gates.

The backend Supertest suite opens an ephemeral loopback listener. Run it
outside restricted sandboxes if the environment denies local `listen()` calls.

## Test layers

| Layer | Location | Purpose |
| --- | --- | --- |
| Frontend integration | `frontend/src/**/*.integration.test.jsx` | Page states, roles, actions, unavailable/empty data behavior |
| Browser critical flow | `frontend/e2e/critical-flows.e2e.js` | Login surface and protected workspace navigation |
| Backend unit/security | `backend/tests/unit/` | Validation, JWT, MFA, RBAC, CSRF/origin and rate-limit behavior |
| API/database E2E + smoke | `backend/scripts/smoke_test.mjs` | Auth, patient, appointment and advanced API flows against SQL Server |
| Load | `backend/tests/loadtest/` | k6 appointment and patient workload scenarios |

Coverage thresholds are enforced in `backend/vitest.config.js`. Coverage is a
signal, not a substitute for authorization, tenant isolation, integrity and
degraded-dependency assertions.

## Security baseline

- SQL calls use named parameters; never concatenate untrusted values into SQL.
- Access tokens are short-lived and tab-scoped in `sessionStorage`.
- Refresh tokens are `HttpOnly`, `SameSite=Strict`, cookie-only and rotated on
  successful refresh. They are never returned in JSON.
- Public registration always creates a patient role. Privileged roles require
  administrative provisioning.
- Backend routes enforce RBAC even when the frontend hides a page.
- Helmet/CSP, CORS allowlists, origin checks, optional double-submit CSRF,
  request rate limits and audit events provide defense in depth.
- SQL Server is the transactional source of truth. MongoDB contains
  privacy-minimized, FHIR-inspired read models delivered by an idempotent
  transactional outbox. Redis holds short-lived operational cache data.
- Uploads are allowlisted by extension and MIME type, size-limited, randomly
  named, authentication-protected and served with `nosniff`.

Production must provide unique JWT/database secrets and explicit HTTP and
WebSocket origin allowlists. TLS termination, central secret management,
malware scanning for uploads, external identity/MFA, backups and restore drills
are deployment responsibilities.

## Performance baseline

- Route-level lazy loading limits the initial React payload.
- Redis caches protect read-heavy operational endpoints when available.
- SQL migrations contain indexes, integrity constraints and analytics
  artifacts; validate execution plans using representative data before release.
- Long result sets use pagination, bounded cards or scroll regions. Lists above
  roughly 100 rendered rows should be virtualized.
- CI applies Lighthouse performance and accessibility thresholds to the build.

## Required release evidence

1. Commit SHA and migration checksums.
2. Passing unit, integration, E2E, smoke and dependency-audit output.
3. Database backup/restore evidence for the target environment.
4. Known-risk register and rollback owner.
5. An explicit statement that AI/risk outputs are decision support requiring
   clinical review, not diagnostic conclusions.

See `DATABASE_OPERATIONS_RUNBOOK.md`, `SECURITY_COMPLIANCE_BASELINE.md`,
`HEALTH_DATA_ARCHITECTURE.md` and `RELEASE_TRAIN_PLAYBOOK.md` for details.
