# Acceptance Test Matrix — Ashish

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
    - [ ] Windows companion project/bootstrap and lifecycle
- [ ] pairing secret generation/validation and connection state on host
- [ ] transport implementation and terminal stream transport
- [ ] shell/PTY process manager and process cleanup
- [ ] host-side terminal tests and developer run instructions

    ## Required handoff evidence
    - [ ] Exact test/build commands and results.
    - [ ] Commit hashes and branch name.
    - [ ] Manual reproduction steps for host/device-dependent behavior.
    - [ ] Known limitations and remaining tasks.
    - [ ] No claim of end-to-end success based solely on mocks.
