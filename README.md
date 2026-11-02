# Lazy Terminal

> **Mobile-first, local-first Android + Windows PC development companion.**  
> Control real filesystems, persistent PowerShell terminal sessions, Git operations, and AI coding agents (Claude Code, Gemini CLI, Codex, Antigravity) running natively on your Windows PC directly from your phone.

---

## Architecture Overview

```
 ┌─────────────────────────────────────────────────────────┐
 │               Android Phone / Emulator                  │
 │  • Capacitor / Native Android Release APK               │
 │  • Mobile Web View (?view=mobile)                       │
 └────────────────────────────┬────────────────────────────┘
                              │
               Local LAN / 10.0.2.2 Loopback
              HTTP/SSE with 6-Digit Key Exchange
                              │
 ┌────────────────────────────▼────────────────────────────┐
 │              Windows PC Host Companion                  │
 │  Port 9871 (0.0.0.0) • Dynamic Workspace Management     │
 ├─────────────────────────────────────────────────────────┤
 │ • Terminal: Real Persistent PowerShell 5.1/7 Sessions   │
 │ • Filesystem: Real Disk CRUD & UTF-8 / Unicode Viewer   │
 │ • Source Control: Real Host Git Operations & Diffing    │
 │ • AI CLIs: Real Claude Code, Gemini CLI, Codex, Agy     │
 │ • Offline Engine: IndexedDB Queue + Explicit Review     │
 └─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before running Lazy Terminal, ensure your Windows machine has:

- **Node.js**: v18.0.0 or higher (`node -v`)
- **Git**: Installed and available on Windows `PATH` (`git --version`)
- **PowerShell**: Windows PowerShell 5.1 (bundled with Windows) or PowerShell 7 (`pwsh`)
- **(Optional for Android APK / Emulator)**:
  - **OpenJDK 17**: HotSpot JDK (`javac -version`)
  - **Android SDK**: `platform-tools` (`adb.exe`), `build-tools`, `emulator.exe`, and API 34 system image
  - **Hardware Acceleration**: Windows Hypervisor Platform (WHPX) enabled

---

## Quick Start (Under 2 Minutes)

### 1. Install Dependencies
```powershell
git clone https://github.com/ashish-dasiga/LazyTerminal.git
cd LazyTerminal
npm install
```

### 2. Start the Windows PC Host Companion
Start the authenticated host companion on port `9871`:
```powershell
npm run host
```
*(Alternatively, run `npm run dev:full` for Vite frontend hot-reloading + backend companion on port 3000).*

When the companion boots, it prints a dynamic **6-Digit Pairing Code** (valid for 5 minutes):
```
============================================================
 Lazy Terminal — Windows PC Companion Started
 Listening on: http://0.0.0.0:9871
 Workspace Root: C:\Users\<Username>\Projects
 Active 6-Digit Pairing Key: 849-201 (TTL: 300s)
============================================================
```

### 3. Open the Mobile Interface

- **Web Browser (Mobile View)**:
  Open `http://localhost:9871/?view=mobile` in your browser.
- **Physical Android Phone (Same Wi-Fi)**:
  Open `http://<YOUR_PC_LAN_IP>:9871/?view=mobile` in your mobile browser.
- **Android APK**:
  Install and open [`LazyTerminal.apk`](public/downloads/LazyTerminal.apk) on your device or emulator.

Enter the 6-digit code shown in the Windows companion terminal to establish an encrypted local session.

---

## Building and Running the Native Android APK

Lazy Terminal includes a zero-dependency standalone build script that compiles, dexes, aligns, and signs a universal native Android APK without requiring Gradle.

### 1. Compile and Sign the APK
```powershell
npm run build && npm run build:apk
```
The output APK is written to:
`public/downloads/LazyTerminal.apk` (~185 KB, compatible with Android 7.0 through Android 15).

### 2. Install on Android Device or Emulator
```powershell
adb install -r public/downloads/LazyTerminal.apk
adb shell am start -n com.lazyterm.app/.MainActivity
```

### 3. Running with Android Studio / Headless Emulator
To create and launch an automated Android 14 test emulator:
```powershell
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk" # or your SDK path
# Launch headless emulator
& "$env:ANDROID_SDK_ROOT\emulator\emulator.exe" -avd LazyTerminalE2E -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect
```
*Note: In the Android Emulator, the app automatically connects to `http://10.0.2.2:9871` (the Android emulator alias for the Windows host loopback).*

---

## Supported AI Coding Agents

Lazy Terminal integrates directly with CLI agents installed on your Windows host:

| CLI Tool | Detection Path | Version Command | Multi-Turn Protocol |
| :--- | :--- | :--- | :--- |
| **Claude Code** | `claude.exe` on Windows PATH | `claude --version` | Direct process spawn, stdin closed, real-time SSE stream |
| **Gemini CLI** | `gemini.cmd` (npm global) | `gemini --version` | Native `node.exe <gemini.js>` direct spawn, auto-fallback |
| **Codex CLI** | `codex.cmd` (npm global) | `codex --version` | Native `node.exe <codex.js>` direct spawn (`codex exec`) |
| **Antigravity** | `agy.exe` on Windows PATH | `agy --version` | Direct executable spawn; interactive shell support |

- Open **More** &rarr; **CLI Tools & Permissions** to inspect binary paths, versions, and authentication status.
- Tap **Launch in Terminal** to switch the terminal to that agent session and send prompts.

---

## Running the Automated Test Suite

Lazy Terminal features comprehensive unit, backend, and browser/emulator Playwright test suites:

### 1. Typecheck & Lint
```powershell
npm run lint
```

### 2. Unit & Security Tests
```powershell
# Filesystem path traversal boundaries and safe Git operations
npm test

# Host companion, pairing rate-limiting, and AI CLI process resolution
npm run test:host

# CLI detector, Dev server ports, and Run/Debug runner inspection
npm run test:shreya
```

### 3. Playwright End-to-End Suite (Host & Android Emulator)
Runs 9 comprehensive E2E tests covering dynamic workspace switching, Explorer file CRUD, persistent PowerShell execution, SIGINT interruption, AI CLIs, and Android APK WebView execution:
```powershell
npx playwright test
```

---

## Offline Mode & Reconciliation Invariant

When your phone loses Wi-Fi connection to your PC:
1. The app detects disconnection and switches to **Offline Mode**.
2. Drafted terminal commands and file edits are queued safely inside browser IndexedDB.
3. **Product Invariant:** Reconnecting to your PC **never** auto-executes buffered commands silently.
4. Instead, an explicit **State Synchronization** modal displays each buffered intent, allowing you to review, approve, or discard before any command touches your Windows host.

---

## Technical Audit & Verification Deliverables

Detailed technical audits and verification matrices created during testing:

- [`BACKEND_AUDIT.md`](BACKEND_AUDIT.md) — Root cause audit of split companions, routing, path aliasing, and session auth.
- [`API_IMPLEMENTATION_MATRIX.md`](API_IMPLEMENTATION_MATRIX.md) — Exhaustive contract mapping across all 6 API subsystems.
- [`HARDCODED_AND_MOCK_AUDIT.md`](HARDCODED_AND_MOCK_AUDIT.md) — Ledger of all eliminated mock datasets and silent substitutions.
- [`E2E_TEST_REPORT.md`](E2E_TEST_REPORT.md) — Verification report with exact PASS/FAIL records, commands, and host assertions.
- [`AGENTS.md`](AGENTS.md) — Shared agent contract and invariants for multi-contributor pairing.

---

## License

MIT © 2026 Lazy Terminal Contributors.
