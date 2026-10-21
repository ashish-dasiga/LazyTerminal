# Module 12 — Dependencies, Configuration, Build, Testing, and Packaging

## 12.1 Stack selection rule
Do not select a framework blindly. First inspect the existing repository and the user-supplied `.dht` frontend artifact. Then compare candidate stacks for:
- Android APK build reliability
- Windows EXE packaging
- Frontend compatibility
- Native process/network/file access
- Maintainability and tests
- Dependency licensing
- Offline build feasibility
- Total cost

Record the decision and rationale before implementation.

## 12.2 Dependency register
For every direct dependency, document:
- Name and version/range
- Purpose
- License
- Build/runtime requirement
- Whether it downloads at runtime
- Whether it sends data externally
- Whether it requires an account
- Whether it can incur cost
- Replacement/removal strategy

Prefer maintained free/open-source dependencies and platform APIs. Avoid adding dependencies “just in case.”

## 12.3 Environment configuration
- `.env.example` documents names and safe placeholders only.
- `.env` is ignored by Git.
- Never commit provider tokens, passwords, private keys, signing credentials, or production secrets.
- Pairing secret is generated at runtime by the PC app; it is not an environment variable.
- Do not embed cloud credentials in the Android APK.
- Optional cloud credentials are user-configured only if the provider is explicitly enabled.

## 12.4 `.gitignore`
Exclude:
- `.env` and secret files
- build outputs
- logs and caches
- local IDE settings
- runtime data
- Android/Gradle, Node, Python, or .NET generated files if those technologies are used

Do not ignore project docs, state files, tests, or the workflow image.

## 12.5 Testing plan
### Unit tests
- Secret generation and lifecycle
- Protocol validation
- Queue transitions
- Path normalization/authorization
- File conflict detection
- Retry/idempotency behaviour

### Integration tests
- Shell process lifecycle and streaming
- File read/write
- Git operations
- CLI detection and launch
- Pairing success/failure
- Reconnection and sync
- Preview lifecycle

### UI tests
- Connection form and errors
- Terminal default view
- Persistent navigation
- Offline queue and sync review
- Conflict resolution
- Preview status

### Packaging tests
- Clean Windows installation/uninstallation
- EXE startup and secret display
- APK installation on a supported Android device
- Upgrade/restart behaviour
- Dependency absence and recovery messages

## 12.6 Build and release outputs
- Android APK
- Windows EXE installer
- Build instructions
- Version/dependency record
- Test report
- Known limitations
- Release checklist

Do not commit generated installers/APKs unless the repo explicitly intends to version releases.

## 12.7 Acceptance
Both installables build reproducibly; tests and dependency rationale are documented; no secret is committed; no paid service is mandatory.
