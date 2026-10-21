# Decisions and Open Questions

## Confirmed requirements
- [x] Two final products: Android APK and Windows EXE.
- [x] Terminal-first mobile workspace after pairing.
- [x] Persistent compact navigation.
- [x] Fresh random PC-generated secret on each communication-service startup.
- [x] No localhost browser dashboards or user workflow dependent on ports such as 8008/8080.
- [x] No mandatory paid infrastructure; target cost ₹0.
- [x] PC commands execute only when PC is available.
- [x] Offline task queue and reviewable reconnect sync.
- [x] Optional cloud mode must be separated and cost-disclosed.
- [x] User frontend will be provided as `.dht`; inspect and preserve.
- [x] Approved workflow image is `assets/workflow_diagram.png`.
- [x] Comprehensive deployment hardening is a later phase; baseline protections remain mandatory during development.

## Open: implementation stack
Status: OPEN
Inspect the actual frontend artifact and repository before choosing frameworks.

## Open: transport
Status: OPEN
Compare native app-to-app options. Account for LAN vs internet reachability, Windows firewall/NAT, streaming, files, cost, and the no-localhost-dashboard constraint. No paid relay by default.

## Open: CLI support matrix
Status: OPEN
Validate each provider's current Windows installation, launch, authentication, and usage reporting capabilities. Do not assume feature parity.

## Open: optional cloud execution
Status: OPEN
Verify current free-tier and billing terms before enabling. If no sustainable no-cost path is verified, leave disabled and document why.

## Open: first preview target
Status: OPEN
Choose an actual supported project type for the first working preview. Do not claim universal native app preview.
