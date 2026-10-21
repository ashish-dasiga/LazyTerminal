# Frontend Handoff Instructions

## Expected handoff
The user has two frontend contributors:
1. Terminal/connected-workspace UI.
2. Connection UI for the Android and Windows apps.

The user plans to provide a `.dht` file containing frontend code or an export. It has not necessarily been supplied yet.

## Required agent behaviour
1. Inspect `frontend_handoff/` during Phase 0.
2. If no `.dht` file exists, mark this as a blocker/dependency in `state/PROGRESS.md`.
3. Preserve the original file unchanged.
4. Identify the actual file format, language, framework, assets, and build assumptions. Do not infer format from the extension alone.
5. Map supplied components to the product requirements.
6. Reuse supplied styles and layout wherever compatible.
7. Add real application state and protocol bindings behind the UI.
8. Do not replace the supplied frontend with generic mock screens without explicit approval.
9. If it is a design export and cannot be used directly, explain the conversion path and keep the source artifact.
10. Record integration files and tests in `state/PROGRESS.md`.

## Must preserve
- Mobile terminal as default connected view.
- Persistent compact navigation.
- No desktop/macOS window controls.
- Connection screen accepts the current PC-generated secret.
- Clear error, disconnected, offline, syncing, and conflict states.
