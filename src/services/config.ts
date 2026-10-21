/**
 * Lazy Terminal — Environment and adapter configuration.
 *
 * Controls whether the app uses the real PC host adapter or the mock
 * development harness. Host address is read from env / localStorage
 * so machine-specific values are never committed.
 *
 * @module config
 */

export interface AppConfig {
  /** 'real' attempts network calls to the PC host; 'mock' uses the dev harness */
  adapterMode: 'real' | 'mock';
  /** Base URL of the Windows PC companion (e.g. "http://192.168.1.142:9871") */
  hostBaseUrl: string;
  /** WebSocket URL for streaming (e.g. "ws://192.168.1.142:9871/ws") */
  hostWsUrl: string;
  /** Request timeout in milliseconds */
  requestTimeoutMs: number;
  /** Max retry attempts for transient failures */
  maxRetries: number;
  /** Whether to log adapter calls to console (dev only) */
  debugLogging: boolean;
}

const LOCAL_STORAGE_HOST_KEY = 'lazy_terminal_host_url';
const LOCAL_STORAGE_MODE_KEY = 'lazy_terminal_adapter_mode';

// In-memory fallbacks when window/localStorage is unavailable (Node.js test environment)
let memoryHostUrl: string | null = null;
let memoryAdapterMode: 'real' | 'mock' | null = null;

/**
 * Read host URL from localStorage or memory fallback, falling back to env or a safe default.
 * Never returns a hard-coded real machine address — the user must configure it.
 */
function resolveHostUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_HOST_KEY);
      if (stored) return stored;
    } catch {}
  }
  if (memoryHostUrl) return memoryHostUrl;

  // Vite injects import.meta.env at build time
  const envUrl = typeof process !== 'undefined'
    ? process.env?.VITE_HOST_URL
    : (import.meta as any)?.env?.VITE_HOST_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.length > 0) return envUrl;

  // Safe default — will fail fast when no real host is configured
  return 'http://localhost:9871';
}

function resolveAdapterMode(): 'real' | 'mock' {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_MODE_KEY);
      if (stored === 'real' || stored === 'mock') return stored;
    } catch {}
  }
  if (memoryAdapterMode) return memoryAdapterMode;

  const envMode = typeof process !== 'undefined'
    ? process.env?.VITE_ADAPTER_MODE
    : (import.meta as any)?.env?.VITE_ADAPTER_MODE;
  if (envMode === 'real') return 'real';

  // Default to mock for safe development
  return 'mock';
}

export function getAppConfig(): AppConfig {
  const hostBaseUrl = resolveHostUrl();
  const wsProtocol = hostBaseUrl.startsWith('https') ? 'wss' : 'ws';
  const wsHost = hostBaseUrl.replace(/^https?:\/\//, '');

  return {
    adapterMode: resolveAdapterMode(),
    hostBaseUrl,
    hostWsUrl: `${wsProtocol}://${wsHost}/ws`,
    requestTimeoutMs: 10_000,
    maxRetries: 2,
    debugLogging: resolveAdapterMode() === 'mock',
  };
}

/** Persist host URL to localStorage and memory fallback. */
export function setHostUrl(url: string): void {
  const cleanUrl = url.replace(/\/+$/, '');
  memoryHostUrl = cleanUrl;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_HOST_KEY, cleanUrl);
    } catch {}
  }
}

/** Persist adapter mode to localStorage and memory fallback. */
export function setAdapterMode(mode: 'real' | 'mock'): void {
  memoryAdapterMode = mode;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_MODE_KEY, mode);
    } catch {}
  }
}
