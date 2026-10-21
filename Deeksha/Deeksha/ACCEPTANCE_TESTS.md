# Acceptance Test Matrix — Deeksha

These tests are mandatory unless marked environment-blocked. Record actual commands/results in `HANDOFF.md`.

## Common project gates
- [x] Inspect `git status` before/after changes; no unrelated changes.
- [x] Existing frontend visual baseline is unchanged.
- [x] `npm install` succeeds in the supplied frontend.
- [x] `npm run lint` succeeds (0 errors).
- [x] `npm run build` succeeds (Vite production build output generated).
- [x] Relevant unit/integration tests added and pass (11 tests pass via `npm test`).
- [x] Playwright end-to-end browser tests pass (12 tests pass via `npm run test:e2e`).
- [x] Errors, disconnected state and unsupported operations are represented honestly.
- [x] No secrets, paid-service requirements, cloud execution, or hard-coded credentials added.
- [ ] All completed features have individual commits (Pending user approval).

## Workstream-specific checks
- [x] Frontend service locator/real adapter and integration configuration (`config.ts`, `apiClient.ts`, `realAdapter.ts`, `index.ts`)
- [x] Android shell/wrapper and APK build path, preserving the supplied web UI (`capacitor.config.ts`, `docs/ANDROID_BUILD.md`)
- [x] mobile local persistence for queue and cached state (`offlineQueue.ts` via IndexedDB)
- [x] offline state, reconnect synchronization and reconciliation orchestration (`connectionMonitor.ts`, `RelayContext.tsx`)
- [x] integration tests and end-to-end verification checklist (`src/tests/adapter.test.ts`, `src/tests/offlineQueue.test.ts`, `e2e/lazy-terminal.spec.ts`)

## Required handoff evidence
- [x] Exact test/build commands and results recorded in `HANDOFF.md`.
- [x] Manual reproduction steps for host/device-dependent behavior.
- [x] Known limitations and remaining tasks documented.
- [x] Verified in real browser with Playwright: pairing, terminal execution, offline buffering, reconnect reconciliation, and responsive mobile/laptop layouts.
