# Four-contributor workflow

## Human ownership
Use the four existing feature branches and their ownership briefs. Keep each human responsible for their feature and handoff; custom agents assist them, they do not replace the four contributors.

## Default per-feature loop
1. Confirm branch, owner, acceptance criteria, and file boundaries.
2. Implementer reads relevant files and implements only the assigned feature.
3. Run targeted tests and typecheck for the touched module.
4. Reviewer inspects the diff and security-sensitive behavior.
5. Owner fixes findings, records test results, and commits the feature.
6. Integrator checks contracts and merges in the agreed order.

## Parallelism rules
- Parallelize independent modules only.
- One agent owns a file at a time.
- Shared protocol/API/schema changes require agreement from affected owners before implementation.
- Do not let two agents resolve the same conflict concurrently.
- Never auto-merge or auto-commit on the basis of an agent saying it is done; inspect the actual diff and test evidence.

## Short task template
Goal: <one measurable outcome>
Owner/branch: <person and branch>
Allowed paths: <explicit paths>
Relevant contracts: <paths>
Acceptance criteria: <3-7 checkable bullets>
Must not change: <shared UI, unrelated modules, etc.>
Validation: <exact commands if known>
Return: concise summary, changed files, test results, risks.
