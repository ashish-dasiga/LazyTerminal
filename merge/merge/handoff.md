# Lazy Terminal — Integration Handoff and Merge Plan

## 1. Preconditions
- All contributors have pushed their assigned branches and updated `HANDOFF.md`.
- `main` is clean and is the integration base.
- No cloud execution work is included.
- Shared frontend visual baseline is preserved.
- Shared contract changes have been approved and documented before subsystem merges.
- Every feature commit has test results and a known-limitations note.

## 2. Branches and ownership
| Contributor | Branch | Integration area |
|---|---|---|
| Ashish | `feature/ashish-host-terminal` | Windows companion, pairing/transport, terminal sessions |
| Deeksha | `feature/deeksha-integration-offline` | Real frontend adapter, Android packaging, offline queue/sync |
| Ashritha | `feature/ashritha-files-git` | Filesystem/editor and Git operations |
| Shreya | `feature/shreya-cli-preview` | CLI adapters, run/debug, preview |

The names above are the required branch names. If a repository already has a different branch naming convention, do not silently rename or create duplicates; coordinate before starting.

## 3. Before merging each branch
1. Confirm the contributor branch is pushed and up to date.
2. Read that contributor's `HANDOFF.md` and review every commit.
3. Check no secrets, `.env`, generated build artifacts, unrelated UI redesigns, or cloud feature work were introduced.
4. Run tests on the branch or CI and record results.
5. Confirm changed files match the ownership plan. Ask for a split/rework if unrelated subsystem files are mixed into the branch.

## 4. Recommended merge order
Merge incrementally in this order because it follows the dependency graph:
1. **Ashish** — host/connection/terminal foundation.
2. **Ashritha** — filesystem and Git modules using host extension points.
3. **Shreya** — CLI, run/debug and preview using host process interfaces.
4. **Deeksha** — adapter wiring, Android package and offline reconciliation after the real subsystem interfaces exist.

If the integration audit reveals Deeksha's approved additive shared-contract change is a prerequisite, land that tiny contract-only change first in `main`, have all contributors sync, then continue. Do not merge an unreviewed contract fork.

## 5. Merge commands
Run from a clean working tree. Use the actual remote name if it is not `origin`.

```bash
git switch main
git status
git pull --ff-only origin main
git branch backup/main-before-lazy-terminal-integration
git fetch origin

# Merge one branch at a time; test after each merge.
git merge --no-ff origin/feature/ashish-host-terminal
# run required checks; commit the merge if Git created a merge commit
git push origin main

git merge --no-ff origin/feature/ashritha-files-git
# run required checks
git push origin main

git merge --no-ff origin/feature/shreya-cli-preview
# run required checks
git push origin main

git merge --no-ff origin/feature/deeksha-integration-offline
# run required checks
git push origin main
```

If branch refs exist only locally, merge the corresponding local branch name instead of `origin/<branch>`. Do not push `main` unless the coordinator has authority and all checks pass. If protected branches require pull requests, open a PR instead of direct push.

## 6. Conflict prevention and resolution
- Merge one branch at a time; do not merge all four at once.
- Run `git status` before starting. Never start a merge with unrelated uncommitted changes.
- Shared files (`src/services/contracts.ts`, `src/types/relay.ts`, `src/services/index.ts`, `RelayContext.tsx`, package/config files) are the most likely conflict points. Review these deliberately.
- Prefer separate subsystem modules and adapters over multiple contributors editing the same integration file.
- If a conflict occurs: stop, inspect `git status` and conflict markers, read both implementations, preserve behavior from both sides, run tests, then `git add` resolved files and complete the merge. Do not blindly choose `ours` or `theirs`.
- Never use `git reset --hard`, force-push, or delete another contributor's work to “fix” a conflict.
- If the right resolution is unclear, abort the merge with `git merge --abort` only if no resolution work needs preserving, then ask the relevant owners to coordinate.

## 7. Verification after each merge
For the frontend:
```bash
npm install
npm run lint
npm run build
```

Run each host/backend module's documented tests from its own folder. Also verify:
- [ ] Pairing works with valid, invalid and expired secret.
- [ ] Terminal session persists working directory and streams real output.
- [ ] PC file read/write is allowlisted and stale writes are rejected.
- [ ] Git status/diff/stage/commit work in a temporary repository.
- [ ] At least one verified CLI launches in a selected workspace; unsupported tools are explicit.
- [ ] Supported preview can be started and stopped.
- [ ] Offline queue survives app restart.
- [ ] Reconnection never auto-executes queued work; user review/approval is mandatory.
- [ ] Dropped connection and host shutdown show honest status.
- [ ] APK and EXE builds/install smoke tests pass.
- [ ] Supplied frontend visual comparison shows no unintended design changes.
- [ ] No cloud execution or paid service is required.

## 8. Frontend preservation check
Use screenshots or a manual baseline comparison for the same screens and viewport sizes from the supplied frontend. Do not accept a “successful build” as proof that the UI remained unchanged. If any UI change was necessary, list it and the approved reason.

## 9. Release/merge completion
After all four merges:
1. Run full tests and builds from a clean checkout.
2. Test the APK and EXE on real supported environments.
3. Update the central `state/PROGRESS.md` and `state/DECISIONS.md` with evidence, limitations and open decisions.
4. Tag only when the coordinator approves a release.
5. Publish a final integration report listing commit hashes, tests, known issues and remaining work.

## 10. Rollback
Prefer a revert commit for an already-pushed integration. Do not rewrite shared history. Keep `backup/main-before-lazy-terminal-integration` as a local recovery reference; do not rely on it as the only backup.
