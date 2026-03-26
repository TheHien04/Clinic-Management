# Branch Protection Setup (main)

This repository should enforce branch protection on `main` to keep quality and security stable over time.

## Required Rules
- Require pull request before merging.
- Require approvals: at least 1.
- Dismiss stale approvals when new commits are pushed.
- Require review from Code Owners.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Restrict force pushes and deletions.

## Required Status Checks
Use exact workflow job names after first successful run:
- Backend CI / frontend-quality
- Backend CI / frontend-audit
- Backend CI / smoke
- Security Scan / npm-audit
- Sustainability Weekly Guardrails / frontend-compatibility (Node 20)
- Sustainability Weekly Guardrails / frontend-compatibility (Node 22)
- Sustainability Weekly Guardrails / backend-compatibility (Node 20)
- Sustainability Weekly Guardrails / backend-compatibility (Node 22)
- Sustainability Weekly Guardrails / dependency-audit

## Merge Strategy
- Enable squash merge.
- Disable merge commits if linear history is desired.
- Delete head branches after merge.

## Operational Policy
- Hotfixes still go through PR with at least one reviewer.
- Emergency bypass requires incident ticket and postmortem action item.
