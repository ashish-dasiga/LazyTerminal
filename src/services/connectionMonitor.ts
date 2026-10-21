/**
 * Lazy Terminal — Connection state monitor.
 *
 * Tracks the connection to the Windows PC companion, detects
 * disconnections, marks cached data as stale, and triggers
 * reconciliation prompts on reconnect.
 *
 * Key invariants:
 * - NEVER auto-execute queued commands on reconnect.
 * - Mark data as stale when connection is lost.
 * - Prompt user review when connection is restored and pending intents exist.
 *
 * @module connectionMonitor
 */

import { getAppConfig } from './config';

export type ConnectionState =
  | 'connected'       // Active session with PC host
  | 'connecting'      // Attempting to establish connection
  | 'disconnected'    // No connection to PC host
  | 'reconnecting';   // Lost connection, attempting to restore

export interface ConnectionStatus {
  state: ConnectionState;
  /** Timestamp of last successful communication */
  lastSeenAt: number | null;
  /** Whether cached/displayed data may be stale */
  isDataStale: boolean;
  /** Number of consecutive failed health checks */
  failedChecks: number;
  /** Last error message if any */
  lastError: string | null;
}

type ConnectionListener = (status: ConnectionStatus) => void;

// ---------------------------------------------------------------------------
// Monitor singleton
// ---------------------------------------------------------------------------

let currentStatus: ConnectionStatus = {
  state: 'disconnected',
  lastSeenAt: null,
  isDataStale: true,
  failedChecks: 0,
  lastError: null,
};

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<ConnectionListener>();

const HEALTH_CHECK_INTERVAL_MS = 5_000;
const STALE_THRESHOLD_MS = 15_000; // data stale after 15s without contact
const MAX_FAILED_CHECKS = 3; // mark disconnected after 3 failures

/**
 * Get the current connection status snapshot.
 */
export function getConnectionStatus(): ConnectionStatus {
  return { ...currentStatus };
}

/**
 * Subscribe to connection status changes.
 * Returns an unsubscribe function.
 */
export function onConnectionChange(listener: ConnectionListener): () => void {
  listeners.add(listener);
  // Immediately notify with current status
  listener({ ...currentStatus });
  return () => listeners.delete(listener);
}

function notifyListeners(): void {
  const snapshot = { ...currentStatus };
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      // listener errors should not break the monitor
    }
  });
}

/**
 * Update connection state and notify listeners.
 */
function updateState(partial: Partial<ConnectionStatus>): void {
  const prev = currentStatus.state;
  currentStatus = { ...currentStatus, ...partial };

  // Auto-detect stale data:
  // If disconnected or reconnecting, cached PC data is always potentially stale.
  if (currentStatus.state === 'disconnected') {
    currentStatus.isDataStale = true;
  } else if (currentStatus.state === 'connected' && currentStatus.lastSeenAt) {
    const elapsed = Date.now() - currentStatus.lastSeenAt;
    currentStatus.isDataStale = elapsed > STALE_THRESHOLD_MS;
  }

  notifyListeners();

  // Log state transitions in dev
  if (prev !== currentStatus.state) {
    const config = getAppConfig();
    if (config.debugLogging) {
      console.log(`[connectionMonitor] ${prev} → ${currentStatus.state}`);
    }
  }
}

/**
 * Mark the connection as established after successful pairing/connect.
 */
export function markConnected(): void {
  updateState({
    state: 'connected',
    lastSeenAt: Date.now(),
    isDataStale: false,
    failedChecks: 0,
    lastError: null,
  });
}

/**
 * Mark the connection as lost (user-initiated disconnect or detected failure).
 */
export function markDisconnected(reason?: string): void {
  updateState({
    state: 'disconnected',
    isDataStale: true,
    lastError: reason || null,
  });
}

/**
 * Record a successful health check / response from the PC.
 */
export function recordSuccessfulContact(): void {
  const wasDisconnected = currentStatus.state === 'reconnecting' || currentStatus.state === 'disconnected';
  updateState({
    state: 'connected',
    lastSeenAt: Date.now(),
    isDataStale: false,
    failedChecks: 0,
    lastError: null,
  });

  // If we were disconnected and are now connected, this is a reconnect event.
  // The UI should check for pending intents and prompt reconciliation.
  // We do NOT auto-execute anything here.
  if (wasDisconnected) {
    const config = getAppConfig();
    if (config.debugLogging) {
      console.log('[connectionMonitor] Reconnected — UI should prompt reconciliation if pending intents exist');
    }
  }
}

/**
 * Record a failed health check.
 */
export function recordFailedContact(error?: string): void {
  const newCount = currentStatus.failedChecks + 1;
  if (newCount >= MAX_FAILED_CHECKS) {
    updateState({
      state: 'disconnected',
      failedChecks: newCount,
      isDataStale: true,
      lastError: error || 'PC host unreachable',
    });
  } else {
    updateState({
      state: 'reconnecting',
      failedChecks: newCount,
      lastError: error || null,
    });
  }
}

/**
 * Start periodic health checks against the PC host.
 * Uses a simple HTTP ping to the host status endpoint.
 */
export function startHealthChecks(): void {
  stopHealthChecks();

  healthCheckInterval = setInterval(async () => {
    // Only check when we think we're connected or reconnecting
    if (currentStatus.state === 'disconnected' && currentStatus.failedChecks === 0) {
      return;
    }

    const config = getAppConfig();
    if (config.adapterMode === 'mock') {
      // In mock mode, always consider connected
      recordSuccessfulContact();
      return;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${config.hostBaseUrl}/api/v1/host/status`, {
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        recordSuccessfulContact();
      } else {
        recordFailedContact(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      recordFailedContact(err.message);
    }
  }, HEALTH_CHECK_INTERVAL_MS);
}

/**
 * Stop periodic health checks.
 */
export function stopHealthChecks(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

/**
 * Check if the current data should be displayed with a stale indicator.
 */
export function isDataStale(): boolean {
  return currentStatus.isDataStale;
}

/**
 * Check if we have an active connection.
 */
export function isConnected(): boolean {
  return currentStatus.state === 'connected';
}
