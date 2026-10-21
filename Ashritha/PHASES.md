# Ordered Phases and Exit Criteria

## R1 — Contract and threat-model audit

**Build:** Read existing filesystem/Git contracts and frontend usage. Document Windows path rules, allowed workspace roots, symlink/reparse-point risks, file size limits and operation semantics.

**Exit criteria:** API mapping and threat model approved; no broad unrestricted filesystem access.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## R2 — Filesystem read/list

**Build:** Implement allowlisted directory listing, metadata, path normalization, traversal rejection, text/binary detection, bounded reads and useful errors.

**Exit criteria:** Tests cover traversal, absolute/relative paths, missing files, permissions, large files and binary files.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## R3 — Safe edits and file lifecycle

**Build:** Implement write/create/delete where contract allows, expected-version/hash checks, atomic writes where possible, and conflict errors if a file changed since read. Enforce explicit confirmation for delete.

**Exit criteria:** Round-trip tests pass; stale write is rejected; path escape is blocked; no silent overwrite.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## R4 — Git read and diff

**Build:** Implement repository discovery within allowed roots, status, branch, diff and changed-file mapping using safe process invocation and bounded output.

**Exit criteria:** Tests cover clean/dirty repos, untracked files, staged/unstaged changes, non-repository paths and command errors.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## R5 — Git actions and handoff

**Build:** Implement stage/unstage/commit/branch actions supported by current contracts. Validate arguments; never silently force push/reset/clean. Document push/pull limitations and tests.

**Exit criteria:** Git operations tested in temporary repositories; destructive operations gated; module contract and integration examples ready.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.
