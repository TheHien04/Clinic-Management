# Release Readiness Report (2026-03-16)

## Scope

This report captures the latest local quality and runtime validation for the Clinic Management workspace.

## Quality Gates

- Frontend lint: PASS (`frontend`, `npm run lint`)
- Frontend tests: PASS (`frontend`, `npm run test -- --run`)
- Frontend build: PASS (`frontend`, `npm run build`)
- Backend smoke: PASS (`backend`, `npm run test:smoke`)

## Runtime Stability

- Stable background stack startup: PASS (`npm run dev:stable:keep`)
- Health endpoints: PASS (`npm run dev:stable:health`)
- Process and port status: PASS (`npm run dev:stable:status`, `npm run dev:ports`)
- Verified ports:
  - Frontend: `5173` LISTEN
  - Backend: `5055` LISTEN

## Known Notes

- Running root `npm run dev:stable` in foreground is expected to return non-zero if terminal/session is interrupted.
- For stable day-to-day validation, prefer:
  - `npm run dev:stable:keep`
  - `npm run dev:stable:health`
  - `npm run dev:stable:status`
  - `npm run dev:stable:stop`

## Open Risks

- Authentication-protected APIs can return `401` in browser without login; this is expected and does not indicate backend boot failure.
- Some frontend integration tests intentionally log fallback warnings when API mocks simulate unavailable backend.

## Recommended Merge Gate

Single command from repository root:

```bash
npm run qa:release
```

Full end-to-end gate (quality + runtime):

```bash
npm run qa:ultimate
```

Runtime stability gate from repository root:

```bash
npm run qa:runtime
```

Equivalent expanded sequence:

Use this command sequence before merge:

```bash
cd frontend
npm run lint
npm run test -- --run
npm run build

cd ../backend
npm run test:smoke
```

Optional stable runtime gate from repository root:

```bash
npm run dev:stable:keep
npm run dev:stable:health
npm run dev:stable:status
npm run dev:stable:stop
```
