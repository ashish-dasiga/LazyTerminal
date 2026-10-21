# Git Branch Instructions — Ashritha

Assigned branch: `feature/ashritha-files-git`

## Initial setup
```bash
git switch main
git pull --ff-only origin main
git switch -c feature/ashritha-files-git
git status
```

If the branch already exists remotely:
```bash
git fetch origin
git switch --track origin/feature/ashritha-files-git
```

Do not create a second branch if the assigned branch already exists. Ask the coordinator if local and remote branch histories diverge.

## Working loop
```bash
git status
# implement one feature
# run feature tests and build checks
git diff --check
git add <specific-files>
git diff --cached
git commit -m "feat(<scope>): <completed feature>"
git push -u origin feature/ashritha-files-git
```

Replace `<scope>` and message with the actual completed feature. Never `git add .` blindly. Never commit secrets or generated output.

## Sync with main
Fetch `main` regularly. Coordinate before rebasing/merging. Do not force-push. Resolve conflicts only in files you own; for shared contracts, ask the coordinator.
