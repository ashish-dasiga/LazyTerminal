# System Architecture Reference

The canonical architecture specification is in `../modules/05_SYSTEM_ARCHITECTURE.md`. This file is a compact map for quick reading.

```mermaid
flowchart LR
  subgraph A[Android APK]
    UI[Terminal-first workspace]
    NAV[Persistent navigation]
    DB[Local cache + task queue]
    UI --- NAV
    UI --- DB
  end
  subgraph X[App-to-app transport]
    PAIR[Pairing and session]
    STREAM[Requests, output streams, events]
  end
  subgraph W[Windows EXE]
    SERVICE[Background communication component]
    SECRET[Fresh random secret on service startup]
    SHELL[PowerShell/CMD]
    FS[PC filesystem adapter]
    GIT[Git adapter]
    CLI[CLI adapters]
    PREVIEW[Preview/output adapter]
    SYNC[Sync and task processor]
    SERVICE --> SECRET
    SERVICE --> SHELL
    SERVICE --> FS
    SERVICE --> GIT
    SERVICE --> CLI
    SERVICE --> PREVIEW
    SERVICE --> SYNC
  end
  UI <--> PAIR
  PAIR <--> SERVICE
  STREAM <--> SERVICE
  DB <--> SYNC
  UI -. optional, configured only .-> CLOUD[Cloud workspace adapter]
```

## Key boundaries
- The Android app is not a Windows command executor.
- The Windows app owns PC command and file execution.
- Cloud execution, if available, is a separate adapter/environment.
- Offline queueing is not execution.
- No browser-hosted localhost dashboard is part of the product.
- Communication transport is a documented decision, not an assumed framework.
