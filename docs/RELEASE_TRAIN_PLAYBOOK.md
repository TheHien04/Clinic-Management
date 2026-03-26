# Release Train Playbook

## Goal
Ship predictable, low-risk releases monthly with clear rollback and verification.

## Cadence
- Week 1: dependency updates and low-risk improvements.
- Week 2: feature hardening and integration tests.
- Week 3: release candidate stabilization.
- Week 4: production release and retrospective.

## Monthly Workflow
1. Cut release branch from `main` (`release/YYYY-MM`).
2. Run `qa:release` and `qa:security` on the release branch.
3. Freeze non-critical changes after RC tag.
4. Execute final smoke checks in staging.
5. Merge release branch to `main` via protected PR.
6. Tag release (`vYYYY.MM.x`) and publish release notes.

## Rollback Checklist
1. Identify failed scope (frontend, backend, database, infra).
2. Roll back application artifact to previous stable tag.
3. If DB migration is forward-only, run contingency script.
4. Verify `/api/health`, login, appointments, and report analytics.
5. Document incident and add regression test.

## Go/No-Go Gate
- All required status checks green.
- No critical vulnerability open.
- No unresolved high-risk bug.
- On-call and owner sign-off recorded.

## Post-Release Verification
- API health status stable for 30 minutes.
- Error rate and latency within baseline.
- Notification queue/dead-letter behavior normal.
- No auth/MFA anomaly spikes.
