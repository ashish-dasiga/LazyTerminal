# Shreya — Feature Plan

    ## Mission
    Implement supported AI CLI discovery/launch adapters, run/debug task integration, and one explicitly supported real project preview path.

    ## In-scope ownership
    - CLI detection and capability metadata for verified Windows-supported tools
- agent-specific launch adapters for installed/authenticated supported CLIs
- run/debug task and process status adapter (not core terminal sessions)
- one documented initial web-preview workflow and preview status/stop handling
- CLI/preview integration tests and capability matrix

    ## Explicitly out of scope
    - Do not claim Antigravity has a stable CLI unless verified from official/current product evidence and tested locally.
- Do not modify shared frontend screens/service locator or the core shell manager.
- Do not implement cloud agents or cloud preview.

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
