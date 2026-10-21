# Module 07 — Windows Companion, EXE Installer, and PC Runtime

## 7.1 Responsibilities
The Windows EXE is the installed PC component. It must:
- Install and launch the companion app.
- Start its native background communication component.
- Generate and display a fresh random pairing secret on each communication-service startup.
- Accept valid Android pairing requests.
- Execute approved commands on Windows.
- Read/write files within the user's authorized scope.
- expose Git and CLI operations through adapters.
- Return terminal output, file data, events, and task results.
- Detect reconnect and process approved queued tasks.

## 7.2 Secret lifecycle
1. Service starts.
2. Generate secret using a cryptographically secure random generator.
3. Bind the secret to the current startup/session.
4. Display it in the PC UI.
5. Validate incoming pairing attempts.
6. On restart, invalidate the previous startup secret and generate a new one.
7. Do not write the secret to ordinary logs.
8. Define expiration and failed-attempt behaviour before deployment.

An example secret in documentation is illustrative only. Never use a hardcoded static password in the implementation.

## 7.3 Installer and CLI setup
The EXE may detect/install supported CLIs and prerequisites using official installation methods. The installer must:
- Detect existing installations first.
- Avoid reinstalling unnecessarily.
- Show progress and actionable errors.
- Explain when internet access or a package manager is required.
- Respect provider license terms and interactive authentication.
- Never bundle user tokens or bypass sign-in.
- Allow the core app to install even if an optional CLI fails to install.
- Record installed versions and locations where feasible.

## 7.4 Process management
- Support PowerShell/CMD sessions.
- Set the requested working directory.
- Stream stdout/stderr.
- Report process exit code.
- Support cancellation and session termination.
- Avoid mixing output from different sessions.
- Keep terminal sessions alive only according to documented lifecycle rules.

## 7.5 Filesystem access
- Expose only paths authorized by the user/app configuration.
- Validate normalized paths and reject traversal outside allowed roots.
- Detect changed files before overwriting.
- Use safe write semantics where possible.
- Provide structured permission and I/O errors.

## 7.6 Lifecycle and diagnostics
Handle startup failure, service stop, PC sleep/resume, network changes, Android disconnect, EXE update, and clean uninstall. Diagnostics must redact pairing secrets and provider tokens.

## 7.7 Acceptance
A clean Windows install starts the companion; a new secret is shown per service start; Android can pair; commands and file operations work on a test project; failures are reported clearly.
