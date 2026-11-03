import path from 'path';
import fs from 'fs';

const dynamicAuthorizedRoots = new Set<string>();

export function registerAuthorizedRoot(rootPath: string): string {
  const resolved = path.resolve(rootPath);
  dynamicAuthorizedRoots.add(resolved);
  return resolved;
}

export function clearDynamicAuthorizedRoots(): void {
  dynamicAuthorizedRoots.clear();
}

// Default allowed roots: current working directory, env-configured root, plus dynamically selected workspaces
export function getAllowedRoots(extraRoots?: string[]): string[] {
  const roots = new Set<string>();
  roots.add(path.resolve(process.cwd()));

  const envRoot = process.env.LAZY_TERMINAL_WORKSPACE_ROOT || process.env.WORKSPACE_ROOT;
  if (envRoot) {
    roots.add(path.resolve(envRoot));
  }

  const configuredList = (process.env.LAZY_TERMINAL_ALLOWED_ROOTS || '')
    .split(/[;,]/)
    .map((r) => r.trim())
    .filter(Boolean);
  for (const r of configuredList) {
    roots.add(path.resolve(r));
  }

  for (const dyn of dynamicAuthorizedRoots) {
    roots.add(path.resolve(dyn));
  }

  if (Array.isArray(extraRoots)) {
    for (const r of extraRoots) {
      if (r && r.trim()) roots.add(path.resolve(r));
    }
  }

  return Array.from(roots);
}

/**
 * Resolves a requested project path without silently substituting another folder
 * when a requested path is missing or invalid.
 */
export function resolveWorkspaceProjectPath(requestedPath?: string, defaultRoot?: string): string {
  const fallback = defaultRoot || getAllowedRoots()[0];
  if (!requestedPath || !requestedPath.trim() || requestedPath.trim() === '.') {
    return fallback;
  }
  return requestedPath.trim();
}

// Windows reserved device names to block
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export interface PathValidationResult {
  isValid: boolean;
  resolvedPath: string;
  relativeToRoot?: string;
  errorMessage?: string;
  errorCode?: 'PATH_NOT_ALLOWED' | 'INVALID_PATH' | 'PATH_TRAVERSAL_DETECTED';
}

function canonicalizeExistingPrefix(p: string): string {
  const abs = path.resolve(p);
  try {
    let curr = abs;
    const tail: string[] = [];
    while (!fs.existsSync(curr)) {
      const parent = path.dirname(curr);
      if (parent === curr) {
        return abs;
      }
      tail.unshift(path.basename(curr));
      curr = parent;
    }
    const realBase = fs.realpathSync.native
      ? fs.realpathSync.native(curr)
      : fs.realpathSync(curr);
    return tail.length > 0 ? path.join(realBase, ...tail) : realBase;
  } catch {
    // Fallback to resolved path
  }
  return abs;
}

function isSameOrSubPath(candidate: string, root: string): boolean {
  const realCandidate = canonicalizeExistingPrefix(candidate);
  const realRoot = canonicalizeExistingPrefix(root);
  const normCandidate =
    process.platform === 'win32' ? realCandidate.toLowerCase() : realCandidate;
  const normRoot =
    process.platform === 'win32' ? realRoot.toLowerCase() : realRoot;

  if (normCandidate === normRoot) return true;
  const rootWithSep = normRoot.endsWith(path.sep) ? normRoot : normRoot + path.sep;
  return normCandidate.startsWith(rootWithSep);
}

/**
 * Validates that a requested path strictly resides within at least one authorized workspace root.
 * Protects against directory traversal (../ and ..\), null byte injection, Windows reserved device names,
 * and symlink directory escapes. Never silently substitutes another directory.
 */
export function validateSafePath(
  requestedPath: string,
  baseDir?: string,
  customAllowedRoots?: string[],
): PathValidationResult {
  if (!requestedPath || typeof requestedPath !== 'string') {
    return {
      isValid: false,
      resolvedPath: '',
      errorMessage: 'Path must be a non-empty string.',
      errorCode: 'INVALID_PATH',
    };
  }

  if (requestedPath.includes('\0') || (baseDir && baseDir.includes('\0'))) {
    return {
      isValid: false,
      resolvedPath: '',
      errorMessage: 'Path contains invalid null byte characters.',
      errorCode: 'INVALID_PATH',
    };
  }

  const allowedRoots =
    customAllowedRoots && customAllowedRoots.length > 0
      ? customAllowedRoots.map((r) => path.resolve(r))
      : getAllowedRoots();

  const effectiveBaseDir = baseDir
    ? resolveWorkspaceProjectPath(baseDir, allowedRoots[0])
    : allowedRoots[0];
  const primaryBase = path.resolve(effectiveBaseDir);

  const normalizedSeparators = requestedPath.trim().replace(/\\/g, '/');

  let resolved: string;
  if (path.isAbsolute(normalizedSeparators) || /^[a-zA-Z]:\//.test(normalizedSeparators)) {
    resolved = path.resolve(normalizedSeparators);
  } else {
    resolved = path.resolve(primaryBase, normalizedSeparators);
  }

  // Check for Windows reserved names in non-drive path components
  const parts = resolved.split(path.sep);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part || (i === 0 && /^[a-zA-Z]:$/.test(part))) continue;
    if (RESERVED_NAMES.test(part)) {
      return {
        isValid: false,
        resolvedPath: resolved,
        errorMessage: `Path component "${part}" is a reserved system device name.`,
        errorCode: 'INVALID_PATH',
      };
    }
  }

  const matchedRoot = allowedRoots.find((root) => isSameOrSubPath(resolved, root));
  if (!matchedRoot) {
    return {
      isValid: false,
      resolvedPath: resolved,
      errorMessage: `Access denied: Path "${requestedPath}" is outside authorized workspace roots.`,
      errorCode: 'PATH_NOT_ALLOWED',
    };
  }

  // Check realpath if path exists to prevent symlink/junction escape
  try {
    if (fs.existsSync(resolved)) {
      const real = fs.realpathSync(resolved);
      const realRoot = fs.existsSync(matchedRoot) ? fs.realpathSync(matchedRoot) : matchedRoot;
      if (!isSameOrSubPath(real, realRoot)) {
        return {
          isValid: false,
          resolvedPath: real,
          errorMessage: 'Access denied: Symlink resolves outside authorized workspace root.',
          errorCode: 'PATH_TRAVERSAL_DETECTED',
        };
      }
    }
  } catch {
    // Fallback to resolved lexical check if realpath fails
  }

  return {
    isValid: true,
    resolvedPath: resolved,
    relativeToRoot: path.relative(matchedRoot, resolved) || '.',
  };
}
