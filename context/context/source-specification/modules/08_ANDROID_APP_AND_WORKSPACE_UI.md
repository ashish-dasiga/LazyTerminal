# Module 08 — Android APK and Terminal-First Workspace

## 8.1 Responsibilities
- Provide connection screen and pairing.
- Maintain connection state.
- Show terminal as the default screen after successful pairing.
- Provide persistent navigation for Explorer, Editor, Source Control, CLI launcher, Preview, and More Options.
- Display live terminal output and input.
- Cache eligible files and persist offline tasks.
- Present sync reviews, conflicts, and results.
- Clearly distinguish PC execution from cloud execution.

## 8.2 Connection screen
- Secret input with sensible formatting and paste support.
- Connect action.
- Loading/connecting state.
- Invalid secret, unreachable PC, timeout, and retry states.
- Do not store the pairing secret beyond what the active session requires.
- Never show a fake successful connection.

## 8.3 Terminal workspace
- Default after pairing.
- Show current working directory/session.
- Input supports normal commands and multi-line input if shell handling allows.
- Output supports incremental streaming, scrollback, and stderr differentiation where practical.
- Show running, completed, failed, cancelled, and disconnected status.
- Preserve terminal state when navigating to other tools where feasible.

## 8.4 Persistent navigation
A compact top bar/menu/navigation should expose:
- Explorer
- Terminal
- Source Control
- Run/CLI
- Preview
- More Options/settings

The user explicitly does not want full-screen independent modules that make the app feel like unrelated web pages. Use the provided frontend as the source of visual truth after inspection.

## 8.5 Offline workspace
When PC is unavailable:
- Keep the user in a usable workspace.
- Permit drafting prompts and tasks.
- Permit editing cached/local copies when available.
- Show stale/offline status.
- Persist the queue through app restart.
- Never imply that live PC files or Windows commands are available.

## 8.6 Accessibility and mobile ergonomics
Handle virtual keyboard, small screens, scrollback, touch targets, long paths, selection/copy/paste, dark/light theme if frontend supports it, and navigation/back behaviour.

## 8.7 Acceptance
APK opens, pairs, shows terminal-first UI, preserves navigation, supports input/output, and accurately displays online/offline/sync states.
