# Acceptance Test Matrix — Ashritha

    These tests are mandatory unless marked environment-blocked. Record actual commands/results in `HANDOFF.md`.

    ## Common project gates
    - [ ] Inspect `git status` before/after changes; no unrelated changes.
    - [ ] Existing frontend visual baseline is unchanged.
    - [ ] `npm install` succeeds in the supplied frontend.
    - [ ] `npm run lint` succeeds.
    - [ ] `npm run build` succeeds.
    - [ ] Relevant unit/integration tests added and pass.
    - [ ] Errors, disconnected state and unsupported operations are represented honestly.
    - [ ] No secrets, paid-service requirements, cloud execution, or hard-coded credentials added.
    - [ ] All completed features have individual commits.

    ## Workstream-specific checks
    - [ ] Filesystem adapter/module and allowed-root policy
- [ ] directory listing, metadata, read/write/create/delete APIs
- [ ] file version/hash checks and external modification conflict detection
- [ ] Git status/diff/stage/unstage/commit/branch operations
- [ ] filesystem and Git tests plus module API documentation

    ## Required handoff evidence
    - [ ] Exact test/build commands and results.
    - [ ] Commit hashes and branch name.
    - [ ] Manual reproduction steps for host/device-dependent behavior.
    - [ ] Known limitations and remaining tasks.
    - [ ] No claim of end-to-end success based solely on mocks.
