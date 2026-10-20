# Lazy Terminal — Shared Agent Contract

## Mission
Build Lazy Terminal: a mobile-first, local-first Android + Windows PC development companion. The Android app connects to a Windows host companion for real filesystem, terminal, Git, supported coding-agent, run/debug, and web-preview operations.

## Product invariants — never violate
1. Preserve the supplied frontend exactly: visual design, layout, navigation, branding, and interaction patterns are not to be redesigned. Replace mock behavior through adapters/services; only make UI changes when explicitly required to connect real functionality or fix a proven defect.
2. Initial release is LAN-first and local-first. Do not add cloud execution, mandatory paid infrastructure, or remote relay services to MVP.
3. Windows PC companion performs PC-dependent operations. Never pretend a mock is a real terminal, Git operation, filesystem operation, CLI launch, or preview.
4. Offline mode may queue eligible drafts/actions and display last-synced data as stale. Never auto-execute queued commands/actions on reconnect. Require explicit user review and approval before execution.
5. Treat terminal commands, paths, Git operations, pairing, tokens, and agent launches as security-sensitive. Validate inputs, constrain paths to authorized roots, avoid shell-string interpolation, redact secrets, and require approval for dangerous commands.
6. No paid service is mandatory. Target ₹0 for the MVP; document optional costs rather than introducing them silently.
7. Do not claim a feature is complete unless code, tests, and acceptance evidence support it.

## Work protocol
- Read this file and the relevant feature brief first. Do not scan the whole repo by default.
- Start with `git status --short` and inspect the assigned files plus directly related contracts/tests.
- Follow the task's assigned ownership and branch. Do not edit another contributor's owned files or shared contracts without coordination.
- Before coding, state a short plan (max 5 bullets). Ask only if a blocking ambiguity affects architecture, security, or acceptance criteria; otherwise use the least-surprising compatible implementation and record assumptions.
- Reuse existing dependencies, patterns, components, and adapters. Do not add a dependency unless a clear requirement cannot be met reasonably without it.
- Keep changes minimal and scoped. Avoid unrelated refactors, formatting churn, generated-file churn, and speculative abstractions.
- Do not duplicate research already in project docs. Search targeted filenames/symbols first. Summarize findings as decisions and links/paths, not long essays.
- Make interfaces explicit and stable. If a contract must change, update its documentation and tests in the same change and notify affected owners.
- Add/update focused tests for changed behavior. Run the smallest relevant test first, then typecheck/lint/build when feasible. Report commands and actual results honestly.
- Never commit unless the task explicitly asks. Never force-push, rewrite shared history, delete user data, or change secrets/configuration without approval.
- End every task with: files changed; implementation summary; tests run and results; known gaps/risks; commit hash only if a commit actually exists.

## Token and tool efficiency
- Prefer `flash` for bounded test execution, routine checks, simple reviews, and mechanical tasks; use `inherit` for normal implementation; use `pro` for high-impact architecture/security decisions or genuinely ambiguous cross-module work.
- Use one focused researcher/planner for a question; do not spawn multiple agents to answer the same question.
- Delegate only tasks that are parallelizable, bounded, and have clear file ownership. Do not spawn agents for tiny changes or tasks with tightly coupled edits.
- Subagents start without the parent conversation. Give each one a compact task brief containing goal, relevant paths, constraints, expected output, and stop condition. Do not paste the entire conversation/repository context.
- Read only relevant files. Use targeted search, summaries, and diffs; avoid repeatedly printing entire files, lockfiles, build logs, or generated output.
- Ask agents for concise findings (default ≤10 bullets) and no broad codebase recap. Report only failures or a one-line pass for routine checks.
- Do not re-run a successful test suite unless code changed after it or evidence is suspect. Avoid repeated broad builds during implementation; run them at the integration gate.
- Prefer deterministic scripts and existing test tooling over asking a model to manually inspect repetitive output.

## Completion gate
A feature is complete only when: acceptance criteria are checked; relevant tests pass or failures are clearly reported; no mock is misrepresented as real functionality; security-sensitive paths are reviewed; the diff is scoped; and the handoff is concise.
