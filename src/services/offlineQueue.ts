/**
 * Lazy Terminal — Persistent offline queue backed by IndexedDB (with in-memory fallback for Node tests).
 *
 * Stores command intents locally so they survive page reloads and app
 * restarts. Provides deduplication, sequencing, divergence detection,
 * and state management.
 *
 * Key invariants:
 * - Queued intents are NEVER auto-executed on reconnect.
 * - User must explicitly review and approve each intent before execution.
 * - Duplicate commands within the same sequence window are detected.
 *
 * @module offlineQueue
 */

import { CommandIntent, IntentStatus } from '../types/relay';

const DB_NAME = 'lazy_terminal_offline';
const DB_VERSION = 1;
const STORE_NAME = 'intents';

// In-memory fallback when IndexedDB is unavailable (e.g. Node.js unit test runner)
const memoryStore = new Map<string, CommandIntent>();

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_status', 'status', { unique: false });
        store.createIndex('by_seq', 'seq', { unique: false });
        store.createIndex('by_project', 'projectName', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  const tx = db.transaction(STORE_NAME, mode);
  return tx.objectStore(STORE_NAME);
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putRecord(intent: CommandIntent): Promise<void> {
  if (!hasIndexedDB()) {
    memoryStore.set(intent.id, { ...intent });
    return;
  }
  const db = await openDb();
  const store = txStore(db, 'readwrite');
  await reqToPromise(store.put(intent));
  db.close();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type EnqueueIntentInput = Omit<CommandIntent, 'id' | 'seq' | 'timestamp' | 'status'> &
  Partial<Pick<CommandIntent, 'id' | 'seq' | 'timestamp' | 'status'>>;

/**
 * Add a new intent to the persistent queue.
 * Preserves caller-supplied id/seq/timestamp when provided so React state
 * and IndexedDB stay in lockstep, while deduplicating rapid identical commands.
 */
export async function enqueueIntent(partial: EnqueueIntentInput): Promise<CommandIntent> {
  const all = await listIntents();
  const maxSeq = all.length > 0 ? Math.max(...all.map((i) => i.seq)) : 0;
  const now = partial.timestamp ?? Date.now();

  // Check for duplicate: same command + same project within last 5 seconds
  const existingDuplicate = all.find(
    (existing) =>
      existing.command === partial.command &&
      existing.projectName === partial.projectName &&
      existing.status === 'queued' &&
      Math.abs(now - existing.timestamp) < 5000,
  );

  if (existingDuplicate) {
    return existingDuplicate;
  }

  const intent: CommandIntent = {
    ...partial,
    id: partial.id ?? `intent-${now}-${Math.random().toString(36).substring(2, 8)}`,
    seq: partial.seq ?? maxSeq + 1,
    timestamp: now,
    status: partial.status ?? 'queued',
  };

  await putRecord(intent);
  return intent;
}

/**
 * Seed initial intents if the persistent store is currently empty,
 * or return the already-persisted intents.
 */
export async function seedOrListIntents(defaults: CommandIntent[]): Promise<CommandIntent[]> {
  const existing = await listIntents();
  if (existing.length > 0) {
    return existing;
  }
  for (const item of defaults) {
    await putRecord(item);
  }
  return listIntents();
}

/**
 * Read all intents from the persistent store, sorted by sequence number ascending.
 */
export async function listIntents(): Promise<CommandIntent[]> {
  if (!hasIndexedDB()) {
    return Array.from(memoryStore.values()).sort((a, b) => a.seq - b.seq);
  }
  const db = await openDb();
  const store = txStore(db, 'readonly');
  const items = await reqToPromise(store.getAll());
  db.close();
  return (items as CommandIntent[]).sort((a, b) => a.seq - b.seq);
}

/**
 * Update the status of a single intent.
 */
export async function updateIntentStatus(
  id: string,
  status: IntentStatus,
  extra?: Partial<Pick<CommandIntent, 'resultOutput' | 'executionDurationMs' | 'divergenceDetails'>>,
): Promise<CommandIntent | null> {
  if (!hasIndexedDB()) {
    const existing = memoryStore.get(id);
    if (!existing) return null;
    const updated: CommandIntent = {
      ...existing,
      status,
      ...(extra || {}),
    };
    memoryStore.set(id, updated);
    return updated;
  }

  const db = await openDb();
  const store = txStore(db, 'readwrite');
  const existing = (await reqToPromise(store.get(id))) as CommandIntent | undefined;

  if (!existing) {
    db.close();
    return null;
  }

  const updated: CommandIntent = {
    ...existing,
    status,
    ...(extra || {}),
  };

  await reqToPromise(store.put(updated));
  db.close();
  return updated;
}

/**
 * Compare queued intents against the current PC project branch and HEAD commit.
 * Marks intents as 'diverged' when the underlying repository state changed while offline.
 */
export async function detectDivergedIntents(
  actualBranch: string,
  actualCommit: string,
  projectName?: string,
  dirtyFilesCount: number = 0,
): Promise<CommandIntent[]> {
  const cleanBranch = actualBranch.replace(/^\*/, '');
  const all = await listIntents();

  for (const intent of all) {
    if (intent.status !== 'queued') continue;
    if (projectName && intent.projectName !== projectName) continue;

    const branchMismatch = intent.expectedBaseBranch.replace(/^\*/, '') !== cleanBranch;
    const commitMismatch = intent.expectedHeadCommit !== actualCommit;

    if (branchMismatch || commitMismatch) {
      const reason = branchMismatch
        ? `Target branch changed from '${intent.expectedBaseBranch}' to '${cleanBranch}' on PC.`
        : `HEAD commit advanced from ${intent.expectedHeadCommit} to ${actualCommit} on PC.`;
      await updateIntentStatus(intent.id, 'diverged', {
        divergenceDetails: {
          reason,
          pcCurrentBranch: cleanBranch,
          pcDirtyFiles: dirtyFilesCount,
          diffSnippet: `expected ${intent.expectedBaseBranch}@${intent.expectedHeadCommit} -> actual ${cleanBranch}@${actualCommit}`,
          suggestedResolution: branchMismatch ? 'skip' : 'rebase',
        },
      });
    }
  }

  return listIntents();
}

/**
 * Delete a single intent from the queue.
 */
export async function deleteIntent(id: string): Promise<void> {
  if (!hasIndexedDB()) {
    memoryStore.delete(id);
    return;
  }
  const db = await openDb();
  const store = txStore(db, 'readwrite');
  await reqToPromise(store.delete(id));
  db.close();
}

/**
 * Clear all intents from the queue.
 */
export async function clearAllIntents(): Promise<void> {
  if (!hasIndexedDB()) {
    memoryStore.clear();
    return;
  }
  const db = await openDb();
  const store = txStore(db, 'readwrite');
  await reqToPromise(store.clear());
  db.close();
}

/**
 * Get only intents that need user review (queued or diverged).
 */
export async function getPendingIntents(): Promise<CommandIntent[]> {
  const all = await listIntents();
  return all.filter((i) => i.status === 'queued' || i.status === 'diverged');
}

/**
 * Count intents by status for summary display.
 */
export async function getIntentCounts(): Promise<Record<IntentStatus, number>> {
  const all = await listIntents();
  const counts: Record<string, number> = {
    queued: 0,
    dependency_blocked: 0,
    diverged: 0,
    reconciled: 0,
    skipped: 0,
    cancelled: 0,
    executing: 0,
    failed: 0,
  };
  for (const intent of all) {
    counts[intent.status] = (counts[intent.status] || 0) + 1;
  }
  return counts as Record<IntentStatus, number>;
}
