# Protocol and Data Contract

This is a contract-level guide, not a commitment to a particular wire format. Select a typed representation compatible with the chosen stack and document it.

## Message envelope
- `protocol_version`: required
- `message_id`: unique identifier
- `request_id`: identifier for a request/response pair when applicable
- `message_type`: enumerated message family
- `session_id`: required after pairing
- `sent_at`: timestamp
- `payload`: type-specific data
- `error`: structured error object when applicable

## Terminal request
Fields conceptually include session ID, terminal session ID, input text, working directory reference, and input mode. The PC validates the requested directory and returns sequenced output events and process exit status.

## Filesystem request
Use a normalized relative path or an opaque authorized file reference where possible. Include operation type and expected base version/hash for writes. PC returns metadata/content or a structured error.

## Queue task
- Stable task ID
- Task type
- Project reference
- Working directory
- Payload
- Created time
- Dependencies/order
- Base file hashes/versions
- Approval state
- Execution state
- Result/error reference

## Sync request
- Pending task IDs and summaries
- Pending file operations and base versions
- PC/project identity
- Protocol version
- User review/approval status

## Idempotency and ordering
- Retried requests must not accidentally execute the same destructive task twice.
- Output streams should be sequenced.
- Task dependencies must be respected.
- Partial sync must be recoverable.
- Cancellation and timeout must have explicit states.

## Error object
Use a stable code, safe user-facing message, retryability indicator, and optional diagnostic details. Never include secrets or provider tokens.

## Suggested error codes
`INVALID_PAIRING_SECRET`, `PC_UNREACHABLE`, `SESSION_EXPIRED`, `PROTOCOL_UNSUPPORTED`, `PATH_NOT_ALLOWED`, `FILE_CONFLICT`, `CLI_NOT_INSTALLED`, `AUTH_REQUIRED`, `PROCESS_START_FAILED`, `PROCESS_EXIT_NONZERO`, `SYNC_INTERRUPTED`, `GIT_CONFLICT`, `CLOUD_QUOTA_EXHAUSTED`, `PREVIEW_UNSUPPORTED`.
