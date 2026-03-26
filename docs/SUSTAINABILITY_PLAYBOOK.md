# Sustainability Playbook

## Objective
Keep the platform deployable, secure, and maintainable over multi-year operation.

## Support Policy
- Runtime support window: active Node LTS (current + next).
- Database support window: SQL Server long-term supported releases only.
- Dependency updates: weekly automated PR intake.
- Security threshold: critical vulnerabilities are blocking.

## Engineering Guardrails
- CI guardrails:
  - Pull request quality checks (lint, test, build, smoke).
  - Weekly compatibility checks on Node 20 and Node 22.
- Dependency lifecycle:
  - Dependabot opens weekly update PRs for root, frontend, backend, and GitHub Actions.
  - Lockfiles are tracked and reviewed with each dependency PR.
- Regression safety:
  - Integration tests for user-facing routes.
  - Unit tests for auth/security logic.
  - Smoke test for backend startup and core APIs.

## Quarterly Maintenance Cadence
- Week 1:
  - Upgrade minor/patch dependencies from Dependabot queue.
  - Refresh risk register and close resolved risks.
- Week 2:
  - Validate performance budget and accessibility thresholds.
  - Run backup/restore drill in staging.
- Week 3:
  - Review deprecations from framework release notes.
  - Plan migration tickets for any APIs marked EOL.
- Week 4:
  - Execute disaster-recovery tabletop.
  - Verify observability dashboards and alert runbooks.

## Deprecation Management
- Every deprecation warning must map to a ticket with:
  - impacted module,
  - target version,
  - migration owner,
  - due date before upstream EOL.
- No major-version adoption in production without:
  - migration checklist,
  - rollback plan,
  - release note impact review.

## Release Readiness Checklist
- Security audits: pass.
- Frontend lint/test/build: pass.
- Backend unit/smoke: pass.
- MFA and auth regressions: pass.
- Notification queue and dead-letter workflow: pass.
- Documentation updated for operational changes.

## Metrics That Indicate Sustainability
- Mean time to dependency update < 14 days.
- Critical vulnerability open time < 48 hours.
- CI success rate > 95% on main.
- Test flake rate < 2%.
- Scheduled weekly guardrail workflow success rate > 95%.
