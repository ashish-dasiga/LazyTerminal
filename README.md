# Lazy Terminal

> **Mobile-first, local-first Android + Windows PC development companion.**  
> Control real filesystems, persistent PowerShell terminal sessions, Git operations, and AI coding agents (Claude Code, Gemini CLI, Codex, Antigravity) running natively on your Windows PC directly from your phone.

---

## Architecture Overview

```
 ┌─────────────────────────────────────────────────────────┐
 │               Android Phone / Mobile App                │
 │  • Standalone Native Release APK (LazyTerminal.apk)     │
 │  • Mobile Web Client (?view=mobile)                     │
 └────────────────────────────┬────────────────────────────┘
                              │
               Local Wi-Fi LAN / 10.0.2.2 Loopback
              HTTP/SSE with 6-Digit Key Exchange
                              │
 ┌────────────────────────────▼────────────────────────────┐
 │         Lazy Terminal Windows Desktop Companion         │
 │  • Standalone NSIS Executable (Electron + Node engine)  │
 │  • Single-Instance Process Mutex Lock                   │
 │  • Port 9871 (0.0.0.0) • Dynamic Workspace Roots        │
 ├─────────────────────────────────────────────────────────┤
 │ • Terminal: Real Persistent PowerShell 5.1/7 Sessions   │
 │ • Filesystem: Real Disk CRUD & UTF-8 / Unicode Viewer   │
 │ • Source Control: Real Host Git Operations & Diffing    │
 │ • AI CLIs: Real Claude Code, Gemini CLI, Codex, Agy     │
 │ • Offline Engine: IndexedDB Queue + Explicit Review     │
 └─────────────────────────────────────────────────────────┘
```

---

## Key Features & Product Invariants

1. **Native Windows Desktop Companion**: Packaged as a standard Windows application (`.exe` NSIS installer). Double-click to install with a standard wizard, Start Menu shortcuts, desktop shortcut, and clean uninstaller. No Node.js, Python, or command prompts required by the end user.
2. **Single-Instance Application Window**: Enforced via Electron `requestSingleInstanceLock()`. Launching the application multiple times restores and focuses the existing window rather than spawning duplicate processes or opening infinite windows.
3. **Session-Stable Pairing Key**: Generates a cryptographically secure 6-digit pairing code on companion startup. The key remains stable across window reloads/focus events and is only regenerated upon explicit user request.
4. **Authentic Frontend & Branding**: Embedded React + TypeScript interface utilizing the official Lazy Terminal glassmorphic design system and branding assets.
5. **₹0 MVP & Local-First Invariant**: 100% free and open-source for local Wi-Fi pairing. No mandatory cloud accounts, relay servers, or subscription gates.
6. **Offline Reconciliation Safety**: If connection drops, drafted intents are queued in local IndexedDB. Reconnection **never** auto-executes buffered commands; explicit user review and approval is required before execution.

---

## Windows Application Installation & Deliverables

### End-User Installation (Windows PC)
1. Download **`LazyTerminal-Windows-Setup.exe`** from the web portal or [`public/downloads/`](public/downloads/LazyTerminal-Windows-Setup.exe).
2. Double-click the installer executable to start the NSIS Setup Wizard:
   - **Welcome Screen**: Application details and version notices.
   - **License Agreement**: View and accept the MIT open-source license.
   - **Installation Directory**: Choose install directory (defaults to `%LOCALAPPDATA%\Programs\Lazy Terminal`).
   - **Shortcuts**: Automatically creates Start Menu and optional Desktop shortcuts.
   - **Finish**: Check "Launch Lazy Terminal" to run immediately.
3. The companion starts silently in the background and opens the main window with the dynamic 6-digit pairing code.
4. To uninstall, use **Windows Settings &rarr; Apps &rarr; Installed Apps &rarr; Lazy Terminal &rarr; Uninstall**.

### Mobile App Installation (Android Phone)
1. Download **`LazyTerminal.apk`** from the web portal or [`public/downloads/`](public/downloads/LazyTerminal.apk).
2. Open the `.apk` on your Android device (Android 7.0 / API 21 through Android 15 supported).
3. Ensure phone and PC are connected to the same Wi-Fi network.
4. Enter your PC's IP address (displayed on the Windows companion screen) and the 6-digit pairing key.

---

## Developer Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (`node -v`)
- **Git**: Installed and available on Windows `PATH` (`git --version`)
- **PowerShell**: Windows PowerShell 5.1 or PowerShell 7 (`pwsh`)

