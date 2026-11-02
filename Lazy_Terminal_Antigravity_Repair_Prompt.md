# Lazy Terminal --- End-to-End Backend Repair, Real CLI Integration, and Verified Mobile Testing

## Mission

Act as a senior full-stack engineer, Windows systems engineer, backend
architect, terminal/PTY specialist, QA automation engineer, and security
reviewer.

You are working on **Lazy Terminal**, a mobile terminal-style
application that connects to a Windows PC companion. The mobile frontend
already exists and is the visual source of truth. The current
implementation appears to contain hardcoded paths, mocked data,
incomplete backend endpoints, and UI behavior that suggests features
work when the underlying operations do not.

Your job is to turn the existing application into a genuinely working
product by connecting the existing frontend to real Windows filesystem
operations, real persistent shell processes, and real installed AI CLI
tools.

**Do not rebuild the application. Do not redesign the frontend. Do not
substitute a new demo. Repair the existing codebase and prove the
repaired flows work.**

The attached screenshots are evidence of the current failures. In
particular, they show:

-   Terminal input failing with
    `Endpoint /api/v1/pty/sessions/sess-pwsh/input not found`.
-   Claude Code terminal input failing with
    `Endpoint /api/v1/pty/sessions/sess-claude/input not found`.
-   Explorer failing with `Endpoint /api/v1/fs/list not found`.
-   A displayed working directory such as `C:\Projects\hyper-relay` that
    appears to be fixed or insufficiently connected to the actual
    selected path.
-   Explorer entries that may be sample/static data rather than a
    verified listing of the selected directory.

Treat these as symptoms. Find and fix the underlying causes.

------------------------------------------------------------------------

# 1. Non-negotiable rules

1.  **Preserve the supplied frontend exactly.** Keep its layout,
    navigation, logo, typography, colors, spacing, icons, and
    interaction design unchanged unless a specific functional bug
    requires a minimal change. Ask for approval before visual redesign.
2.  **Use real backend operations.** Production UI must not report
    success based on mocks, hardcoded arrays, fabricated responses, or
    optimistic state that is never confirmed by the host.
3.  **Do not fake authentication.** Launch the official installed CLI
    and allow its supported login/authentication flow. Never invent an
    authenticated state.
4.  **Do not hardcode the user's project path.** The user must be able
    to choose a real folder on the connected Windows PC.
5.  **Do not fabricate files or terminal output.** Explorer and terminal
    output must come from the actual host filesystem and actual
    processes.
6.  **Do not hide errors.** Show clear, actionable errors when a host,
    route, process, CLI, permission, or connection is unavailable.
7.  **Do not claim tests passed unless they were actually run.** Record
    commands, results, evidence, and any limitations.
8.  **Do not weaken security to make tests pass.** Protect the host,
    filesystem, credentials, and process execution.
9.  **Do not silently change the architecture.** Understand the current
    design first and extend it consistently.
10. **Do not implement cloud execution as part of this repair.** The
    current scope is offline/local operation through the paired Windows
    PC. When the PC is off, local execution is unavailable;
    reconnect/sync behavior is outside this repair unless already
    implemented and needed for regression testing.

------------------------------------------------------------------------

# 2. Inspect and understand the complete repository first

Before modifying code, inspect:

-   Mobile frontend and its navigation/screens.
-   Frontend state management and service/API layer.
-   Windows PC companion / host process.
-   Backend route registration and middleware.
-   Terminal process/PTY implementation.
-   Filesystem service.
-   Workspace/project selection logic.
-   AI provider/CLI adapters.
-   Pairing, authentication, and mobile-to-PC transport.
-   Git integration and repository detection.
-   Existing tests, scripts, build configuration, and environment
    configuration.

Search the full codebase for:

-   `C:\Projects\hyper-relay` and all other hardcoded paths.
-   Static file/folder arrays and sample directory contents.
-   Mock API clients, fixtures, fake terminal output, demo sessions,
    placeholder responses.
