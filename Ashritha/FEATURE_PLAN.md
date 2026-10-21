# Ashritha — Feature Plan

    ## Mission
    Implement safe PC filesystem operations, editor read/write support and Git source-control operations as an isolated host-side module.

    ## In-scope ownership
    - Filesystem adapter/module and allowed-root policy
- directory listing, metadata, read/write/create/delete APIs
- file version/hash checks and external modification conflict detection
- Git status/diff/stage/unstage/commit/branch operations
- filesystem and Git tests plus module API documentation

    ## Explicitly out of scope
    - Do not modify mobile UI or service locator/integration wiring.
- Do not implement terminal process manager, pairing transport, CLI installation/launch, or preview.
- Do not run destructive Git/filesystem operations without explicit user intent and backend validation.

    ## Cross-team dependencies
    - Consume existing contracts wherever possible; do not silently redefine them.
    - Ashish provides host/terminal/connection primitives.
    - Deeksha owns frontend adapter wiring, Android packaging and offline reconciliation.
    - Ashritha provides filesystem/Git modules.
    - Shreya provides CLI/run-debug/preview modules.
    - Dependencies must be expressed through documented interfaces and test fixtures, not by editing another contributor's files.
    - All work is local-first. Cloud execution is deferred.

    ## Feature delivery rule
    Complete, test, document and commit each feature before moving to the next. Keep changes small enough for review.