### 2. Setup & Development
```powershell
# Clone the repository
git clone https://github.com/ashish-dasiga/LazyTerminal.git
cd LazyTerminal

# Install dependencies
npm install

# Start development companion & frontend
npm run dev
```

### 3. Packaging Standalone Windows Installer
```powershell
# Compiles React frontend, bundles host engine, and generates NSIS installer
npm run build:exe
```
Deliverables produced:
- **Installer Executable**: `dist-installer/LazyTerminal-Windows-Setup.exe`
- **Standalone Unpacked App**: `dist-installer/win-unpacked/Lazy Terminal.exe`
- **Public Download Mirror**: `public/downloads/LazyTerminal-Windows-Setup.exe`

---

## Security Architecture Review: Random Token vs RSA / Public-Key Cryptography

### 1. Evaluation of Current Token Mechanism
- **Entropy & Generation**: Pairing codes are generated via Node.js `crypto.randomInt(100000, 1000000)`, yielding high entropy across a 6-digit space (900,000 combinations) with uniform distribution.
- **Session Tokens**: Upon successful pairing, the host issues an ephemeral HMAC-SHA256 session token (`crypto.randomBytes(32).toString('hex')`). Subsequent API requests must supply `Authorization: Bearer <token>`.
- **Brute-Force & Rate-Limiting**: The host enforces strict sliding-window rate limiting (5 failed attempts within 60 seconds triggers a temporary IP ban), rendering brute-force attacks infeasible.
- **Log Redaction & Transport**: Secrets, session tokens, and passwords are redacted from companion console logs and error payloads via `redactSecrets()`.

### 2. Asymmetric Cryptography (RSA vs ECC vs Token-Based)
| Dimension | 6-Digit CSPRNG Token + HMAC Session | RSA (2048/4096-bit) | Modern ECC (Ed25519 / X25519) |
| :--- | :--- | :--- | :--- |
| **User Experience** | Seamless: User copies/types 6 digits from monitor to phone. | Complex: Requires certificate exchange, QR code scanning, or fingerprint verification. | Streamlined if QR-based; manual input infeasible. |
| **MITM Protection on Local LAN** | High: Attacker must intercept the visual display or compromise the local Wi-Fi within pairing TTL. | High, provided public key is authenticated out-of-band (otherwise vulnerable to MITM). | High, provided public key is authenticated out-of-band. |
| **Computational Overhead** | Negligible: Constant-time integer generation and SHA-256 HMAC. | Moderate to High: Asymmetric keygen, modular exponentiation, and padding overhead. | Very Low: Fast elliptic curve scalar multiplication. |
| **Replay & Revocation** | Ephemeral: In-memory session table; immediate invalidation on key refresh or disconnect. | Requires Certificate Revocation Lists (CRL) or session token revocation anyway. | Requires session token revocation or ephemeral session keys. |

