# Module 02 — Solution, Product Scope, and Boundaries

## 2.1 Proposed solution
Deliver two installable applications:
- Android APK: terminal-first mobile workspace.
- Windows EXE: PC companion and local execution engine.

The Android app sends user actions over an app-to-app communication channel. The Windows app performs PC-dependent actions and returns output, status, file data, and sync events.

## 2.2 In scope
- PC startup and pairing secret generation/display.
- Android connection screen and pairing.
- Persistent connected workspace with terminal as default.
- PowerShell/CMD commands and streamed output.
- File browsing and editing.
- Git status, diff, staging, commit, pull, push, and branch workflows where supported.
- Supported CLI detection, installation/setup assistance, launch, and provider-auth handoff.
- Project-aware preview.
- Offline queue and reconnect sync.
- Optional cloud adapter if verified as cost-safe.
- Logging, diagnostics, tests, packaging, and phase state tracking.

## 2.3 Out of scope for the first working prototype
- A localhost web dashboard.
- Mandatory cloud infrastructure.
- A guarantee that every third-party CLI can run unattended or use the same authentication.
- A guarantee that every native Windows GUI can be previewed faithfully on Android.
- Running a PC command while the PC is completely powered off.
- Bypassing provider licensing, authentication, or usage limits.
- Public internet relay infrastructure before transport and cost implications are evaluated.

## 2.4 Core product principles
1. **PC is the local execution authority.** PC files and Windows commands are executed on Windows.
2. **Phone is the interaction surface.** Mobile UI remains useful and integrated.
3. **Terminal-first.** The connected terminal is the default.
4. **Persistent navigation.** Tools are accessible without leaving the main workspace.
5. **Honest state.** Queued, running, completed, failed, cloud, and PC states must never be conflated.
6. **Cost-safe.** No mandatory paid service.
7. **Incremental delivery.** Build and verify in phases.
8. **Frontend preservation.** Integrate the supplied `.dht` code after inspecting its real format.

## 2.5 Acceptance
The implementation plan distinguishes implemented functionality from optional capabilities, platform limits, and future deployment work.
