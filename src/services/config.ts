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
  /** 'real' makes network calls to the PC host; 'mock' uses the isolated test harness */
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

let memoryHostUrl: string | null = null;
let memoryAdapterMode: 'real' | 'mock' | null = null;

function isCapacitorAndroidWebView(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  if (window.location?.protocol === 'capacitor:' || window.location?.protocol === 'file:') {
    return true;
  }
  // Native Android WebView AssetLoader serves bundled assets from http://localhost (no port)
  if (
    window.location?.hostname === 'localhost' &&
    !window.location?.port &&
    typeof navigator !== 'undefined' &&
    /Android/i.test(navigator.userAgent || '')
  ) {
    return true;
  }
  return false;
}

/**
 * Read host URL from localStorage or memory fallback, falling back to env or a safe default.
 */
function resolveHostUrl(): string {
  if (memoryHostUrl) return memoryHostUrl;

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_HOST_KEY);
      if (stored && stored.trim().length > 0) return stored.trim().replace(/\/+$/, '');
    } catch {}
  }

  const metaEnv = (import.meta as unknown as { env?: Record<string, string> })?.env;
  const envUrl =
    (typeof process !== 'undefined' &&
      (process.env?.VITE_HOST_API_URL || process.env?.VITE_HOST_URL)) ||
    metaEnv?.VITE_HOST_API_URL ||
    metaEnv?.VITE_HOST_URL;

  // In native Android APK / Capacitor WebView, window.location.origin is the phone's local asset server,
  // NOT the Windows PC. Default to 10.0.2.2:9871 (Android Emulator loopback to Windows host) until user sets LAN IP.
  if (isCapacitorAndroidWebView()) {
    if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
      return envUrl.trim().replace(/\/+$/, '');
    }
    return 'http://10.0.2.2:9871';
  }

  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const hn = window.location.hostname;
    const isLocalOrLan =
      hn === 'localhost' ||
      hn === '127.0.0.1' ||
      /^192\.168\./.test(hn) ||
      /^10\./.test(hn) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hn);
    if (isLocalOrLan && window.location.origin && window.location.origin.startsWith('http')) {
      return window.location.origin.replace(/\/+$/, '');
    }
  }

  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  return 'http://127.0.0.1:9871';
}

function resolveAdapterMode(): 'real' | 'mock' {
  if (memoryAdapterMode) return memoryAdapterMode;

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_MODE_KEY);
      if (stored === 'real' || stored === 'mock') return stored;
    } catch {}
  }

  const metaEnv = (import.meta as unknown as { env?: Record<string, string> })?.env;
  const envMode =
    (typeof process !== 'undefined' ? process.env?.VITE_ADAPTER_MODE : undefined) ||
    metaEnv?.VITE_ADAPTER_MODE;

  if (envMode === 'mock') return 'mock';
  return 'real';
}

export function getAppConfig(): AppConfig {
  const hostBaseUrl = resolveHostUrl();
  const wsProtocol = hostBaseUrl.startsWith('https') ? 'wss' : 'ws';
  const wsHost = hostBaseUrl.replace(/^https?:\/\//, '');
  const adapterMode = resolveAdapterMode();

  return {
    adapterMode,
    hostBaseUrl,
    hostWsUrl: `${wsProtocol}://${wsHost}/ws`,
    requestTimeoutMs: 15_000,
    maxRetries: 1,
    debugLogging: adapterMode === 'mock',
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