### 3. Recommended Cryptographic Design
1. **Local Wi-Fi Pairing (MVP - Implemented)**: The 6-digit CSPRNG token functions as an out-of-band Short Authentication String (SAS). It authenticates the client session and generates a cryptographically random session bearer token.
2. **Future Wide-Area / Remote Access**: If remote relay or public internet access is introduced in future releases, a hybrid approach using **Noise Protocol Framework (Noise_XX with Curve25519)** or standard **mTLS** should be adopted. RSA is not recommended due to legacy padding pitfalls (PKCS#1 v1.5 vulnerabilities), excessive key sizes, and computational overhead on mobile devices.

---

## Issues Discovered in Ashish's Implementation & Resolutions

| # | Discovered Issue | Root Cause | Engineering Resolution |
|---|---|---|---|
| **1** | Node.js installer instead of Windows app | Packaging script bundled Node SEA / Python Tkinter launcher that required external runtimes. | Implemented Electron desktop shell with `electron-builder` and NSIS wizard generating standalone `.exe`. |
| **2** | Infinite application windows & tokens | App lacked single-instance mutex; opening app or hot-reloading spawned recursive windows and refreshed tokens. | Added `app.requestSingleInstanceLock()` and decoupled pairing key generation from window rendering. |
| **3** | Hardcoded user paths across tests | Scripts had hardcoded `C:\Users\Ashish Dasiga\...` paths for artifacts and SDK tools. | Updated all test suites and build scripts to use dynamic paths (`process.env.USERPROFILE`, `LAZY_TERMINAL_SCREENSHOT_DIR`). |
| **4** | Hardcoded machine hostname in tests | `tests/appsVerification.test.ts` asserted `DESKTOP-WIN11-PRO`. | Replaced hostname check with stable UI selector `text=Relay Desktop Host`. |
| **5** | Mobile connection button disabled in tests | E2E tests only filled pairing input without setting host IP; and submit button text changed to "Authenticate". | Updated Playwright helper to fill `#host-ip-input` and match submit button selector. |
| **6** | Git root boundary traversal | `git rev-parse --show-toplevel` traversed up into parent directories when examining non-git folders. | Set `GIT_CEILING_DIRECTORIES` in `src/host/workspaceRoutes.ts` and `src/server/gitRoutes.ts`. |
| **7** | Portal selector mismatch | `tests/e2ePlaywright.test.ts` looked for obsolete "Mobile App (Android)" tab text. | Updated navigation flow to support both direct `?view=mobile` query and portal direct-link buttons. |

---

## Verification & Test Results Matrix

| Test Suite / Requirement | Result | Verified Capabilities & Evidence |
|---|---|---|
| **Windows Installer Build** | **PASS** | `LazyTerminal-Windows-Setup.exe` (198.9 MB) generated with NSIS wizard, shortcuts, and uninstaller. |
| **Standalone Application Launch** | **PASS** | `dist-installer/win-unpacked/Lazy Terminal.exe` launches with embedded frontend and app icon. |
| **Single-Window Mutex** | **PASS** | `app.requestSingleInstanceLock()` prevents secondary instances and focuses active window. |
| **Token Session Stability** | **PASS** | Session pairing key remains constant; explicit regenerate invalidates old token. |
| **Real Terminal Execution** | **PASS** | Real PowerShell 5.1/7 commands executed (`whoami`, `Get-Location`, exit codes captured). |
| **Working Directory & Paths** | **PASS** | Dynamic workspace selection, paths with spaces handled, directory traversal blocked (403). |
| **Filesystem CRUD & Conflicts** | **PASS** | Real disk read/write, SHA-256 conflict detection (409 on stale write), atomic UTF-8 writes. |
| **Host Git Operations** | **PASS** | Real git status, staging, unstaging, branch listing, and diffs on active branch. |
| **AI Agent CLIs** | **PASS** | Honest detection for Claude Code, Gemini CLI, Codex, and Antigravity with secret redaction. |
| **Playwright E2E Suite** | **PASS** | Full flow: mobile connection, Explorer browsing, file edit, and Git branch verified. |
| **Sync Flow & Token Standby** | **PASS** | Token standby view, token copy, token regenerate, and sync manager state transitions verified. |
| **Offline Mode & Reconciliation** | **PASS** | Intents safely buffered in IndexedDB; never auto-executed on reconnect without user review. |
| **Android APK Package** | **PASS** | Universal APK `LazyTerminal.apk` (189.5 KB) compiled and dual-signed (v1+v2+v3). |
| **Android Emulator** | **BLOCKED** | Hardware virtualization (WHPX / nested KVM) is unavailable in current CI/agent environment. Documented in known limitations. |

---

## Running the Verification Suite

Run all verification suites locally:
```powershell
# 1. Host companion and persistent terminal sessions
npm run test:host

# 2. Filesystem security, git operations, and offline queue
npm test

# 3. CLI detector, dev server preview, and run/debug
npm run test:shreya

# 4. Playwright End-to-End browser verification
node --import tsx tests/e2ePlaywright.test.ts

# 5. Playwright Windows companion sync flow
npm run test:sync

# 6. Playwright Apps token, directory, and auth verification
npm run test:apps

# 7. Simplified download portal verification
npm run test:portal
```

---

## Known Limitations

1. **Android Hardware Emulator**: Running the Android emulator requires Windows Hypervisor Platform (WHPX) or Intel HAXM. When running in containerized or headless environments where nested virtualization is disabled, tests must rely on physical device testing or browser mobile emulation (`?view=mobile`).
2. **AI CLI Cloud Access**: Claude Code and Gemini CLI require valid local credentials or environment API keys (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`). When credentials are not configured on the host machine, the companion honestly reports the tools as unauthenticated rather than returning mock responses.

---

## License

MIT © 2026 Lazy Terminal Contributors.
