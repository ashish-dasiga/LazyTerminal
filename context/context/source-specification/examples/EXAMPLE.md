# Example Module — Input and Expected Output

## Example A: Pairing and normal terminal

### Input / setup
```text
Windows companion: start
Android app: open
User enters: the current random secret displayed by the PC
Project folder: C:\Users\Developer\Projects\DemoApp
Command: git status
```

### Expected behaviour
1. PC generates a new secret at startup and displays it.
2. Android submits the entered secret.
3. PC validates it.
4. If valid, Android opens terminal-first workspace.
5. User runs `git status`; the Windows PC executes it.
6. Output streams to Android.
7. Explorer, Git, CLI launcher, Preview, and options remain accessible.

### Illustrative output
```text
Connection: Connected
Execution target: Windows PC
Working directory: C:\Users\Developer\Projects\DemoApp

> git status
On branch main
Your branch is up to date with 'origin/main'.
nothing to commit, working tree clean
Exit code: 0
```

The output above is illustrative; actual output must come from the real command.

## Example B: Invalid secret
### Input
```text
PC current secret: <current random value>
Android entered secret: <different value>
```

### Expected output
```text
Connection: Failed
Reason: Pairing secret was not accepted.
Actions: Try again / Check the current secret on the PC.
Execution: Not started
```

## Example C: CLI launcher
### Input
```text
Selected folder: C:\Users\Developer\Projects\DemoApp
Selected CLI: Gemini CLI
Action: Launch
```

### Expected behaviour
- Windows adapter checks installation and supported invocation.
- If available, it launches in the selected directory.
- If authentication is required, show the provider-supported login path.
- If missing, show installation/setup guidance.
- Never fake a running CLI session.

## Example D: PC off
### Input
```text
PC status: Off
Prompt: "Add setup instructions to the README."
Action: Queue task
```

### Expected output
```text
PC status: Offline
Task status: Queued locally
Execution: Not started
Message: "This task will execute on the PC after it reconnects, or in a separately configured cloud workspace if available."
```

## Example E: Reconnection
### Input
```text
PC comes online
Pending tasks: 1
```

### Expected workflow
```text
PC reachable
→ Sync request displayed
→ User reviews pending changes
→ Conflict check
→ User approves
→ Approved task executes on PC
→ Real output and final status return to Android
```

## Example F: Preview
### Input
```text
Project type: Windows desktop GUI
Action: Preview
```

### Expected output
The app must label the preview as screenshot/remote-rendered, approximate, output-only, or unsupported based on the actual implemented method. It must not claim a generated HTML page is the actual native app.

## Rules
- Never use the example secret as a real password.
- Never use static mock output in a completed integration test.
- Never report a queued PC task as running or succeeded while the PC is off.
