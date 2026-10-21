# Module 11 — Project-Aware Preview System

## 11.1 Problem
Android cannot natively run every Windows application or desktop GUI. A universal “convert project to HTML” strategy would misrepresent many programs.

## 11.2 Solution
Build a preview subsystem that identifies project type and chooses an honest preview mode.

## 11.3 Preview categories
### Web application
Where possible, run the actual project using its normal development command and show its output in an appropriate mobile preview surface. The user must understand whether the preview is local-PC-backed or cloud-backed.

### Script / CLI
Show stdout/stderr, exit status, logs, and structured output where available. A visualizer can be added for known formats.

### Python desktop GUI / Windows application
A faithful interactive preview may require screenshot streaming, remote rendering, or a specialized implementation. If that is not in the current scope, say so and show output/logs rather than generating a fake UI.

### Unknown project type
Show detected files and a useful fallback. Do not alter source code just to force a preview.

## 11.4 Preview metadata
A preview should identify:
- Project type
- Preview method
- Status: starting/running/stopped/failed/unavailable
- Fidelity: live, approximate, output-only, or unsupported
- Logs/errors
- How to refresh/stop it

## 11.5 Safety and resource control
- Do not silently edit source files.
- Stop preview processes when no longer needed according to a documented lifecycle.
- Surface port conflicts or missing dependencies as diagnostics; do not turn the app into a localhost browser dashboard.
- Do not expose local preview services publicly by default.

## 11.6 Acceptance
At least one real supported preview path works; unsupported project types receive honest output-only or unavailable states.
