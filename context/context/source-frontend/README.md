# Remote Development System — Frontend Architecture & Integration Guide

A production-ready dual-frontend implementation of the **Remote Development System** designed strictly to the architecture flowchart.

This project delivers **two distinct, backend-ready applications**:
1. **Mobile App (Android Client):** Handheld phone client featuring the complete 3-step connection sequence (Login → PC Key Entry → Direct Terminal Landing), persistent hamburger navigation drawer, full-screen ANSI terminal with shortcut accessory bar, folder navigation with drilldown/editing/saving, Git staging, CLI discovery, preview runner, and offline queueing with honest reconciliation.
2. **Laptop App (Windows Desktop Host):** Widescreen workstation cockpit displaying PC host status, background daemon controls, connection key generation, repository workspace index, sync & pending change review cockpit, and backend integration hub.

---

## 1. Architectural Boundaries: Frontend vs. Backend

> **CRITICAL ARCHITECTURAL PRINCIPLE:**
> - **Frontend Scope (This Codebase):** 100% of the UI screens, responsive layouts, forms, validation states, local offline queue representations, touch controls, and navigation transitions.
> - **Backend Scope (External Developer):** The native Windows host daemon (ConPTY shell execution, Ed25519 cryptographic key exchange, TLS 1.3 socket tunneling, local filesystem I/O, Git process wrapper, and cloud worker sandbox).
> - **Integration Decoupling:** Frontend components **never** perform direct hardware/shell calls. They interact exclusively with the standard service contracts in `/src/services/contracts.ts` via the adapter pattern in `/src/services/index.ts`. All mock behaviors are isolated in `/src/services/mockAdapter.ts`.

---

## 2. Project Folder Structure

```
├── architecture.md               # Complete backend developer specification & data contracts
├── README.md                     # Frontend architecture, navigation, setup, and checklist
├── package.json                  # Dependencies (React 19, Tailwind CSS 4, Lucide Icons)
├── tsconfig.json                 # Strict TypeScript configuration
├── vite.config.ts                # Vite bundler configuration
├── server.js                     # Static asset preview server for production hosting
├── index.html                    # HTML entry point with system fonts & metadata
├── src/
│   ├── App.tsx                   # Master container hosting Android & Windows viewports
│   ├── main.tsx                  # React DOM root entry point
│   ├── index.css                 # Global styling, custom scrollbars, and dark theme variables
│   │
│   ├── context/
│   │   └── RelayContext.tsx      # Central reactive application state & adapter orchestration
│   │
│   ├── types/
│   │   └── relay.ts              # Domain entity models (Project, Session, File, Intent, User)
│   │
│   ├── services/
│   │   ├── contracts.ts          # Typed service contracts for the 8 system domains
│   │   ├── mockAdapter.ts        # Pluggable development mock adapter implementing contracts
│   │   ├── mockDaemon.ts         # ANSI escape parser & realistic CLI output simulator
│   │   └── index.ts              # Service locator and singleton adapter provider
│   │
│   ├── screens/
│   │   ├── TerminalScreen.tsx    # Flowchart #4: Dominant ANSI terminal & multi-session selector
│   │   ├── ExplorerScreen.tsx    # Flowchart #5: File tree, folder navigation, editor & Open With
│   │   ├── SourceControlScreen.tsx# Flowchart #3: Git status, diff viewer, staging & commits
│   │   ├── RunDebugScreen.tsx    # Flowchart #3: Task runner, port forwards & debug launcher
│   │   ├── PreviewScreen.tsx     # Flowchart #5: Live web preview, Python runner & desktop stream
│   │   ├── OfflineQueueScreen.tsx# Flowchart #6: Offline draft prompts, SQLite queue & cloud mode
│   │   ├── CliManagerScreen.tsx  # Flowchart #4: Claude Code, OpenAI Codex & Gemini CLI catalog
│   │   ├── SettingsScreen.tsx    # Flowchart #3: Account, PC connection key & terminal prefs
│   │   ├── MoreScreen.tsx        # Flowchart #3: Secondary navigation hub & tool directory
│   │   ├── PairingScreen.tsx     # Cryptographic pairing & Ed25519 security hub
│   │   ├── ProjectsScreen.tsx    # Multi-repo workspace selector
│   │   └── LaptopApp.tsx         # Flowchart #1B & #7: Complete Windows desktop interface
│   │
│   └── components/
│       ├── MobileConnectionFlow.tsx  # Flowchart #2: 3-step setup (Login -> Key -> Terminal)
│       ├── NavigationDrawer.tsx      # Flowchart #3: Persistent 7-section hamburger drawer
│       ├── BottomNavigation.tsx      # Flowchart #3: Quick bottom tabs (Terminal, Files, Git, Preview, More)
│       ├── DevicePresenceBar.tsx     # Compact top bar with live PC telemetry & drawer triggers
│       ├── ReconciliationModal.tsx   # Flowchart #6: Reconnection diff & execution prompt
│       ├── ProjectSwitchDrawer.tsx   # Workspace switcher bottom sheet
│       ├── SessionDrawer.tsx         # Multi-session switcher drawer
│       ├── DeveloperAccessoryBar.tsx # Quick terminal shortcuts (Esc, Tab, Ctrl+C, Ctrl+D, arrows)
│       └── CliMissingInterceptor.tsx # Inline prompt when an uninstalled CLI tool is called
```