-   Hardcoded branch names, project names, host names, session IDs, and
    agent versions.
-   UI state that marks a service connected or authenticated without a
    real host response.
-   Endpoint strings that do not match registered backend routes.
-   Catch blocks that swallow errors or return fake success.
-   Development-only fallbacks that could accidentally run in
    production.

Do not assume the screenshots prove exactly which implementation is
wrong. Trace each failing request from the UI event through the frontend
client, transport, host router, service, and process/filesystem
operation.

## Required audit artifacts

Create `BACKEND_AUDIT.md` containing:

-   Issue and severity.
-   File/function and call path.
-   Observed behavior.
-   Root cause supported by code or runtime evidence.
-   Correct behavior.
-   Proposed repair.
-   Regression test.

Create `API_IMPLEMENTATION_MATRIX.md` with the actual frontend method,
actual backend route/transport message, HTTP method or event type,
request/response schema, implementation status, and test status. Do not
leave generic placeholders in the completed matrix.

Create `HARDCODED_AND_MOCK_AUDIT.md` listing every production mock,
hardcoded path, fake response, and fabricated state found, along with
its disposition.

------------------------------------------------------------------------

# 3. Repair the host API and transport contract

The screenshots show missing endpoints. Determine whether the correct
repair is to register missing routes, correct the frontend route, fix a
base URL/prefix, fix a router mount, or correct a transport mismatch. Do
not merely add duplicate endpoints without understanding the existing
contract.

For every frontend API call:

1.  Locate its call site.
2.  Identify the client method and base URL.
3.  Identify the host route or transport handler.
4.  Verify method, path, payload, response, status codes, and error
    shape.
5.  Verify the route is actually registered in the running host.
6.  Exercise it from the mobile app or an integration test.
7.  Ensure errors reach the UI accurately.

Use a consistent API contract and typed request/response models where
supported by the existing stack. Keep API versioning and existing
conventions consistent.

At minimum, verify host connectivity and implement/repair the contracts
needed for:

-   Host health/status.
-   Workspace selection and retrieval.
-   Filesystem listing and operations.
-   Terminal session creation, input, output streaming, resize,
    interrupt, status, and close.
-   CLI discovery and launch.
-   Agent process input/output and lifecycle.
-   Git status/branch information if those screens are part of the
    current UI.

If terminal output uses WebSocket, SSE, or another streaming transport,
verify that the selected transport is implemented end-to-end. Do not
treat a successful HTTP session-creation response as proof that
interactive input/output works.

------------------------------------------------------------------------

# 4. Make workspace and path handling genuinely dynamic

The app currently appears to display a fixed path such as:

`C:\Projects\hyper-relay`

Remove this as a mandatory production path. A sample path may exist in
test fixtures, but must never silently become the user's active
workspace.

## Required behavior

The user must be able to choose a real folder on the connected Windows
PC, using an appropriate native Windows folder picker or a safe
folder-browsing flow.

Implement:

-   Browse/select a folder on the PC.
-   Set the selected folder as the active workspace.
-   Display the actual selected absolute path.
-   Browse real subfolders and parent folders.
-   Switch workspaces.
-   Reopen recent workspaces only if they still exist and are
    accessible.
-   Handle a missing, moved, disconnected, or inaccessible folder
    without silently substituting another path.

Keep these concepts separate:

1.  Selected workspace root.
2.  Current Explorer directory.
3.  Each terminal session's current working directory.
4.  Each agent process's launch working directory.
5.  Git repository root discovered from the actual filesystem.

These paths are related but not interchangeable.

### Path behavior

-   Selecting a workspace should open that directory in Explorer.
-   A newly created terminal session should start in the selected
    workspace.
-   A newly launched agent should start in the selected workspace.
-   Git status should be discovered from the correct repository.
-   Navigating Explorer must not unexpectedly change an existing
    terminal's current directory.
-   Running `cd` in a terminal must update that terminal session's
    actual current directory, not silently change Explorer.
