# Deeksha — Feature Plan

    ## Mission
    Own the frontend-to-real-backend integration boundary, Android packaging path, and offline-first queue/synchronization/reconciliation behavior.

    ## In-scope ownership
    - Frontend service locator/real adapter and integration configuration
- Android shell/wrapper and APK build path, preserving the supplied web UI
- mobile local persistence for queue and cached state
- offline state, reconnect synchronization and reconciliation orchestration
- integration tests and end-to-end verification checklist

    ## Explicitly out of scope
    - Do not rewrite UI design/screens or replace the supplied React frontend.
- Do not implement Windows shell, filesystem/Git internals, or individual CLI/preview adapters.
- Do not implement cloud execution.

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
