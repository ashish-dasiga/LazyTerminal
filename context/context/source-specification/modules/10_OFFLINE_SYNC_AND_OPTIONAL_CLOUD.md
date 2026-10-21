# Module 10 — Offline Queue, Reconnection, and Optional Cloud Execution

## 10.1 Three separate modes
### PC mode
Commands and CLIs run on the Windows PC against PC files.

### Offline mobile mode
The phone can draft prompts, edit cached copies, and queue tasks. PC-dependent tasks do not execute while the PC is off.

### Optional cloud mode
A configured remote workspace may execute supported work while the PC is off. It is a separate environment with its own files, authentication, tools, quotas, and limits.

## 10.2 Durable queue
Each queued task should have:
- Stable unique ID
- Creation time
- Project/workspace identity
- Task type and payload
- Working directory
- Dependency/order metadata
- Base file hash/version where relevant
- Approval status
- Execution status
- Result/error reference

Persist queue records and local edits across Android restarts.

## 10.3 Reconnection workflow
1. PC service becomes reachable.
2. Android and PC exchange capabilities and pending-state summaries.
3. App shows a sync request.
4. User reviews pending tasks and file changes.
5. Detect base-version mismatch and conflicting edits.
6. User confirms which changes/tasks to apply.
7. Apply approved file changes safely.
8. Execute approved PC tasks in dependency order.
9. Stream output and update status.
10. Retain failed/conflicted tasks for review or retry.

Do not auto-execute an unrestricted queue simply because the PC came online.

## 10.4 State semantics
Suggested states: `draft`, `queued`, `needs_review`, `approved`, `syncing`, `conflict`, `ready`, `running`, `succeeded`, `failed`, `cancelled`.

The app must never show a PC-bound task as `running` or `succeeded` while the PC is unavailable.

## 10.5 Cloud mode and ₹0 constraint
- No AWS or paid service as a mandatory dependency.
- Research the current terms, quota, storage, runtime, and billing requirements of any proposed provider.
- A free tier is not the same as unlimited use.
- Do not enable a provider that can cause unexpected charges by default.
- If a suitable no-cost path cannot be verified, leave cloud mode disabled behind an adapter and document the limitation.
- Do not assume every requested CLI can run in a cloud container.
- Keep cloud changes separate until the user reviews and synchronizes them with the PC project.

## 10.6 Conflict handling
Detect conflicts for:
- Same file edited locally and in cloud
- PC file changed since mobile cached it
- Git branch diverged
- Task depends on a previous task that failed
- Duplicate/retried task delivery

Offer review/merge/manual resolution. Do not silently discard either side.

## 10.7 Acceptance
Offline work persists; PC reconnect triggers review; conflicts are visible; approved work executes on the correct environment; no mandatory paid service is introduced.
