import path from 'path';
import fs from 'fs';

export interface HostConfig {
  hostPort: number;
  hostBind: string;
  defaultWorkspaceRoot: string;
  allowedRoots: string[];
  pairingTtlSeconds: number;
  pairingMaxAttempts: number;
  pairingLockoutMs: number;
  commandTimeoutMs: number;
  maxOutputBytes: number;
  redactSecretsInLogs: boolean;
}

export function loadHostConfig(env: NodeJS.ProcessEnv = process.env): HostConfig {
  const defaultWorkspaceRoot = path.resolve(env.LAZY_TERMINAL_WORKSPACE_ROOT || process.cwd());

  const configuredRoots = (env.LAZY_TERMINAL_ALLOWED_ROOTS || '')
    .split(/[;,]/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => path.resolve(r));

  const allowedRoots = Array.from(
    new Set([defaultWorkspaceRoot, ...configuredRoots])
  );

  return {
    hostPort: Number(env.LAZY_TERMINAL_HOST_PORT || env.HOST_PORT || env.PORT) || 9871,
    hostBind: env.LAZY_TERMINAL_HOST_BIND || '0.0.0.0',
    defaultWorkspaceRoot,
    allowedRoots,
    pairingTtlSeconds: Number(env.LAZY_TERMINAL_PAIRING_TTL_SECONDS) || 300,
    pairingMaxAttempts: Number(env.LAZY_TERMINAL_PAIRING_MAX_ATTEMPTS) || 5,
    pairingLockoutMs: Number(env.LAZY_TERMINAL_PAIRING_LOCKOUT_MS) || 60_000,
    commandTimeoutMs: Number(env.LAZY_TERMINAL_COMMAND_TIMEOUT_MS) || 30_000,
    maxOutputBytes: Number(env.LAZY_TERMINAL_MAX_OUTPUT_BYTES) || 262_144,
    redactSecretsInLogs: env.LAZY_TERMINAL_REDACT_SECRETS !== 'false',
  };
}

export function authorizeWorkspaceRoot(targetRoot: string, config: HostConfig): string {
  const resolved = path.resolve(targetRoot);
  const exists = config.allowedRoots.some((r) =>
    process.platform === 'win32'
      ? path.resolve(r).toLowerCase() === resolved.toLowerCase()
      : path.resolve(r) === resolved
  );
  if (!exists) {
    config.allowedRoots.push(resolved);
  }
  config.defaultWorkspaceRoot = resolved;
  return resolved;
}

export function isPathWithinAllowedRoots(targetPath: string, allowedRoots: string[]): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const normalizedTarget =
    process.platform === 'win32' ? resolvedTarget.toLowerCase() : resolvedTarget;

  return allowedRoots.some((root) => {
    const resolvedRoot = path.resolve(root);
    const normalizedRoot =
      process.platform === 'win32' ? resolvedRoot.toLowerCase() : resolvedRoot;

    if (normalizedTarget === normalizedRoot) {
      return true;
    }
    const rootWithSep = normalizedRoot.endsWith(path.sep)
      ? normalizedRoot
      : normalizedRoot + path.sep;
    return normalizedTarget.startsWith(rootWithSep);
  });
}

export type PathResolutionResult =
  | { ok: true; resolvedPath: string; mappedFromVirtual: boolean }
  | { ok: false; code: 'PATH_NOT_ALLOWED' | 'DIRECTORY_NOT_FOUND'; error: string };

export function resolveAuthorizedWorkingDir(
  requestedDir: string | undefined,
  config: HostConfig
): PathResolutionResult {
  if (!requestedDir || !requestedDir.trim()) {
    return {
      ok: true,
      resolvedPath: config.defaultWorkspaceRoot,
      mappedFromVirtual: false,
    };
  }

  const trimmed = requestedDir.trim();
  const candidatePath = path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(config.defaultWorkspaceRoot, trimmed);

  if (!isPathWithinAllowedRoots(candidatePath, config.allowedRoots)) {
    return {
      ok: false,
      code: 'PATH_NOT_ALLOWED',
      error: `Requested working directory "${requestedDir}" is outside authorized workspace roots.`,
    };
  }

  if (!fs.existsSync(candidatePath) || !fs.statSync(candidatePath).isDirectory()) {
    return {
      ok: false,
      code: 'DIRECTORY_NOT_FOUND',
      error: `Requested working directory "${requestedDir}" does not exist or is not a directory on this Windows PC.`,
    };
  }

  return {
    ok: true,
    resolvedPath: candidatePath,
    mappedFromVirtual: false,
  };
}
