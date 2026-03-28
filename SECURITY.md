# Security policy

## Supported versions

Security updates are applied on the active `main` branch of this repository. Older branches or tags may not receive backports.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for sensitive security findings.

1. Open a **private** security advisory via GitHub (**Security → Advisories**), or  
2. Email the repository maintainers with a clear description, reproduction steps, and impact.

Include:

- Affected component (frontend / backend / infrastructure)
- Proof of concept (if safe to share)
- Suggested fix (optional)

We aim to acknowledge reports within a few business days. This is an academic / portfolio project; response timelines are best-effort.

## Scope

In-scope: authentication flaws, authorization bypass, injection, unsafe file upload handling, secret leakage in the codebase, dependency issues with practical exploit paths.

Out-of-scope: theoretical issues without a working path, social engineering, denial-of-service requiring massive resources, reports against third-party services you do not operate.
