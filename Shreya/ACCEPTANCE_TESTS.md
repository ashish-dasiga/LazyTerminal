# Acceptance Test Matrix — Shreya

These tests are mandatory unless marked environment-blocked. Record actual commands/results in `HANDOFF.md`.

## Common project gates
- [x] Inspect `git status` before/after changes; no unrelated changes.
- [x] Existing frontend visual baseline is unchanged.
- [x] `npm install` succeeds in the supplied frontend.
- [x] `npm run lint` succeeds.
- [x] `npm run build` succeeds.
- [x] Relevant unit/integration tests added and pass.
- [x] Errors, disconnected state and unsupported operations are represented honestly.
- [x] No secrets, paid-service requirements, cloud execution, or hard-coded credentials added.
- [x] All completed features have individual commits.

## Workstream-specific checks
- [x] CLI detection and capability metadata for verified Windows-supported tools
- [x] agent-specific launch adapters for installed/authenticated supported CLIs
- [x] run/debug task and process status adapter (not core terminal sessions)
- [x] one documented initial web-preview workflow and preview status/stop handling
- [x] CLI/preview integration tests and capability matrix

## Required handoff evidence
- [x] Exact test/build commands and results.
- [x] Commit hashes and branch name.
- [x] Manual reproduction steps for host/device-dependent behavior.
- [x] Known limitations and remaining tasks.
- [x] No claim of end-to-end success based solely on mocks.
