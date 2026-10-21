/**
 * Lazy Terminal — Persistent offline queue backed by IndexedDB.
 *
 * Stores command intents locally so they survive page reloads and app
 * restarts.  Provides deduplication, sequencing, and state management.
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a new intent to the persistent queue.
 * Returns the created intent with an assigned id and sequence number.
 */
export async function enqueueIntent(
  partial: Omit<CommandIntent, 'id' | 'seq' | 'timestamp' | 'status'>,
): Promise<CommandIntent> {
  const db = await openDb();

  // Get current max sequence number
  const all = await getAllIntents(db);
  const maxSeq = all.length > 0 ? Math.max(...all.map((i) => i.seq)) : 0;

  // Check for duplicate: same command + same project within last 5 seconds
  const now = Date.now();
  const isDuplicate = all.some(
    (existing) =>
      existing.command === partial.command &&
      existing.projectName === partial.projectName &&
      existing.status === 'queued' &&
      now - existing.timestamp < 5000,
  );

  if (isDuplicate) {
    // Return the existing queued intent rather than creating a duplicate
    const existing = all.find(
      (e) =>
        e.command === partial.command &&
        e.projectName === partial.projectName &&
        e.status === 'queued',
    )!;
    db.close();
    return existing;
  }

  const intent: CommandIntent = {
    ...partial,
    id: `intent-${now}-${Math.random().toString(36).substring(2, 8)}`,
    seq: maxSeq + 1,
    timestamp: now,
    status: 'queued',
  };

  const store = txStore(db, 'readwrite');
  await reqToPromise(store.put(intent));
  db.close();
  return intent;
}

/**
 * Read all intents from the persistent store.
 */
export async function listIntents(): Promise<CommandIntent[]> {
  const db = await openDb();
  const result = await getAllIntents(db);
  db.close();
  return result;
}

async function getAllIntents(db: IDBDatabase): Promise<CommandIntent[]> {
  const store = txStore(db, 'readonly');
  const items = await reqToPromise(store.getAll());
  // Sort by sequence number ascending
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
  const db = await openDb();
  const store = txStore(db, 'readwrite');
  const existing = await reqToPromise(store.get(id)) as CommandIntent | undefined;

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
 * Delete a single intent from the queue.
 */
export async function deleteIntent(id: string): Promise<void> {
  const db = await openDb();
  const store = txStore(db, 'readwrite');
  await reqToPromise(store.delete(id));
  db.close();
}

/**
 * Clear all intents from the queue.
 */
export async function clearAllIntents(): Promise<void> {
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