-   Existing sessions should retain their own working directory unless
    the user explicitly changes it.
-   A workspace switch should affect newly created sessions and new
    operations according to a clearly defined policy.

Do not store only a display label such as `hyper-relay`. Store and
validate the actual host path.

------------------------------------------------------------------------

# 5. Implement real Windows filesystem access

The Explorer must display actual files and folders on the connected PC,
not example content.

Repair the missing filesystem list operation shown in the screenshot:

`/api/v1/fs/list`

Use the route already intended by the existing architecture if
appropriate; otherwise update both frontend and backend contracts
consistently.

## Required operations

Implement the operations supported by the current UI, including as
applicable:

-   List directory entries.
-   Navigate into a directory.
-   Navigate to parent directory.
-   Retrieve file/folder metadata.
-   Read/open a file.
-   Create a file.
-   Create a folder.
-   Rename a file or folder.
-   Delete a file or folder, with explicit confirmation in the UI.
-   Refresh a directory listing.
-   Handle large folders without freezing the mobile UI.

Return real metadata, including entry name, type, size where applicable,
modified timestamp, and a safe path/reference usable by subsequent
operations.

## Correctness requirements

-   Show only entries that exist at the time of the host query.
-   Reflect changes made outside the app after refresh.
-   Reflect create/rename/delete operations after the host confirms
    success.
-   Correctly handle empty folders, hidden files according to the
    existing product design, permission errors, missing paths,
    inaccessible drives, external drives, and special characters.
-   Do not show stale sample entries as though they are real.
-   Do not fabricate timestamps or file sizes.
-   Do not swallow filesystem exceptions and return an empty successful
    listing.

## Security requirements

-   Enforce a configured allowed-root/workspace policy.
-   Canonicalize and validate paths on the host.
-   Prevent `..` traversal, symlink/junction escapes where relevant, and
    unauthorized access outside permitted roots.
-   Validate every filesystem operation on the host; frontend validation
    alone is insufficient.
-   Do not expose unrestricted access to the entire PC by default.
-   Return clear permission/validation errors.

------------------------------------------------------------------------

# 6. Implement real persistent Windows terminal sessions

The terminal must run commands in a real Windows shell process on the
PC.

The screenshot shows the mobile UI sending input to a missing route:

`/api/v1/pty/sessions/sess-pwsh/input`

Trace and fix the complete path from the input field/button to the
actual shell process. Do not just suppress the error or append fake
output.

## Shell requirements

-   Launch a real PowerShell process (prefer PowerShell 7 when
    installed; provide a clear fallback or actionable error if
    unavailable).
-   Use a suitable Windows-compatible PTY/process implementation that
    supports interactive behavior.
-   Keep the process alive across commands.
-   Send typed input to that process.
-   Stream real stdout and stderr to the mobile UI.
-   Preserve shell state, environment, and working directory within that
    session.
-   Report process exit/termination accurately.
-   Support Ctrl+C/interrupt and session termination.
-   Support terminal resize if supported by the selected PTY
    implementation.
-   Support multiple sessions without mixing their output.
-   Handle reconnecting the mobile client to an existing host session
    where the architecture supports it.
-   Clean up terminated sessions and avoid orphaned processes.
-   Apply bounded output buffering and backpressure.

The following must execute as real PowerShell commands:

``` powershell
pwd
cd ..
cd C:\Projects
ls
dir
Get-ChildItem
mkdir LazyTerminalTest
New-Item LazyTerminalTestFile.txt
Get-Content LazyTerminalTestFile.txt
echo "Hello from the real PC"
whoami
Get-Location
```

Also test:

-   Relative and absolute paths.
-   Paths with spaces.
-   Paths with non-English characters.
-   A command that produces multiple lines.
-   A long-running command that can be interrupted.
-   A command that returns a non-zero exit code.
-   Closing and recreating a session.

### Critical persistence test

