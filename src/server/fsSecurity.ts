import path from 'path';
import fs from 'fs';

// Default allowed roots: the current working directory and any user-configured path
export function getAllowedRoots(): string[] {
  const roots: string[] = [path.resolve(process.cwd())];
  const envRoot = process.env.LAZY_TERMINAL_WORKSPACE_ROOT || process.env.WORKSPACE_ROOT;
  if (envRoot && fs.existsSync(envRoot)) {
    roots.push(path.resolve(envRoot));
  }
  return roots;
}

const DEMO_PROJECT_ROOTS = [
  'c:/projects/hyper-relay',
  'c:/dev/ai-agents/claude-fleet',
  'c:/work/enterprise-dashboard',
];

/**
 * Maps frontend placeholder project paths (from initial UI state) to the active host workspace root
 * when those placeholder directories do not exist on the host machine.
 */
export function resolveWorkspaceProjectPath(requestedPath?: string, defaultRoot?: string): string {
  const root = defaultRoot || getAllowedRoots()[0];
  if (!requestedPath || !requestedPath.trim() || requestedPath.trim() === '.') {
    return root;
  }
  const normalized = requestedPath.trim().replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  for (const demoRoot of DEMO_PROJECT_ROOTS) {
    if (lower === demoRoot && !fs.existsSync(requestedPath)) {
      return root;
    }
    if (lower.startsWith(demoRoot + '/') && !fs.existsSync(demoRoot)) {
      const suffix = normalized.slice(demoRoot.length + 1);
      return path.join(root, suffix);
    }
  }
  return requestedPath;
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

/**
 * Validates that a requested path strictly resides within at least one authorized workspace root.
 * Protects against directory traversal (../ and ..\), null byte injection, Windows reserved device names,
 * and symlink directory escapes.
 */
export function validateSafePath(
  requestedPath: string,
  baseDir?: string,
  customAllowedRoots?: string[]
): PathValidationResult {
  if (!requestedPath || typeof requestedPath !== 'string') {
    return {
      isValid: false,
      resolvedPath: '',
      errorMessage: 'Path must be a non-empty string.',
      errorCode: 'INVALID_PATH',
    };
  }

  // 1. Block null bytes
  if (requestedPath.includes('\0')) {
    return {
      isValid: false,
      resolvedPath: '',
      errorMessage: 'Path contains invalid null byte characters.',
      errorCode: 'INVALID_PATH',
    };
  }

  // 2. Normalize base directory and allowed roots
  const allowedRoots = (customAllowedRoots && customAllowedRoots.length > 0)
    ? customAllowedRoots.map((r) => path.resolve(r))
    : getAllowedRoots();

  const effectiveBaseDir = baseDir
    ? resolveWorkspaceProjectPath(baseDir, allowedRoots[0])
    : allowedRoots[0];
  const primaryBase = path.resolve(effectiveBaseDir);

  // 3. Map placeholder frontend root if applicable and normalize Windows backslashes
  const effectiveRequestedPath = resolveWorkspaceProjectPath(requestedPath, primaryBase);
  const normalizedSeparators = effectiveRequestedPath.replace(/\\/g, '/');

  // 4. Resolve target path
  let resolved: string;
  if (path.isAbsolute(normalizedSeparators)) {
    resolved = path.resolve(normalizedSeparators);
  } else {
    resolved = path.resolve(primaryBase, normalizedSeparators);
  }

  // 5. Check for Windows reserved names in path components
  const parts = resolved.split(path.sep);
  for (const part of parts) {
    if (RESERVED_NAMES.test(part)) {
      return {
        isValid: false,
        resolvedPath: resolved,
        errorMessage: `Path component "${part}" is a reserved system device name.`,
        errorCode: 'INVALID_PATH',
      };
    }
  }

  // 6. Ensure resolved path is under at least one allowed root
  const matchedRoot = allowedRoots.find((root) => {
    const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
    return resolved === root || resolved.startsWith(rootWithSep);
  });

  if (!matchedRoot) {
    return {
      isValid: false,
      resolvedPath: resolved,
      errorMessage: `Access denied: Path "${requestedPath}" is outside authorized workspace roots.`,
      errorCode: 'PATH_NOT_ALLOWED',
    };
  }

  // 7. Check realpath if path exists to prevent symlink escape
  try {
    if (fs.existsSync(resolved)) {
      const real = fs.realpathSync(resolved);
      const rootWithSep = matchedRoot.endsWith(path.sep) ? matchedRoot : matchedRoot + path.sep;
      if (real !== matchedRoot && !real.startsWith(rootWithSep)) {
        return {
          isValid: false,
          resolvedPath: real,
          errorMessage: 'Access denied: Symlink resolves outside authorized workspace root.',
          errorCode: 'PATH_TRAVERSAL_DETECTED',
        };
      }
    }
  } catch {
    // If realpath fails, fallback to strict resolved check
  }

  return {
    isValid: true,
    resolvedPath: resolved,
    relativeToRoot: path.relative(matchedRoot, resolved) || '.',
  };
}
