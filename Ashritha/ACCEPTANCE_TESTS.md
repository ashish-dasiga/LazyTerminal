# Acceptance Test Matrix — Ashritha

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
    - [x] Filesystem adapter/module and allowed-root policy
    - [x] directory listing, metadata, read/write/create/delete APIs
    - [x] file version/hash checks and external modification conflict detection
    - [x] Git status/diff/stage/unstage/commit/branch operations
    - [x] filesystem and Git tests plus module API documentation

    ## Required handoff evidence
    - [x] Exact test/build commands and results.
    - [x] Commit hashes and branch name.
    - [x] Manual reproduction steps for host/device-dependent behavior.
    - [x] Known limitations and remaining tasks.
    - [x] No claim of end-to-end success based solely on mocks.