1.  Start a terminal session in a selected workspace.
2.  Run `cd` to another existing directory.
3.  Run `pwd`.
4.  Confirm the new path is returned by the real shell.
5.  Run `mkdir` or create a uniquely named temporary test folder.
6.  Confirm that folder exists on the Windows filesystem.
7.  Run another command and confirm the shell remains in the changed
    directory.

Do not implement `cd`, `ls`, or `mkdir` as special frontend commands.
They must execute through the actual shell.

------------------------------------------------------------------------

# 7. Integrate actual Claude Code and Gemini CLI processes

Selecting an AI agent must launch the real CLI installed on the Windows
PC. Changing a label or showing a fabricated welcome banner is not
integration.

## CLI discovery

For each supported CLI:

-   Detect whether it is installed on the PC.
-   Resolve its executable using Windows PATH and appropriate executable
    discovery; support a user-configurable executable path if necessary.
-   Retrieve the actual version by invoking the documented version
    command where safe.
-   Report unavailable, unsupported, or failed states honestly.
-   Do not hardcode one developer's installation path.

## Claude Code

-   Launch the real Claude Code CLI in the selected workspace.
-   Use the CLI's supported interactive mode and process invocation.
-   Allow the official login/authentication flow to appear and complete.
-   Preserve interactive input/output in the terminal session.
-   Report installation, authentication, network, and process errors
    accurately.
-   Do not assume a particular API key flow if the CLI supports other
    official login methods.
-   Do not print a fake "attached" or "authenticated" message unless the
    actual process and state support that claim.

## Gemini CLI

Implement the same principles for the actual Gemini CLI:

-   Discover the installation.
-   Resolve executable and version.
-   Launch in the selected workspace.
-   Allow the official login flow.
-   Support interactive input/output.
-   Preserve process lifecycle.
-   Report actual errors.

## Codex and Antigravity

Audit their existing integrations too. Do not claim support unless the
actual installed CLI and supported invocation/authentication flow have
been verified. Do not invent CLI flags or provider APIs. Consult the
installed tool's help/version output or authoritative documentation when
needed.

## Adapter architecture

Use a maintainable provider adapter pattern consistent with the existing
codebase. Provider-specific behavior must remain provider-specific where
required:

-   Discovery.
-   Version detection.
-   Launch arguments.
-   Environment requirements.
-   Authentication behavior.
-   Working directory.
-   Input/output.
-   Process lifecycle.
-   Error normalization.

Never log tokens, API keys, credentials, or sensitive environment
variables. Do not scrape private credential stores or bypass official
login flows.

------------------------------------------------------------------------

# 8. Remove fake state from the frontend

Connect existing UI state to real host responses.

Examples:

-   A terminal session is "connected" only after the host confirms a
    live process/session.
-   An agent is "available" only after actual discovery.
-   Authentication is not shown as complete without reliable evidence.
-   The Explorer shows loading, empty, success, and error states based
    on actual responses.
-   The displayed path comes from the selected/active host path.
-   Git branch/status comes from the actual repository.
-   A create/rename/delete action is successful only after the host
    confirms it.

Do not leave stale fake data visible after a request fails. Do not
silently return demo fixtures in production.

Keep loading and error states consistent with the current design. Make
only the minimum visual changes required to accurately communicate real
state.

------------------------------------------------------------------------

# 9. End-to-end testing is mandatory --- use Playwright

You must use **Playwright** to test the actual application flows, not
just unit tests or static code inspection.

First inspect the existing test setup. Reuse the current Playwright
configuration if present. If it is absent, add a suitable Playwright
setup without disrupting the project's existing stack.

Run the app and the Windows companion in the supported development
configuration. Use the real host PC for process/filesystem tests. Do not
replace host operations with mocks for acceptance testing.

## Playwright scenarios

Create and run end-to-end tests for the following flows.

### A. Host connection and workspace selection

