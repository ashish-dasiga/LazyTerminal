# Ashish — Feature Plan

    ## Mission
    Build the Windows host foundation, secure pairing lifecycle, PC-to-phone transport boundary, and real persistent terminal sessions.

    ## In-scope ownership
    - Windows companion project/bootstrap and lifecycle
- pairing secret generation/validation and connection state on host
- transport implementation and terminal stream transport
- shell/PTY process manager and process cleanup
- host-side terminal tests and developer run instructions

    ## Explicitly out of scope
    - Do not own or rewrite the React screens or shared frontend service locator.
- Do not implement filesystem, Git, CLI-specific, preview, or offline queue business logic; expose safe extension points for those modules.
- Do not add a cloud relay or cloud worker.

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
