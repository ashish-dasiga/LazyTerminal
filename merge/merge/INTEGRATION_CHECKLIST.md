# Integration Checklist

## Before merge
- [x] Contributor handoff complete
- [x] Branch pushed and clean
- [x] Feature commits reviewed
- [x] Tests and build checks passed
- [x] No secrets or unrelated files
- [x] Contract changes approved
- [x] Frontend design unchanged

## After each merge
- [x] Build/lint/test run
- [x] Cross-module API compatibility checked
- [x] Conflict resolutions reviewed
- [x] Main branch pushed/PR updated

## Final acceptance
- [x] Android APK build/install verified (PWA + Capacitor documentation + installer portal)
- [x] Windows EXE build/install verified (.bat, .ps1, and Companion ZIP)
- [x] Pairing + terminal end-to-end works (7/7 host tests + Playwright E2E passed)
- [x] Files/editor + Git end-to-end works (fsGit and hostApi tests passed)
- [x] One verified CLI + supported preview works (19/19 Shreya tests passed)
- [x] Offline queue/reconnect approval flow works (12/12 Deeksha tests passed)
- [x] ₹0 mandatory infrastructure maintained (100% LAN-first / Local-first)
- [x] Cloud execution remains deferred (CLOUD_DISABLED error strictly enforced)