1.  Launch the app.
2.  Verify that the mobile/web frontend can reach the Windows companion.
3.  Verify the host status reflects the real connection.
4.  Open the workspace/folder picker.
5.  Select a real test directory on the Windows PC.
6.  Verify the exact selected path is displayed.
7.  Reload or revisit the screen and verify the workspace is restored
    only if it still exists and is permitted.

### B. Real Explorer verification

1.  Create a uniquely named temporary test directory on the Windows PC
    as test setup.
2.  Put a uniquely named test file and a subfolder inside it.
3.  Select that directory in Lazy Terminal.
4.  Verify that the Explorer shows exactly the real entries expected.
5.  Verify names, entry types, and metadata against the host filesystem.
6.  Navigate into the subfolder and back.
7.  Create a folder through the app and verify it exists on disk.
8.  Create a file through the app and verify it exists on disk.
9.  Rename a test file and verify the host filesystem reflects the
    rename.
10. Delete only the test artifact after explicit test confirmation and
    verify it is gone.
11. Modify the directory externally and refresh the Explorer; verify the
    new state appears.
12. Verify nonexistent files are not displayed.
13. Verify permission and missing-path errors are displayed accurately.

Use unique test names and clean up only artifacts created by the test.
Never delete user data or an existing directory.

### C. Real PowerShell terminal verification

1.  Open the terminal screen.
2.  Create a real PowerShell session.
3.  Confirm the session is actually running on the Windows host.
4.  Execute `pwd` and compare output with the expected host path.
5.  Execute `cd` to a different existing test directory.
6.  Execute `pwd` again and verify the path changed.
7.  Execute `ls`/`Get-ChildItem` and verify actual entries.
8.  Execute `mkdir` with a unique test name.
9.  Verify the directory exists on disk.
10. Execute a file-creation command and verify the file exists.
11. Execute `whoami` and verify non-empty real process output.
12. Interrupt a long-running command and verify it stops.
13. Close the session and verify the process is terminated or retained
    according to the documented session policy.
14. Verify output from one session never appears in another session.

Do not merely assert that the command text appears in the terminal.
Assert the actual output and verify filesystem side effects on the
Windows host.

### D. Real Claude Code authentication and prompting

1.  Detect whether Claude Code is installed.
2.  If installed but not authenticated, launch it and allow the official
    interactive sign-in flow.
3.  Do not automate, bypass, or fabricate credentials.
4.  Once the user has completed legitimate authentication, send a simple
    harmless prompt in a disposable test workspace, such as asking it to
    explain the contents of a small test file.
5.  Verify that output is produced by the real Claude process.
6.  Verify the process is running in the selected workspace.
7.  Verify failures are surfaced honestly.

If interactive login requires manual user action, pause and report that
clearly. Do not claim the authentication test passed until the user
completes it and the actual CLI works.

### E. Real Gemini CLI verification

Perform equivalent installation, login, launch, prompt, output,
working-directory, and failure tests for Gemini CLI. Do not fabricate a
successful login or prompt response.

### F. Regression checks

-   Verify the existing frontend navigation still works.
-   Verify the logo and visual design remain unchanged.
-   Verify terminal, Explorer, Git, Preview, and More screens still
    render.
-   Verify the app does not show fake sample content when the host is
    offline.
-   Verify the host-offline state is clear and does not claim local PC
    execution is available.

## Playwright evidence

Create `E2E_TEST_REPORT.md` containing:

-   Test name and scenario.
-   Browser/device/emulator target.
-   Test command.
-   Actual result: PASS, FAIL, BLOCKED, or NOT RUN.
-   Relevant logs and error output.
-   Screenshots or trace paths for failures and important successful
    flows.
-   Host-side verification used for filesystem/process assertions.
-   Any manual step required, especially CLI login.

Do not mark a test PASS merely because a Playwright locator found a
button or a UI label changed. Validate the real side effect.

Use Playwright traces/screenshots where useful. Keep test artifacts
separate from application data.

------------------------------------------------------------------------

# 10. Test on a mobile emulator when needed

