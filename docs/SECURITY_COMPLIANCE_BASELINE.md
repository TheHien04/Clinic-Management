# Security & Compliance Baseline (OWASP + GDPR)

This document maps implemented controls in the Clinic Management project to practical security/compliance baselines typically expected in international academic evaluations.

## 1. OWASP ASVS-style Control Mapping

- V2 Authentication:
  - JWT access/refresh flow with role-based checks.
  - Brute-force protection via auth/login rate limiting.
  - Security audit trail for auth-sensitive events.

- V3 Session Management:
  - Stateless token model with refresh endpoint.
  - Optional CSRF token mechanism for browser clients.

- V4 Access Control:
  - Route-level auth middleware and role checks (`authorize`).
  - Admin-only access for security audit endpoint.

- V5 Input Validation & Output Handling:
  - Email/password/phone/date validators.
  - Input sanitization utility for user-provided text.

- V7 Error Handling & Logging:
  - Centralized error handler middleware.
  - SecurityAuthAudit table for auth events (success/failure/error).
  - Retention cleanup capability for security audit records.

- V9 API Security:
  - Global API rate limiter.
  - Auth route-specific limiter and login brute-force limiter.

- V14 Configuration:
  - `.env.example` includes explicit security knobs (rate limits, strict origin check, CSRF toggle).

## 2. GDPR-oriented Baseline Mapping

- Data minimization:
  - API responses return only required fields for user identity/profile.

- Integrity and confidentiality:
  - Helmet security headers enabled.
  - Optional strict origin check for state-changing requests.

- Accountability:
  - Security audit records include event type/status, user context, source metadata, timestamp.

- Access governance:
  - Admin-only endpoint for viewing/exporting auth security logs.
  - Admin-only GDPR-style export/anonymize account controls.

## 3. Recommended Next Upgrades

- Add stricter data-subject workflow approval (dual-control for anonymize/delete).
- Add periodic backup/restore drill report with RPO/RTO evidence.
- Add CI security scanners (dependency audit + SAST).

## 4. Evidence References

- Backend security middleware:
  - `backend/src/middleware/security.js`
  - `backend/src/middleware/requestGuard.js`
  - `backend/src/middleware/csrf.js`
- Auth audit utility:
  - `backend/src/utils/securityAudit.js`
- Auth routes/controller:
  - `backend/src/routes/auth.js`
  - `backend/src/controllers/authController.js`
- Security scan workflow:
  - `.github/workflows/security-scan.yml`
- Unit tests:
  - `backend/tests/unit/middleware/security.test.js`
  - `backend/tests/unit/middleware/requestGuard.test.js`
  - `backend/tests/unit/middleware/csrf.test.js`
  - `backend/tests/unit/utils/securityAudit.test.js`
