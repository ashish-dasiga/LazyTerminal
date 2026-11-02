/**
 * Lazy Terminal — HTTP/WebSocket API client for the Windows PC companion.
 *
 * Handles request timeouts, retries for transient failures, auth header
 * injection, and structured error responses. All methods throw
 * `ApiError` on failure so callers can show meaningful UI states.
 *
 * @module apiClient
 */

import { getAppConfig } from './config';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly isOffline: boolean = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Thrown when the PC host cannot be reached at all. */
export class HostUnreachableError extends ApiError {
  constructor(detail?: string) {
    super(
      detail ||
        'Windows PC host is unreachable. Check that the companion app is running and both devices are on the same network.',
      0,
      'HOST_UNREACHABLE',
      true,
    );
    this.name = 'HostUnreachableError';
  }
}

// ---------------------------------------------------------------------------
// Session token management (in-memory only — never persisted to disk)
// ---------------------------------------------------------------------------

const SESSION_STORAGE_KEY = 'lazy_terminal_session_token';

function readStoredSessionToken(): string | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors in restricted WebViews
  }
  return null;
}

let sessionToken: string | null = readStoredSessionToken();

export function setSessionToken(token: string | null): void {
  sessionToken = token;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (token) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
      } else {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage access errors
  }
}

export function getSessionToken(): string | null {
  if (!sessionToken) {
    sessionToken = readStoredSessionToken();
  }
  return sessionToken;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Override the default timeout */
  timeoutMs?: number;
  /** Override the default retry count */
  retries?: number;
  /** Skip auth header (for pairing/connect endpoints) */
  skipAuth?: boolean;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const config = getAppConfig();
  const url = `${config.hostBaseUrl}${path}`;
  const method = opts.method ?? 'GET';
  const timeoutMs = opts.timeoutMs ?? config.requestTimeoutMs;
  const maxRetries = opts.retries ?? config.maxRetries;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (!opts.skipAuth && sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorCode = `HTTP_${response.status}`;

        try {
          const parsed = JSON.parse(errorBody);
          if (parsed && typeof parsed === 'object') {
            if (typeof parsed.errorMessage === 'string' && parsed.errorMessage) {
              errorMessage = parsed.errorMessage;
            } else if (typeof parsed.message === 'string' && parsed.message) {
              errorMessage = parsed.message;
            } else if (parsed.error && typeof parsed.error === 'object') {
              if (typeof parsed.error.message === 'string' && parsed.error.message) {
                errorMessage = parsed.error.message;
              }
              if (typeof parsed.error.code === 'string' && parsed.error.code) {
                errorCode = parsed.error.code;
              }
            } else if (typeof parsed.error === 'string' && parsed.error) {
              errorMessage = parsed.error;
              if (/^[A-Z0-9_]+$/.test(parsed.error)) {
                errorCode = parsed.error;
              }
            }
          }
        } catch {
          if (
            errorBody.toLowerCase().includes('<!doctype') ||
            errorBody.toLowerCase().includes('<html')
          ) {
            errorMessage = `Unable to connect to Windows PC Companion at ${config.hostBaseUrl}. Ensure Lazy Terminal Companion is running on your PC and the Host URL is set to your PC's IP and port.`;
          } else if (errorBody.trim().length > 0 && errorBody.length < 300) {
            errorMessage = errorBody.trim();
          }
        }
        throw new ApiError(errorMessage, response.status, errorCode);
      }

      if (response.status === 204) {
        return undefined as unknown as T;
      }

      return (await response.json()) as T;
    } catch (err: any) {
      lastError = err;

      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        throw err;
      }

      if (err.name === 'AbortError') {
        lastError = new ApiError(
          `Request to ${path} timed out after ${timeoutMs}ms`,
          0,
          'TIMEOUT',
          true,
        );
      }

      if (err instanceof TypeError) {
        lastError = new HostUnreachableError(err.message);
      }

      if (config.debugLogging) {
        console.warn(
          `[apiClient] Attempt ${attempt + 1}/${maxRetries + 1} failed for ${method} ${path}:`,
          err.message,
        );
      }

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError ?? new HostUnreachableError();
}

// ---------------------------------------------------------------------------
// WebSocket helper
// ---------------------------------------------------------------------------

export interface WsConnection {
  socket: WebSocket;
  close: () => void;
}

export function openWs(
  path: string,
  onMessage: (data: unknown) => void,
  onClose?: (ev: CloseEvent) => void,
  onError?: (ev: Event) => void,
): WsConnection {
  const config = getAppConfig();
  const url = `${config.hostWsUrl}${path}`;

  const socket = new WebSocket(url);

  socket.onmessage = (ev) => {
    try {
      const parsed = JSON.parse(ev.data);
      onMessage(parsed);
    } catch {
      onMessage(ev.data);
    }
  };

  socket.onclose = (ev) => onClose?.(ev);
  socket.onerror = (ev) => onError?.(ev);

  return {
    socket,
    close: () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, 'Client closed');
      }
    },
  };
}