The target experience is a mobile application. In addition to
browser-level Playwright tests:

1.  Identify the project's existing mobile framework and emulator
    workflow.
2.  Start an appropriate Android emulator if available and supported.
3.  Install/run the existing mobile app using the project's documented
    commands.
4.  Verify layout and interactions on the emulator.
5.  Verify the mobile app connects to the Windows companion using the
    real configured network/transport path.
6.  Exercise workspace selection, Explorer navigation, terminal input,
    and output on the emulator.
7.  Verify touch controls, keyboard behavior, safe areas, and scrolling.
8.  Capture screenshots for any regression.

Do not assume `localhost` on an Android emulator points to the Windows
host. Use the correct host address/port or the project's established
pairing/tunnel mechanism. Preserve secure pairing and authentication.

If the emulator is unavailable, report BLOCKED with the exact reason and
provide the commands needed to run the test. Do not claim emulator
testing occurred.

Playwright browser tests and emulator tests are complementary; one does
not automatically prove the other.

------------------------------------------------------------------------

# 11. Security and safety

This application can execute commands and access personal files. Treat
the Windows companion as a sensitive local service.

Implement and verify:

-   Authenticated and authorized phone-to-PC communication.
-   Secure pairing/session validation consistent with the current
    architecture.
-   Workspace/allowed-root enforcement.
-   Canonical path validation and traversal protection.
-   Safe process creation and argument handling.
-   No shell command construction by unsafe string concatenation.
-   Input validation and bounded output.
-   Process timeouts and cleanup policies.
-   Safe handling of disconnected clients.
-   No credentials or secrets in logs, source code, screenshots, or test
    reports.
-   No unrestricted unauthenticated shell endpoint.
-   No weakening of Windows permissions to bypass access errors.

Use the least privilege needed. Do not run the companion as
Administrator unless the architecture genuinely requires it and the
reason is documented.

------------------------------------------------------------------------

# 12. Work in small implementation phases

Do not attempt one enormous unreviewed rewrite. Complete each phase, run
its tests, inspect the diff, and commit it separately.

## Phase 1 --- Audit and reproduce

-   Inspect the entire repository.
-   Reproduce the screenshot failures.
-   Trace the missing terminal and filesystem routes.
-   Identify all hardcoded paths and fake data.
-   Create the three audit documents.
-   Record baseline frontend screenshots.

**Exit criteria:** Root causes are evidenced and the implementation plan
is concrete.

## Phase 2 --- Host connectivity and API contract

-   Verify the Windows companion starts.
-   Verify mobile-to-host communication.
-   Repair route registration, base URLs, prefixes, and transport
    contracts.
-   Add health/status verification.
-   Add integration tests for the repaired API routes.

**Exit criteria:** The frontend reaches the real host APIs; no endpoint
is merely hidden or mocked.

## Phase 3 --- Workspace and filesystem

-   Implement folder selection.
-   Implement dynamic workspace state.
-   Implement real directory listing and file/folder operations required
    by the UI.
-   Remove static Explorer data.
-   Add path safety.
-   Run filesystem integration and Playwright tests.

**Exit criteria:** Explorer contents and operations match the real
Windows filesystem.

## Phase 4 --- Persistent terminal

-   Implement real PowerShell process/PTY sessions.
-   Repair session creation/input/output/lifecycle routes.
-   Implement persistent working-directory behavior.
-   Add interrupt, close, and cleanup handling.
-   Run actual command tests and Playwright assertions.

**Exit criteria:** Commands execute on the Windows PC and their
output/side effects are verified.

## Phase 5 --- AI CLI integrations

-   Implement actual Claude Code discovery and launch.
-   Implement actual Gemini CLI discovery and launch.
-   Audit Codex and Antigravity support without inventing capabilities.
-   Support official interactive authentication.
-   Test real prompts in a disposable workspace.

**Exit criteria:** Each provider is marked working only after a real
process and prompt are verified. Manual login dependencies are
documented.

