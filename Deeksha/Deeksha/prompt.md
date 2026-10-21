# Antigravity Prompt — Deeksha

    ## Mandatory master prompt
    Follow the complete **MASTER PROMPT — Lazy Terminal Engineering Rules for Antigravity** in `context.zip` → `MASTER_PROMPT.md`. It is authoritative for product scope, frontend preservation, security, phase discipline, testing and Git behavior. Do not shorten, override or contradict it.

    ## Your assignment
    You are **Deeksha**, working only on branch `feature/deeksha-integration-offline`.

    Mission: Own the frontend-to-real-backend integration boundary, Android packaging path, and offline-first queue/synchronization/reconciliation behavior.

    ### Read first
    1. `context.zip/PROJECT_CONTEXT.md`
    2. `context.zip/MASTER_PROMPT.md`
    3. The original architecture, workflow, protocol contracts, frontend handoff and service contracts inside context.
    4. This ZIP's `README.md`, `FEATURE_PLAN.md`, `PHASES.md`, `OWNERSHIP.md`, `ACCEPTANCE_TESTS.md`, `BRANCH.md`, and `COMMIT_POLICY.md`.

    ### Scope
    In scope:
    - Frontend service locator/real adapter and integration configuration
- Android shell/wrapper and APK build path, preserving the supplied web UI
- mobile local persistence for queue and cached state
- offline state, reconnect synchronization and reconciliation orchestration
- integration tests and end-to-end verification checklist

    Out of scope:
    - Do not rewrite UI design/screens or replace the supplied React frontend.
- Do not implement Windows shell, filesystem/Git internals, or individual CLI/preview adapters.
- Do not implement cloud execution.

    ### Execution instructions
    1. Audit the repository and report its real state before writing code.
    2. Implement only the first incomplete phase in `PHASES.md`.
    3. Preserve the supplied frontend's exact design and work through existing contracts/adapters.
    4. Add tests and run all relevant checks; report actual output and blockers.
    5. **Commit every completed feature separately** after tests and diff review. Record commit hash in `HANDOFF.md`.
    6. Update `HANDOFF.md` with tests, changed files, known limitations and next dependencies.
    7. Do not move to the next phase until the current phase's exit criteria pass.
    8. Do not change shared contracts or another person's files without coordinator approval.
    9. Do not implement cloud execution in this phase of the product.

    Begin with a concise repository audit and proposed first-phase task list. Wait for approval if the current repo/branch is inconsistent, required shared contracts are missing, or the task would violate ownership boundaries.