---

## 3. Screen Navigation & Flowchart Compliance

### A. Mobile Connection Flow (Flowchart Section 2)
1. **App Launch:** If not connected, the user is presented with the 3-step `MobileConnectionFlow`.
2. **Step 1 — Account Login:** User logs in with email and password credentials. Validates format and advances to step 2.
3. **Step 2 — PC Connection Key Entry:** User enters the 6-digit key generated on the Windows laptop app (e.g., `784-291`).
   - Includes *Connecting*, *Validating*, *Success*, *Invalid-Key Error*, and *Retry* states.
   - Includes a *Quick Autofill Key* button for seamless development demonstration.
   - Includes a *Back to Login* button to navigate back.
4. **Step 3 — Terminal Landing:** On successful key validation, the connection transitions to `connected` and immediately opens the full-screen Terminal.

### B. Mobile Navigation (Flowchart Section 3)
- **Top-Left Hamburger Menu:** Slides open a persistent drawer containing the **7 required sections**:
  1. `Explorer`
  2. `Terminal`
  3. `Source Control`
  4. `Run / Debug`
  5. `Preview`
  6. `Settings`
  7. `More options`
- **Bottom Navigation Bar:** Immediate access to high-frequency screens:
  - `Terminal` · `Explorer` · `Git` · `Preview` · `More`
- **Back Navigation:** Every subscreen and nested view includes a clear Back button (`← Back to Terminal` / `← Back to Directory` / `← Back to Overview`).

### C. Explorer & File Management (Flowchart Section 5)
- **Folder Navigation:** Tap any directory to navigate into subfolders with breadcrumb path navigation and a prominent `← Back to parent` button.
- **File Editing:** Tap any file to open the built-in syntax-highlighted code editor.
- **Save Actions:** Clear Save button with unsaved change badges (`● Unsaved edits`), line numbers, and character counts.
- **File Creation:** Dedicated dialogs for `+ New File` and `+ New Text File (.txt)`.
- **Open With… Action:** Contextual menu offering *Built-in Editor*, *Terminal Pager (`cat`)*, *Hex / Binary Inspector*, or *External System Default*.

### D. Offline Intent Queue & Honest States (Flowchart Section 6)
- **Honest State Guarantee:** When the PC is toggled offline, commands and prompts typed into the terminal are **never faked as executed**. They are tagged with `[OFFLINE INTENT BUFFERED]` and written to the SQLite queue.
- **Queue Cockpit:** Users can view pending items, draft new commands offline, see sequence numbers and causal hashes, and delete or reorder intents.
- **Cloud Mode Fallback:** Optional toggle to route intents to cloud runners with explicit configuration indicators.
- **Reconnection Reconciliation:** When the PC reconnects, a reconciliation prompt lets the developer review pending changes, inspect diffs, confirm execution, or skip items.

### E. Laptop App (Windows Desktop Host) (Flowchart Section 1B & 7)
- Switch seamlessly to the Windows Desktop frontend using the top-bar view switcher (`Laptop App (Windows)`).
- **Host Status & Controls:** Shows live IP, port bindings, CPU, RAM, and a Start/Stop Daemon toggle.
- **Connection Key Display:** Large display of the generated 6-digit pairing token with copy and regenerate actions.
- **Workspace Cards:** Active repository status, branch, dirty files, and commit logs.
- **Sync & Pending Interface:** Complete desktop review table for offline intents drafted from the phone, showing execution progress, and returned output.
- **Backend Error States:** Interactive toggles to simulate daemon errors and phone disconnect alerts.

---

## 4. Backend Developer Integration Points

For the backend engineer implementing the native Windows daemon or relay server:
Refer to [`architecture.md`](./architecture.md) for full endpoint specifications, request/response payloads, and transport protocols.

### Summary of Service Contracts to Implement:
| Contract Name | Responsibility | Transport |
|---|---|---|
| `IAuthService` | User login, logout, profile, token refresh | HTTPS REST |
| `IConnectionService` | Windows key generation, key validation, tunnel setup | Local IPC & WebSocket |
| `ITerminalService` | ConPTY process spawning, command execution, signals | WebSocket (ConPTY stdin/stdout) |
| `IFileSystemService` | Directory listing, file read, write, create, delete | REST / Local FS RPC |
| `IGitService` | Git status, stage, commit, branch switch, push/pull | Git CLI / libgit2 wrapper |
| `ICliService` | CLI detection (Claude Code, Codex, Gemini), install | Windows `%PATH%` query & npm/cargo |
| `IPreviewService` | Local dev server tunnel, Python runner, app streaming | Port forwarding & WebRTC |
| `ISyncService` | Offline intent buffer, causal check, cloud fallback | SQLite WAL & replay worker |

To connect your backend:
1. Implement `RealRelayBackendAdapter` conforming to `IRelayBackendAdapter`.
2. Update `src/services/index.ts` to return your live adapter instance.
3. No UI components need to be changed!

---

## 5. Development & Verification Commands

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server on port 3000
npm run dev

# 3. Validate TypeScript types across the entire project
npm run lint

# 4. Compile production bundle
npm run build
```