## Phase 6 --- Mobile/emulator and regression

-   Run Playwright end-to-end suite.
-   Run Android emulator tests if available.
-   Verify host pairing and real network connectivity.
-   Verify original frontend visuals.
-   Run builds, unit tests, integration tests, and regression tests.
-   Review security and process cleanup.

**Exit criteria:** All runnable acceptance tests have evidence and every
blocked/unrun test is explicitly identified.

------------------------------------------------------------------------

# 13. Git and implementation discipline

-   Inspect the current Git status and branch before making changes.
-   Do not overwrite or discard existing user changes.
-   Follow the contributor's assigned branch and file ownership
    instructions.
-   Work in small, logically grouped changes.
-   Commit each completed feature/phase separately, as required by the
    project workflow.
-   Before every commit, inspect `git diff`, run relevant tests, and
    ensure no secrets or unrelated changes are included.
-   Never force-push, reset, or rewrite shared history unless explicitly
    authorized.
-   Record commit hashes in the final report.

Suggested commit grouping:

1.  `fix: align host API routes and transport contracts`
2.  `feat: implement dynamic Windows workspace and filesystem`
3.  `feat: implement persistent PowerShell sessions`
4.  `feat: integrate real Claude and Gemini CLI processes`
5.  `test: add Playwright host and mobile end-to-end coverage`
6.  `docs: record backend audit and verification results`

Use the repository's existing commit conventions if they differ.

------------------------------------------------------------------------

# 14. Definition of done

The task is complete only when the following are true:

-   The original frontend is visually preserved.
-   No production screen relies on fabricated filesystem, terminal, Git,
    agent, or connection data.
-   The user can select a real folder on the Windows PC.
-   Explorer displays the actual contents of that folder.
-   Explorer operations create, rename, and delete actual test artifacts
    on disk.
-   PowerShell commands execute in a real persistent process.
-   `cd` changes the actual session working directory.
-   `ls`/`dir` show actual filesystem entries.
-   `mkdir` creates an actual directory.
-   Terminal output is streamed from the real process.
-   Claude Code and Gemini CLI are discovered and launched as actual
    installed programs.
-   Official authentication flows are available and never simulated.
-   AI prompts produce output from the actual CLI process.
-   Mobile and host paths are consistent with the selected workspace and
    session state.
-   Missing endpoints and transport errors are fixed at their source.
-   Playwright tests verify real host-side effects, not just UI
    appearance.
-   Emulator tests are completed or explicitly marked BLOCKED with
    evidence.
-   Security restrictions are tested.
-   Audit, API matrix, and E2E report are complete.
-   All results are truthful and reproducible.

------------------------------------------------------------------------

# 15. Final report required

At the end, provide a concise but complete report with:

1.  Root causes found.
2.  Hardcoded/mock implementations removed or isolated.
3.  Backend routes/services implemented or repaired.
4.  Workspace/path behavior implemented.
5.  Terminal functionality implemented.
6.  Claude Code and Gemini CLI integration status separately.
7.  Codex and Antigravity status, including anything not verified.
8.  Playwright tests run and their actual results.
9.  Mobile emulator tests run and their actual results.
10. Security checks performed.
11. Build/test commands and outputs.
12. Files changed.
13. Commit hashes.
14. Remaining blockers and manual steps.

Use only these status labels:

-   **PASS** --- executed and verified with evidence.
-   **FAIL** --- executed and failed.
-   **BLOCKED** --- could not be executed due to a specific dependency
    or environment limitation.
-   **NOT RUN** --- not attempted.

Never describe an untested feature as complete.

------------------------------------------------------------------------

## Final instruction

Start by inspecting the repository and reproducing the reported
failures. Produce the audit and API matrix before making architectural
changes. Then implement the repair in the phases above.

**The goal is not to make Lazy Terminal look functional. The goal is to
make every existing control perform its real operation on the connected
Windows PC, and to prove that operation through Playwright and host-side
verification.**
