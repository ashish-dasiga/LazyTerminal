const SENSITIVE_FIELD_NAMES = new Set([
  'pairingkey',
  'pairingtoken',
  'sessiontoken',
  'authtoken',
  'authorization',
  'x-session-token',
  'password',
  'secret',
  'qrpayload',
]);

const PAIRING_CODE_PATTERN = /\b\d{3}-\d{3}\b/g;
const BEARER_TOKEN_PATTERN = /Bearer\s+[A-Za-z0-9._-]+/gi;

export function redactString(input: string): string {
  return input
    .replace(PAIRING_CODE_PATTERN, '[REDACTED_KEY]')
    .replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED_TOKEN]');
}

export function sanitizeLogMeta(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeLogMeta);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELD_NAMES.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizeLogMeta(v);
      }
    }
    return out;
  }
  return value;
}

export interface HostLogger {
  info(event: string, meta?: Record<string, unknown>): void;
  warn(event: string, meta?: Record<string, unknown>): void;
  error(event: string, meta?: Record<string, unknown>): void;
  getEntries(): Array<{ level: string; timestamp: string; event: string; meta?: unknown }>;
}

export function createHostLogger(options: { silent?: boolean } = {}): HostLogger {
  const entries: Array<{ level: string; timestamp: string; event: string; meta?: unknown }> = [];

  const record = (level: 'INFO' | 'WARN' | 'ERROR', event: string, meta?: Record<string, unknown>) => {
    const safeEvent = redactString(event);
    const safeMeta = meta ? sanitizeLogMeta(meta) : undefined;
    const entry = {
      level,
      timestamp: new Date().toISOString(),
      event: safeEvent,
      ...(safeMeta !== undefined ? { meta: safeMeta } : {}),
    };
    entries.push(entry);
    if (entries.length > 500) {
      entries.shift();
    }
    if (!options.silent) {
      const serialized = safeMeta ? ` ${JSON.stringify(safeMeta)}` : '';
      console.log(`[LazyTerminalHost][${entry.timestamp}][${level}] ${safeEvent}${serialized}`);
    }
  };

  return {
    info: (event, meta) => record('INFO', event, meta),
    warn: (event, meta) => record('WARN', event, meta),
    error: (event, meta) => record('ERROR', event, meta),
    getEntries: () => [...entries],
  };
}
