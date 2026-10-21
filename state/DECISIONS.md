# Lazy Terminal — Architectural Decisions Record (ADR)

## ADR-001: LAN-First Local Companion Architecture
- **Context:** The system requires a phone-native developer companion that operates against a Windows PC workstation without requiring costly cloud relays or latency overhead.
- **Decision:** The Windows PC runs an Express-based Host Companion daemon (`companionServer.ts` / `server.ts`) listening on local ports (3000 / 9871). The phone connects directly over Wi-Fi / LAN using REST and Server-Sent Events (SSE).
- **Consequences:** Eliminates external server costs (₹0 MVP). Requires both devices to reside on the same subnet.

## ADR-002: Dynamic Host Origin Resolution & Fallback
- **Context:** Hardcoded `http://localhost:9871` caused network failures when clients were served over dynamic ports, mobile IP addresses, or PWA standalone contexts.
- **Decision:** Updated `src/services/config.ts` to inspect `window.location.origin` dynamically when running in a browser before falling back to environment variables or default ports.
- **Consequences:** Allows instant pairing regardless of host IP or port assignment without manual client configuration.

## ADR-003: Safe Path Traversal Sandboxing & Placeholder Workspace Mapping
- **Context:** Client state uses placeholder workspace paths (`C:\Projects\hyper-relay`), but companion hosts run from arbitrary working directories. Also, malicious path inputs (`../../etc/passwd`) must be blocked.
- **Decision:** Enforced `validateSafePath` in `src/server/fsSecurity.ts` which restricts operations to `getAllowedRoots()`, rejects null bytes and Windows device names (`CON`, `NUL`), and transparently maps placeholder paths to active workspace roots.
- **Consequences:** Protects the host machine while providing seamless demo and real-world repository browsing.

## ADR-004: Strict Offline Reconnection Non-Auto-Execution Invariant
- **Context:** When network connectivity is lost, actions queue locally in the phone's intent queue. Auto-executing queued git commits or shell commands upon reconnecting can cause race conditions or merge conflicts.
- **Decision:** Product Invariant 4 dictates that intents remain queued until explicit manual user review via the `ReconciliationModal`.
- **Consequences:** Zero accidental command executions; divergence detection warns the developer if the host Git HEAD moved while offline.

## ADR-005: Dual-Frontend Web Installation & Distribution Portal
- **Context:** Developers need an easy way to install the mobile app (PWA or APK) and the Windows companion (.bat / .ps1 / .zip) while preserving the exact supplied interfaces.
- **Decision:** Created an install portal frontend view accessible at the top application bar (`Install & Setup`), with direct one-click PWA installation, QR code scanning, and companion downloads, alongside the existing Mobile App and Laptop App views.
- **Consequences:** Provides a seamless onboarding experience matching the `icon.jpeg` dark carbon aesthetic while keeping the original mobile and laptop app layouts untouched.
