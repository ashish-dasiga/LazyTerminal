import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { HostConfig, authorizeWorkspaceRoot } from './config';
import { registerAuthorizedRoot } from '../server/fsSecurity';
import { WorkspaceBrowseEntry, WorkspaceInfo } from '../services/contracts';

interface PersistedWorkspaceStore {
  activeWorkspacePath: string | null;
  recentPaths: string[];
}

function runExecFile(
  file: string,
  args: string[],
  cwd: string,
  timeoutMs = 3000,
  env?: NodeJS.ProcessEnv,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { cwd, timeout: timeoutMs, windowsHide: true, env }, (err, stdout) => {
      if (err) reject(err);
      else resolve(String(stdout || '').trim());
    });
  });
}

function makeWorkspaceId(folderPath: string): string {
  const normalized =
    process.platform === 'win32'
      ? path.resolve(folderPath).toLowerCase()
      : path.resolve(folderPath);
  const hash = crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 10);
  const base = path
    .basename(folderPath)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `ws-${base || 'root'}-${hash}`;
}

export async function inspectWorkspaceInfo(folderPath: string): Promise<WorkspaceInfo> {
  const resolved = path.resolve(folderPath);
  const name = path.basename(resolved) || resolved;
  const id = makeWorkspaceId(resolved);

  let exists = false;
  let accessible = false;
  try {
    const stat = await fs.promises.stat(resolved);
    exists = stat.isDirectory();
    if (exists) {
      await fs.promises.access(resolved, fs.constants.R_OK);
      accessible = true;
    }
  } catch {
    exists = fs.existsSync(resolved);
    accessible = false;
  }

  if (!exists || !accessible) {
    return {
      id,
      name,
      path: resolved,
      exists,
      accessible,
      isGitRepo: false,
      branch: 'unavailable',
      dirtyFiles: 0,
      lastCommitHash: '-',
      lastCommitMsg: !exists ? 'Directory missing on Windows PC' : 'Directory inaccessible',
    };
  }

  let isGitRepo = false;
  let gitRoot: string | undefined;
  let branch = 'local';
  let dirtyFiles = 0;
  let lastCommitHash = '-';
  let lastCommitMsg = 'Local Windows folder (no Git repository)';

  try {
    const topLevel = await runExecFile('git', ['rev-parse', '--show-toplevel'], resolved, 2500);
    if (topLevel) {
      isGitRepo = true;
      gitRoot = path.resolve(topLevel);
    }
  } catch {
    isGitRepo = false;
  }

  if (isGitRepo) {
    try {
      const porcelain = await runExecFile(
        'git',
        ['status', '--porcelain=v1', '-b'],
        resolved,
        2500,
      );
      const lines = porcelain.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        if (line.startsWith('##')) {
          const header = line.slice(2).trim();
          const m = header.match(/^([^\s.]+)/);
          if (m) branch = m[1];
        } else {
          dirtyFiles++;
        }
      }
    } catch {}

    try {
      const logLine = await runExecFile(
        'git',
        ['log', '-1', '--format=%h%x00%s'],
        resolved,
        2500,
      );
      if (logLine) {
        const [h, s] = logLine.split('\0');
        if (h) lastCommitHash = h;
        if (s) lastCommitMsg = s;
      } else {
        lastCommitMsg = 'No commits yet';
      }
    } catch {
      lastCommitMsg = 'No commits yet';
    }
  }

  return {
    id,
    name,
    path: resolved,
    exists: true,
    accessible: true,
    isGitRepo,
    gitRoot,
    branch,
    dirtyFiles,
    lastCommitHash,
    lastCommitMsg,
    lastSyncedAt: new Date().toISOString(),
  };
}

function listWindowsDrives(): string[] {
  if (process.platform !== 'win32') {
    return ['/'];
  }
  const drives: string[] = [];
  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code);
    const driveRoot = `${letter}:\\`;
    try {
      if (fs.existsSync(driveRoot)) {
        drives.push(driveRoot);
      }
    } catch {
      // Ignore unready removable drives
    }
  }
  return drives.length > 0 ? drives : ['C:\\'];
}

