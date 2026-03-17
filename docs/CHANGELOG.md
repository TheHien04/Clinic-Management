# Changelog

All notable changes to this project are documented in this file.

## [2026-03-17] - Hardening and Ship-Ready Polish

### Added
- Production fail-fast environment validation on backend:
  - Required vars in production: `DB_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `SOCKET_CORS_ORIGIN`.
  - Strict origin parsing for Express CORS and Socket.IO CORS.
- Frontend runtime env resolver:
  - Fail-fast in production when `VITE_API_URL` is missing/invalid.
  - Deterministic socket URL resolution from env.
- Shared internationalization format helpers:
  - Number, month, date-time, and time helpers centralized in `frontend/src/utils/i18nFormat.js`.

### Changed
- Auth/session flow hardened to backend-only behavior (no mock/fake auth path).
- Route/session validation centralized via `hasValidSession()`.
- Locale/date/number formatting standardized across core pages and components.
- Setup guide updated to backend port `5055` and backend-auth-only instructions.

### Security
- Removed insecure production fallback behavior for JWT secrets.
- Removed permissive localhost fallback behavior for production API/socket configuration.

### Validation
- `npm run qa:ultimate` passed (lint, tests, build, smoke, runtime gate).
- Frontend tests remain green: `24/24`.

## [2026-03-16] - Release Stability Baseline

### Added
- Stable runtime scripts: `dev:stable:*`, `qa:release`, `qa:runtime`, `qa:ultimate`.
- Integration test coverage improvements for Appointments/MedicalRecords flows.
- Release readiness report and PR summary documents.

### Validation
- End-to-end release and runtime gates passed.
