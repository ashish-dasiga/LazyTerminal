# Feature-by-feature Git policy

Commit every completed feature before starting the next feature. Recommended format:
- `feat(host): generate short-lived pairing secret`
- `feat(terminal): stream persistent PowerShell sessions`
- `feat(sync): persist and reconcile offline intents`
- `feat(files): reject stale file writes`
- `feat(cli): detect supported coding agents`
- `feat(preview): launch supported web preview`

Before each commit:
1. `git status`
2. Run relevant tests, type checks and builds.
3. `git diff --check`
4. Review `git diff --staged` and confirm no secrets, `.env`, generated builds, unrelated files or user data are included.
5. Commit the feature and record the hash in `HANDOFF.md`.

Push your branch after each coherent milestone if access is available. Do not claim pushed/committed if the command failed.
