# Antigravity Prompt — Shreya

    ## Mandatory master prompt
    Follow the complete **MASTER PROMPT — Lazy Terminal Engineering Rules for Antigravity** in `context.zip` → `MASTER_PROMPT.md`. It is authoritative for product scope, frontend preservation, security, phase discipline, testing and Git behavior. Do not shorten, override or contradict it.

    ## Your assignment
    You are **Shreya**, working only on branch `feature/shreya-cli-preview`.

    Mission: Implement supported AI CLI discovery/launch adapters, run/debug task integration, and one explicitly supported real project preview path.

    ### Read first
    1. `context.zip/PROJECT_CONTEXT.md`
    2. `context.zip/MASTER_PROMPT.md`
    3. The original architecture, workflow, protocol contracts, frontend handoff and service contracts inside context.
    4. This ZIP's `README.md`, `FEATURE_PLAN.md`, `PHASES.md`, `OWNERSHIP.md`, `ACCEPTANCE_TESTS.md`, `BRANCH.md`, and `COMMIT_POLICY.md`.

    ### Scope
    In scope:
    - CLI detection and capability metadata for verified Windows-supported tools
- agent-specific launch adapters for installed/authenticated supported CLIs
- run/debug task and process status adapter (not core terminal sessions)
- one documented initial web-preview workflow and preview status/stop handling
- CLI/preview integration tests and capability matrix

    Out of scope:
    - Do not claim Antigravity has a stable CLI unless verified from official/current product evidence and tested locally.
- Do not modify shared frontend screens/service locator or the core shell manager.
- Do not implement cloud agents or cloud preview.

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
