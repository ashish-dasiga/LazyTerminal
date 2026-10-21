# Module 09 — Terminal, CLI Providers, Authentication, Git, and Files

## 9.1 Normal terminal mode
The terminal must work without a coding CLI. Users can run ordinary shell commands such as:
- `cd`
- `dir`
- `git status`
- `git pull`
- `git commit`
- PowerShell/CMD commands supported by the Windows environment

Commands execute on Windows. Android forwards input and displays output.

## 9.2 Working directories
- The user can navigate manually through the terminal.
- The user can browse Explorer and select a project folder.
- “Open Folder With”/CLI launcher starts a supported CLI in that selected folder.
- Working directory changes should be reflected in UI and session metadata.
- Do not silently switch directories behind the user's back.

## 9.3 CLI adapter design
Initial requested integrations:
- Claude Code
- Codex CLI
- Gemini CLI
- VS Code command-line integration
- Antigravity, if a supported invocation is available

Each adapter should declare:
- Detection method
- Installation/setup method (official and current)
- Supported Windows versions
- Required runtimes/prerequisites
- Launch command/arguments
- Working-directory behaviour
- Authentication method
- Detectable auth status/usage information
- Known limitations
- Test strategy

Do not assume all tools expose the same capabilities. The word “CLI” does not guarantee headless use, stable APIs, or that an editor GUI can be rendered inside the mobile app.

## 9.4 Authentication
- Prefer official sign-in flows, browser handoff, or provider-supported CLI login.
- Never ask users to paste their provider account password into this app.
- Never extract tokens from undocumented locations.
- Do not invent usage/token metrics. Show only information available through supported interfaces.
- Account entitlements and quotas remain governed by each provider.
- A provider may require interaction on the PC; explain that instead of pretending sign-in succeeded.

## 9.5 Git integration
Required where feasible:
- Status and current branch
- Diff view
- Stage/unstage
- Commit
- Pull/push
- Branch operations
- Merge/conflict display

Git operations should run against the selected PC repository. Preserve unsaved editor changes and warn about destructive operations.

## 9.6 File editing
- Browse files and folders within authorized scope.
- Open supported text files.
- Edit/save to PC when connected.
- Detect modifications from CLI processes or external editors.
- Before overwriting changed content, compare base hash/version and request conflict resolution.
- Keep local offline edits as pending operations until sync is approved.

## 9.7 Acceptance
At least one CLI works end-to-end on Windows; normal terminal commands work independently of CLIs; Git and file operations have tests and truthful failure messages.
