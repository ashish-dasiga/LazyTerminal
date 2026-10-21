# Module 01 — Problem Statement and User Needs

## 1.1 Problem statement
A developer may need to continue working on a Windows project while away from the laptop. A phone alone generally cannot run the same Windows CLIs, access the live PC filesystem, or execute Windows-specific programs. Existing ad-hoc approaches can result in separate browser dashboards, localhost ports, fragmented tools, or a remote-desktop experience that is poorly suited to command-line development.

The project must make the phone a practical development console while preserving the Windows PC as the source of truth for local project files and local execution.

## 1.2 User needs
The user needs to:
- Connect from Android to a Windows PC through a simple pairing flow.
- Enter a fresh password/key displayed by the PC.
- See a terminal immediately after successful connection.
- Run normal PowerShell/CMD commands, including directory navigation and Git commands.
- Browse PC folders, open/edit/save code, and observe file changes.
- Launch supported coding CLIs in a selected project folder.
- Use CLI-provider authentication through supported official flows.
- Keep Explorer, Source Control, Preview, and other tools accessible while a terminal/CLI session is active.
- Queue prompts and eligible edits while the PC is unavailable.
- Synchronize and review queued work when the PC returns.
- Optionally continue in a cloud workspace when a genuinely no-cost option is available.
- Install the products without manually running a web server or opening localhost URLs.

## 1.3 Pain points to avoid
- Two unrelated localhost web apps.
- UI that replaces the entire workspace when opening Explorer or Source Control.
- A terminal UI that looks like a desktop/macOS window on a phone.
- Fake “offline execution” while the PC is powered off.
- A preview that pretends arbitrary Windows software can be converted faithfully to HTML.
- Silent data loss during sync.
- Hardcoded passwords, tokens, or fake provider authentication.
- Mandatory services that can incur unexpected costs.

## 1.4 Desired outcome
A cohesive app pair: Android as the mobile interface and Windows as the execution/file agent, with clearly defined offline and optional cloud behaviours.

## 1.5 Acceptance
The agent must be able to explain the user problem, the PC/phone division of responsibility, and the constraints above before beginning implementation.