export function createWorkspaceRouter(
  config: HostConfig,
  options?: { persistState?: boolean },
): Router {
  const router = Router();
  const shouldPersist = options?.persistState !== false;
  const storeFilePath = path.join(os.homedir(), '.lazy-terminal', 'workspaces.json');

  let activePath: string | null = config.defaultWorkspaceRoot;
  let recentPaths: string[] = [config.defaultWorkspaceRoot];

  // Ensure initial defaultWorkspaceRoot is authorized if it exists
  if (activePath && fs.existsSync(activePath)) {
    registerAuthorizedRoot(activePath);
  }

  if (shouldPersist) {
    try {
      if (fs.existsSync(storeFilePath)) {
        const raw = JSON.parse(fs.readFileSync(storeFilePath, 'utf-8')) as PersistedWorkspaceStore;
        if (Array.isArray(raw.recentPaths)) {
          const merged = [...raw.recentPaths, ...recentPaths]
            .filter((p) => typeof p === 'string' && p.trim().length > 0)
            .map((p) => path.resolve(p));
          recentPaths = Array.from(new Set(merged)).slice(0, 12);
          for (const rp of recentPaths) {
            if (fs.existsSync(rp)) registerAuthorizedRoot(rp);
          }
        }
        // Only restore persisted activeWorkspacePath if no explicit env override was provided
        if (
          raw.activeWorkspacePath &&
          !process.env.LAZY_TERMINAL_WORKSPACE_ROOT &&
          fs.existsSync(raw.activeWorkspacePath)
        ) {
          activePath = authorizeWorkspaceRoot(raw.activeWorkspacePath, config);
          registerAuthorizedRoot(activePath);
        }
      }
    } catch {
      // Ignore corrupt workspace cache
    }
  }

  function saveStore() {
    if (!shouldPersist) return;
    try {
      fs.mkdirSync(path.dirname(storeFilePath), { recursive: true });
      const data: PersistedWorkspaceStore = {
        activeWorkspacePath: activePath,
        recentPaths: recentPaths.slice(0, 12),
      };
      fs.writeFileSync(storeFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Best-effort persistence
    }
  }

  function recordWorkspaceSelection(selectedDir: string): string {
    const resolved = authorizeWorkspaceRoot(selectedDir, config);
    registerAuthorizedRoot(resolved);
    activePath = resolved;
    recentPaths = [
      resolved,
      ...recentPaths.filter((p) =>
        process.platform === 'win32'
          ? path.resolve(p).toLowerCase() !== resolved.toLowerCase()
          : path.resolve(p) !== resolved,
      ),
    ].slice(0, 12);
    saveStore();
    return resolved;
  }

  // GET /api/v1/workspace
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const activeWorkspace = activePath ? await inspectWorkspaceInfo(activePath) : null;
      const recentWorkspaces = await Promise.all(
        recentPaths.map((p) => inspectWorkspaceInfo(p)),
      );
      res.json({
        activeWorkspace,
        recentWorkspaces,
        allowedRoots: config.allowedRoots,
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'WORKSPACE_STATE_ERROR',
          message: err?.message || 'Failed to read workspace state on host.',
        },
      });
    }
  });

  // GET /api/v1/workspace/browse?path=...
  router.get('/browse', async (req: Request, res: Response) => {
    try {
      const drives = listWindowsDrives();
      const rawPath = typeof req.query.path === 'string' ? req.query.path.trim() : '';

      if (rawPath.includes('\0')) {
        res.status(400).json({
          error: { code: 'INVALID_PATH', message: 'Path contains invalid characters.' },
        });
        return;
      }

      const targetDir = rawPath
        ? path.resolve(rawPath.length === 2 && rawPath[1] === ':' ? `${rawPath}\\` : rawPath)
        : activePath && fs.existsSync(activePath)
          ? path.resolve(activePath)
          : drives[0];

      if (!fs.existsSync(targetDir)) {
        res.status(404).json({
          error: {
            code: 'DIRECTORY_NOT_FOUND',
            message: `Folder does not exist on Windows PC: ${targetDir}`,
          },
        });
        return;
      }

      const stat = await fs.promises.stat(targetDir);
      if (!stat.isDirectory()) {
        res.status(400).json({
          error: {
            code: 'NOT_A_DIRECTORY',
            message: `Path is a file, not a folder: ${targetDir}`,
          },
        });
        return;
      }

      const parsed = path.parse(targetDir);
      const parentPath = targetDir === parsed.root ? null : path.dirname(targetDir);

      const dirEntries = await fs.promises.readdir(targetDir, { withFileTypes: true });
      const entries: WorkspaceBrowseEntry[] = [];
      const skipNames = new Set([
        '$recycle.bin',
        'system volume information',
        'recovery',
        'perflogs',
        'documents and settings',
      ]);

      for (const d of dirEntries) {
        if (!d.isDirectory()) continue;
        if (d.name === '.git' || skipNames.has(d.name.toLowerCase())) continue;

        const fullSub = path.join(targetDir, d.name);
        try {
          const subStat = await fs.promises.stat(fullSub);
          const hasGit = fs.existsSync(path.join(fullSub, '.git'));
          entries.push({
            name: d.name,
            path: fullSub,
            isGitRepo: hasGit,
            lastModified: subStat.mtime.toISOString(),
          });
        } catch {
          // Skip unreadable OS system junction/directory
        }

        if (entries.length >= 300) break;
      }

      entries.sort((a, b) => {
        if (a.isGitRepo && !b.isGitRepo) return -1;
        if (!a.isGitRepo && b.isGitRepo) return 1;
        return a.name.localeCompare(b.name);
      });

      res.json({
        currentPath: targetDir,
        parentPath,
        drives,
        entries,
      });
    } catch (err: any) {
      if (err?.code === 'EACCES' || err?.code === 'EPERM') {
        res.status(403).json({
          error: {
            code: 'PERMISSION_DENIED',
            message: `Windows denied access to folder: ${req.query.path || ''}`,
          },
        });
        return;
      }
      res.status(500).json({
        error: {
          code: 'WORKSPACE_BROWSE_ERROR',
          message: err?.message || 'Failed to browse folders on Windows PC.',
        },
      });
    }
  });

  // POST /api/v1/workspace/select
  router.post('/select', async (req: Request, res: Response) => {
    try {
      const requested = typeof req.body?.path === 'string' ? req.body.path.trim() : '';
      if (!requested || requested.includes('\0')) {
        res.status(400).json({
          error: { code: 'INVALID_PATH', message: 'A valid folder path is required.' },
        });
        return;
      }

      const resolved = path.resolve(
        requested.length === 2 && requested[1] === ':' ? `${requested}\\` : requested,
      );

      if (!fs.existsSync(resolved)) {
        res.status(404).json({
          error: {
            code: 'DIRECTORY_NOT_FOUND',
            message: `Workspace folder "${requested}" does not exist on this Windows PC.`,
          },
        });
        return;
      }

      const stat = await fs.promises.stat(resolved);
      if (!stat.isDirectory()) {
        res.status(400).json({
          error: {
            code: 'NOT_A_DIRECTORY',
            message: `Selected path "${requested}" is a file, not a directory.`,
          },
        });
        return;
      }

      try {
        await fs.promises.access(resolved, fs.constants.R_OK);
        await fs.promises.readdir(resolved);
      } catch {
        res.status(403).json({
          error: {
            code: 'PERMISSION_DENIED',
            message: `Permission denied accessing folder "${resolved}" on Windows PC.`,
          },
        });
        return;
      }

      const authorized = recordWorkspaceSelection(resolved);
      const workspace = await inspectWorkspaceInfo(authorized);
      const recentWorkspaces = await Promise.all(
        recentPaths.map((p) => inspectWorkspaceInfo(p)),
      );

      res.status(200).json({
        workspace,
        recentWorkspaces,
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'WORKSPACE_SELECT_ERROR',
          message: err?.message || 'Failed to select workspace folder.',
        },
      });
    }
  });

  // POST /api/v1/workspace/pick-native
  router.post('/pick-native', async (req: Request, res: Response) => {
    if (process.platform !== 'win32') {
      res.status(501).json({
        error: {
          code: 'NATIVE_PICKER_UNSUPPORTED',
          message: 'Native Windows folder dialog is only available on Windows hosts.',
        },
      });
      return;
    }

    try {
      const initialPath =
        typeof req.body?.initialPath === 'string' && fs.existsSync(req.body.initialPath)
          ? path.resolve(req.body.initialPath)
          : activePath && fs.existsSync(activePath)
            ? activePath
            : os.homedir();

      const psScript = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$dlg = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$dlg.Description = "Select Workspace Folder for Lazy Terminal"',
        '$dlg.ShowNewFolderButton = $true',
        'if ($env:LT_INITIAL_DIR -and (Test-Path -LiteralPath $env:LT_INITIAL_DIR)) { $dlg.SelectedPath = $env:LT_INITIAL_DIR }',
        '$res = $dlg.ShowDialog()',
        'if ($res -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dlg.SelectedPath) }',
      ].join('; ');

      const chosen = await runExecFile(
        'powershell.exe',
        ['-NoLogo', '-NoProfile', '-STA', '-Command', psScript],
        os.homedir(),
        90_000,
        { ...process.env, LT_INITIAL_DIR: initialPath },
      );

      if (!chosen) {
        res.status(200).json({ cancelled: true });
        return;
      }

      const authorized = recordWorkspaceSelection(chosen);
      const workspace = await inspectWorkspaceInfo(authorized);
      res.status(200).json({ cancelled: false, workspace });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'NATIVE_PICKER_FAILED',
          message: err?.message || 'Unable to open native Windows folder dialog.',
        },
      });
    }
  });

  // POST /api/v1/workspace/scan-repos
  router.post('/scan-repos', async (req: Request, res: Response) => {
    try {
      const customRoot =
        typeof req.body?.rootPath === 'string' && req.body.rootPath.trim()
          ? path.resolve(req.body.rootPath.trim())
          : null;

      const candidateSearchRoots = new Set<string>();
      if (customRoot && fs.existsSync(customRoot)) {
        candidateSearchRoots.add(customRoot);
      } else {
        if (activePath && fs.existsSync(activePath)) {
          candidateSearchRoots.add(path.dirname(activePath));
        }
        const home = os.homedir();
        for (const sub of ['', 'Projects', 'Documents', 'Desktop', path.join('source', 'repos')]) {
          const p = sub ? path.join(home, sub) : home;
          if (fs.existsSync(p)) candidateSearchRoots.add(p);
        }
      }

      const discoveredPaths = new Set<string>();
      if (activePath && fs.existsSync(activePath)) {
        discoveredPaths.add(path.resolve(activePath));
      }

      const ignoreDirs = new Set([
        'node_modules',
        '.git',
        'appdata',
        '.cache',
        '.npm',
        '.cargo',
        '.rustup',
        '.vscode',
        '.gemini',
        '.claude',
        'dist',
        'build',
      ]);

      for (const root of candidateSearchRoots) {
        if (discoveredPaths.size >= 25) break;
        if (fs.existsSync(path.join(root, '.git'))) {
          discoveredPaths.add(path.resolve(root));
        }
        let level1: fs.Dirent[] = [];
        try {
          level1 = await fs.promises.readdir(root, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const d1 of level1) {
          if (discoveredPaths.size >= 25) break;
          if (!d1.isDirectory() || d1.name.startsWith('.') || ignoreDirs.has(d1.name.toLowerCase())) {
            continue;
          }
          const p1 = path.join(root, d1.name);
          if (fs.existsSync(path.join(p1, '.git'))) {
            discoveredPaths.add(path.resolve(p1));
            continue;
          }
        }
      }

      const repositories = await Promise.all(
        Array.from(discoveredPaths).map((p) => inspectWorkspaceInfo(p)),
      );

      // Merge valid discovered repos into recent list without switching activeWorkspace
      const prevActive = config.defaultWorkspaceRoot;
      for (const repo of repositories) {
        if (
          repo.exists &&
          !recentPaths.some((rp) =>
            process.platform === 'win32'
              ? rp.toLowerCase() === repo.path.toLowerCase()
              : rp === repo.path,
          )
        ) {
          recentPaths.push(repo.path);
          registerAuthorizedRoot(repo.path);
          authorizeWorkspaceRoot(repo.path, config);
        }
      }
      config.defaultWorkspaceRoot = activePath || prevActive;
      recentPaths = recentPaths.slice(0, 16);
      saveStore();

      res.status(200).json({ repositories });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'WORKSPACE_SCAN_FAILED',
          message: err?.message || 'Failed to scan Windows PC for repositories.',
        },
      });
    }
  });

  return router;
}
