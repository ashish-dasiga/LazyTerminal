# Project Overview

## Product name
Working title: **Mobile–PC Development Environment**. Do not invent a final brand name unless asked.

## One-sentence definition
A native Android development console that connects to a Windows companion app so a developer can browse and edit PC files, run normal terminal commands, launch supported coding CLIs, use Git, and preview project output from a phone—with offline task queueing and an optional, strictly cost-conscious cloud mode.

## The two products
### Android APK
The mobile interface and local queue. After a successful PC connection, the terminal is the default screen. Navigation to Explorer, Editor, Source Control, CLI launcher, Preview, and options remains compact and persistent.

### Windows EXE
The installable PC companion. It starts the background communication component, generates and displays a fresh random pairing secret at each service startup, provides access to approved PC files, runs shell commands and supported CLIs, and returns output/state to Android.

## Key interaction
1. Install and launch Windows EXE.
2. PC companion starts its communication service and creates a new random pairing secret.
3. User reads the secret from the PC app.
4. User opens Android APK and enters the secret.
5. The apps establish a session if the secret is valid and the PC is reachable.
6. Android opens directly to the terminal.
7. User runs commands or opens the compact navigation to work with files, Git, CLIs, or Preview.
8. If PC becomes unavailable, the phone clearly enters offline mode and queues eligible work.
9. When PC returns, pending work is reviewed, reconciled, and executed only after confirmation.
10. Optional cloud mode may provide a separate remote workspace, only if it can be offered without mandatory or unexpected billing.

## Hard constraints
- ₹0 mandatory running cost.
- No required paid cloud, database, API, or relay.
- No localhost browser dashboard as the product.
- Native APK and EXE deliverables.
- PC-dependent commands run on the PC, not magically on Android.
- Cloud execution is not assumed to be available for every CLI.
- Frontend code will arrive later in a `.dht` file and must be inspected and reused.
