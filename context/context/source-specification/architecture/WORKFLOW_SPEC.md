# Approved Workflow Diagram and Workflow Semantics

## Visual reference
`../assets/workflow_diagram.png` is the approved workflow diagram from the conversation. Treat it as the primary visual reference. Preserve it; do not redraw or replace it without user request.

## Flow semantics

```mermaid
flowchart TD
  A[Install and launch Windows EXE] --> B[Start PC communication service]
  B --> C[Generate fresh random pairing secret]
  C --> D[Display secret in PC app]
  D --> E[Wait for Android]
  F[Open Android APK] --> G[Enter current PC secret]
  G --> H[Send pairing request]
  E <--> H
  H --> I{Valid secret and reachable PC?}
  I -- No --> J[Show error and retry]
  I -- Yes --> K[Open terminal as default screen]
  K --> L[Persistent navigation: Explorer, Editor, Git, CLI, Preview, Options]
  L --> M[Run normal commands]
  L --> N[Browse/edit files]
  L --> O[Launch supported CLI in selected folder]
  L --> P[Source control]
  L --> Q[Project-aware preview]
  M --> R{PC available?}
  N --> R
  O --> R
  P --> R
  R -- Yes --> S[Execute on PC and stream results]
  R -- No --> T[Queue prompts, cached edits, and tasks]
  T --> U{Optional cloud mode enabled?}
  U -- Yes --> V[Run supported work in separate cloud workspace]
  U -- No --> W[Keep PC tasks pending]
  T --> X[PC returns]
  X --> Y[Request sync and review]
  Y --> Z[Resolve conflicts and approve]
  Z --> AA[Apply file changes and execute approved PC tasks]
  AA --> AB[Return results to Android]
  V --> AC[Review cloud changes]
  AC --> AD[Reconcile with PC when available]
```

## UI-specific correction
The connected Android screen is a mobile interface. Do not draw desktop/macOS traffic-light window controls. The terminal is the default content view, and compact navigation remains available at the top or in a persistent menu.

## Pairing-specific correction
The Windows companion generates a new random secret every time its communication service starts. The Android user must enter the current secret before the session is accepted. A sample key in a diagram is illustrative only.
