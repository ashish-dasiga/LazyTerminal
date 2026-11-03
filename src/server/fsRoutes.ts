import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { validateSafePath, resolveWorkspaceProjectPath } from './fsSecurity';
import { ProjectFile } from '../types/relay';

export const fsRouter = Router();

// 5 MB maximum size for inline text editing
const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024;
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function computeSha256(buffer: Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function isBinaryBuffer(buffer: Buffer): boolean {
  const checkLen = Math.min(buffer.length, 8000);
  for (let i = 0; i < checkLen; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

function getRequestAllowedRoots(res: Response): string[] | undefined {
  return res.locals?.hostConfig?.allowedRoots;
}

function getDefaultRoot(res: Response): string | undefined {
  return res.locals?.hostConfig?.defaultWorkspaceRoot;
}

function queryGitDirtyMap(dirPath: string): Promise<Map<string, ProjectFile['gitStatus']>> {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['status', '--porcelain=v1'],
      { cwd: dirPath, timeout: 1500, windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout) => {
        const map = new Map<string, ProjectFile['gitStatus']>();
        if (err || !stdout) {
          resolve(map);
          return;
        }
        for (const line of stdout.split(/\r?\n/)) {
          if (line.length < 4) continue;
          const xy = line.slice(0, 2);
          const relPath = line.slice(3).trim().replace(/\\/g, '/');
          let status: ProjectFile['gitStatus'] = 'M';
          if (xy === '??') status = 'U';
          else if (xy.includes('A')) status = 'A';
          else if (xy.includes('D')) status = 'D';
          map.set(relPath, status);
        }
        resolve(map);
      },
    );
  });
}

/**
 * GET /api/v1/fs/list
 * Query: projectPath, subDirectory, limit, offset
 */
fsRouter.get('/list', async (req: Request, res: Response): Promise<void> => {
  try {
    const allowedRoots = getRequestAllowedRoots(res);
    const projectPath = resolveWorkspaceProjectPath(
      (req.query.projectPath || req.query.dir || req.query.path) as string,
      getDefaultRoot(res),
    );
    const subDirectory = ((req.query.subDirectory || req.query.subdir) as string) || '';
    const limit = Math.max(1, Math.min(2000, Number(req.query.limit) || 500));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    // First validate projectPath itself
    const rootValidation = validateSafePath(projectPath, projectPath, allowedRoots);
    if (!rootValidation.isValid) {
      res.status(403).json({
        error: rootValidation.errorCode || 'PATH_NOT_ALLOWED',
        message: rootValidation.errorMessage,
      });
      return;
    }

    const safeProjectRoot = rootValidation.resolvedPath;
    if (!fs.existsSync(safeProjectRoot)) {
      res.status(404).json({
        error: 'DIRECTORY_NOT_FOUND',
        message: `Workspace directory does not exist on Windows PC: ${projectPath}`,
      });
      return;
    }

    const targetDir = subDirectory ? path.join(safeProjectRoot, subDirectory) : safeProjectRoot;
    const validation = validateSafePath(targetDir, safeProjectRoot, allowedRoots);

    if (!validation.isValid) {
      res.status(403).json({
        error: validation.errorCode || 'PATH_NOT_ALLOWED',
        message: validation.errorMessage,
      });
      return;
    }

    const safeDir = validation.resolvedPath;

    if (!fs.existsSync(safeDir)) {
      res.status(404).json({
        error: 'DIRECTORY_NOT_FOUND',
        message: `Directory does not exist: ${targetDir}`,
      });
      return;
    }

    const stat = await fs.promises.stat(safeDir);
    if (!stat.isDirectory()) {
      res.status(400).json({
        error: 'NOT_A_DIRECTORY',
        message: `Path is not a directory: ${targetDir}`,
      });
      return;
    }

    const [entries, gitStatusMap] = await Promise.all([
      fs.promises.readdir(safeDir, { withFileTypes: true }),
      queryGitDirtyMap(safeProjectRoot),
    ]);

    const visibleEntries = entries.filter((e) => e.name !== '.git');
    visibleEntries.sort((a, b) => {
      const aDir = a.isDirectory();
      const bDir = b.isDirectory();
      if (aDir && !bDir) return -1;
      if (!aDir && bDir) return 1;
      return a.name.localeCompare(b.name);
    });

    const totalCount = visibleEntries.length;
    const sliced = visibleEntries.slice(offset, offset + limit);
    const truncated = offset + sliced.length < totalCount;
    const files: ProjectFile[] = [];

    const cleanSubPrefix = subDirectory
      ? subDirectory.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
      : '';

    for (const entry of sliced) {
      const fullPath = path.join(safeDir, entry.name);
      try {
        const itemStat = await fs.promises.stat(fullPath);
        const isDir = entry.isDirectory();
        const relPath = cleanSubPrefix ? `${cleanSubPrefix}/${entry.name}` : entry.name;
        const gitStatus = gitStatusMap.get(relPath) || 'clean';

        files.push({
          name: entry.name,
          path: relPath,
          isDir,
          size: isDir ? undefined : formatFileSize(itemStat.size),
          modified: itemStat.mtime.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          gitStatus,
        });
      } catch {
        // Skip inaccessible entries
      }
    }

    res.json({
      files,
      directory: safeDir,
      totalCount,
      truncated,
    });
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Permission denied accessing directory on host.',
      });
      return;
    }
    res.status(500).json({
      error: 'FS_LIST_ERROR',
      message: error.message || 'Failed to list directory contents.',
    });
  }
});

/**
 * GET /api/v1/fs/stat
 * Query: filePath, projectPath
 */
fsRouter.get('/stat', async (req: Request, res: Response): Promise<void> => {
  try {
    const allowedRoots = getRequestAllowedRoots(res);
    const filePath = (req.query.filePath || req.query.path) as string;
    const projectPath = resolveWorkspaceProjectPath(
      (req.query.projectPath || req.query.dir) as string,
      getDefaultRoot(res),
    );

    if (!filePath) {
      res.status(400).json({ error: 'INVALID_PATH', message: 'filePath is required.' });
      return;
    }

    const validation = validateSafePath(filePath, projectPath, allowedRoots);
    if (!validation.isValid) {
      res.status(403).json({
        error: validation.errorCode || 'PATH_NOT_ALLOWED',
        message: validation.errorMessage,
      });
      return;
    }

    const safePath = validation.resolvedPath;
    if (!fs.existsSync(safePath)) {
      res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: `Path does not exist: ${filePath}`,
      });
      return;
    }

    const stat = await fs.promises.stat(safePath);
    let readonly = false;
    try {
      await fs.promises.access(safePath, fs.constants.W_OK);
    } catch {
      readonly = true;
    }

    res.json({
      name: path.basename(safePath),
      path: validation.relativeToRoot || filePath,
      fullPath: safePath,
      type: stat.isDirectory() ? 'folder' : 'file',
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
      readonly,
    });
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    res.status(500).json({
      error: 'FS_STAT_ERROR',
      message: error.message || 'Failed to read file metadata.',
    });
  }
});

/**
 * GET /api/v1/fs/read
 * Query: filePath, projectPath
 */
fsRouter.get('/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const allowedRoots = getRequestAllowedRoots(res);
    const filePath = (req.query.filePath || req.query.path) as string;
    const projectPath = resolveWorkspaceProjectPath(
      (req.query.projectPath || req.query.dir) as string,
      getDefaultRoot(res),
    );

    if (!filePath) {
      res.status(400).json({ error: 'INVALID_PATH', message: 'filePath is required.' });
      return;
    }

    const validation = validateSafePath(filePath, projectPath, allowedRoots);
    if (!validation.isValid) {
      res.status(403).json({
        error: validation.errorCode || 'PATH_NOT_ALLOWED',
        message: validation.errorMessage,
      });
      return;
    }

    const safePath = validation.resolvedPath;

    if (!fs.existsSync(safePath)) {
      res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: `File does not exist: ${filePath}`,
      });
      return;
    }

    const stat = await fs.promises.stat(safePath);
    if (stat.isDirectory()) {
      res.status(400).json({
        error: 'IS_DIRECTORY',
        message: `Specified path is a directory, not a file: ${filePath}`,
      });
      return;
    }

    if (stat.size > MAX_TEXT_FILE_BYTES) {
      res.status(413).json({
        error: 'FILE_TOO_LARGE',
        message: `File is too large (${formatFileSize(stat.size)}) to open safely in mobile editor. Max supported size is 5 MB.`,
        sizeBytes: stat.size,
      });
      return;
    }

    const buffer = await fs.promises.readFile(safePath);
    const isBinary = isBinaryBuffer(buffer);
    const hash = computeSha256(buffer);

    if (isBinary) {
      res.json({
        filePath,
        content: `[Binary file — ${formatFileSize(stat.size)}. Inline editing is disabled for binary files.]`,
        sizeBytes: stat.size,
        encoding: 'binary',
        lastModified: stat.mtime.toISOString(),
        hash,
      });
      return;
    }

    res.json({
      filePath,
      content: buffer.toString('utf-8'),
      sizeBytes: stat.size,
      encoding: 'utf-8',
      lastModified: stat.mtime.toISOString(),
      hash,
    });
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Permission denied reading file on host.',
      });
      return;
    }
    res.status(500).json({
      error: 'FS_READ_ERROR',
      message: error.message || 'Failed to read file.',
    });
  }
});

/**
 * POST /api/v1/fs/write
 * Body: { filePath, content, expectedVersionHash, projectPath }
 */
fsRouter.post('/write', async (req: Request, res: Response): Promise<void> => {
  try {
    const allowedRoots = getRequestAllowedRoots(res);
    const { filePath, content, expectedVersionHash, projectPath } = req.body || {};

    if (!filePath || typeof content !== 'string') {
      res.status(400).json({
        error: 'INVALID_PAYLOAD',
        message: 'filePath and string content are required.',
      });
      return;
    }

    const baseProject = resolveWorkspaceProjectPath(projectPath, getDefaultRoot(res));
    const validation = validateSafePath(filePath, baseProject, allowedRoots);
    if (!validation.isValid) {
      res.status(403).json({
        error: validation.errorCode || 'PATH_NOT_ALLOWED',
        message: validation.errorMessage,
      });
      return;
    }

    const safePath = validation.resolvedPath;

    if (expectedVersionHash && fs.existsSync(safePath)) {
      const existingBuffer = await fs.promises.readFile(safePath);
      const existingHash = computeSha256(existingBuffer);

      if (existingHash !== expectedVersionHash) {
        res.status(409).json({
          error: 'FILE_CONFLICT',
          message:
            'The file on the host has been modified since you opened it. Reload the latest version before saving.',
          currentHash: existingHash,
          expectedHash: expectedVersionHash,
        });
        return;
      }
    }

    const parentDir = path.dirname(safePath);
    await fs.promises.mkdir(parentDir, { recursive: true });

    const tempPath = path.join(
      parentDir,
      `.tmp.${Date.now()}.${Math.random().toString(16).slice(2)}`,
    );
    const buffer = Buffer.from(content, 'utf-8');

    await fs.promises.writeFile(tempPath, buffer);
    await fs.promises.rename(tempPath, safePath);

    const newHash = computeSha256(buffer);
    const stat = await fs.promises.stat(safePath);

    res.json({
      success: true,
      bytesWritten: buffer.length,
      newHash,
      lastModified: stat.mtime.toISOString(),
    });
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Permission denied writing file on host.',
      });
      return;
    }
    res.status(500).json({
      error: 'FS_WRITE_ERROR',
      message: error.message || 'Failed to write file to disk.',
    });
  }
});

/**
 * POST /api/v1/fs/create
 * Body: { directoryPath, fileName, isTextOnly, isFolder, projectPath, content }
 */
fsRouter.post('/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const allowedRoots = getRequestAllowedRoots(res);
    const { directoryPath, fileName, isTextOnly, isFolder, projectPath, content } = req.body || {};

    if (!fileName || typeof fileName !== 'string' || !fileName.trim()) {
      res.status(400).json({ error: 'INVALID_NAME', message: 'fileName is required.' });
      return;
    }

    const trimmedName = fileName.trim();
    if (trimmedName.includes('/') || trimmedName.includes('\\') || trimmedName === '.' || trimmedName === '..') {
      res.status(400).json({
        error: 'INVALID_NAME',
        message: 'Name cannot contain directory separators or traversal segments.',
      });
      return;
    }

    const cleanName =
      !isFolder && isTextOnly && !trimmedName.includes('.')
        ? `${trimmedName}.txt`
        : trimmedName;

    if (RESERVED_NAMES.test(cleanName)) {
      res.status(400).json({
        error: 'INVALID_NAME',
        message: `"${cleanName}" is a reserved Windows device name.`,
      });
      return;
    }

    const baseProject = resolveWorkspaceProjectPath(projectPath || directoryPath, getDefaultRoot(res));
    const projectValidation = validateSafePath(baseProject, baseProject, allowedRoots);
    if (!projectValidation.isValid) {
      res.status(403).json({
        error: projectValidation.errorCode || 'PATH_NOT_ALLOWED',
        message: projectValidation.errorMessage,
      });
      return;
    }

    const safeProjectRoot = projectValidation.resolvedPath;
    if (!fs.existsSync(safeProjectRoot)) {
      res.status(404).json({
        error: 'DIRECTORY_NOT_FOUND',
        message: `Workspace directory does not exist: ${baseProject}`,
      });
      return;
    }

    const targetParent =
      directoryPath && directoryPath.trim()
        ? path.isAbsolute(directoryPath)
          ? path.resolve(directoryPath)
          : path.resolve(safeProjectRoot, directoryPath)
        : safeProjectRoot;

    const targetPath = path.join(targetParent, cleanName);
    const validation = validateSafePath(targetPath, safeProjectRoot, allowedRoots);
    if (!validation.isValid) {
      res.status(403).json({
        error: validation.errorCode || 'PATH_NOT_ALLOWED',
        message: validation.errorMessage,
      });
      return;
    }

    const safePath = validation.resolvedPath;

    if (fs.existsSync(safePath)) {
      res.status(409).json({
        error: 'FILE_ALREADY_EXISTS',
        message: `Target already exists: ${cleanName}`,
      });
      return;
    }

    const relPath = path.relative(safeProjectRoot, safePath).replace(/\\/g, '/');

    if (isFolder) {
      await fs.promises.mkdir(safePath, { recursive: true });
      const stat = await fs.promises.stat(safePath);
      const createdFolder: ProjectFile = {
        name: cleanName,
        path: relPath,
        isDir: true,
        modified: stat.mtime.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        gitStatus: 'clean',
        children: [],
      };
      res.status(201).json(createdFolder);
      return;
    }

    await fs.promises.mkdir(path.dirname(safePath), { recursive: true });
    const initialContent = typeof content === 'string' ? content : '';
    await fs.promises.writeFile(safePath, initialContent, 'utf-8');

    const stat = await fs.promises.stat(safePath);

    const createdFile: ProjectFile = {
      name: cleanName,
      path: relPath,
      isDir: false,
      size: formatFileSize(stat.size),
      modified: stat.mtime.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      gitStatus: 'U',
      content: initialContent,
    };

    res.status(201).json(createdFile);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    res.status(500).json({
      error: 'FS_CREATE_ERROR',
      message: error.message || 'Failed to create file or folder.',
    });
  }
});

/**
 * POST /api/v1/fs/rename
 * Body: { projectPath, oldPath, newName }
 */
fsRouter.post('/rename', async (req: Request, res: Response): Promise<void> => {
  try {
    const allowedRoots = getRequestAllowedRoots(res);
    const { projectPath, oldPath, newName } = req.body || {};

    if (!oldPath || typeof oldPath !== 'string' || !newName || typeof newName !== 'string') {
      res.status(400).json({
        error: 'INVALID_PAYLOAD',
        message: 'oldPath and newName are required.',
      });
      return;
    }

    const trimmedNewName = newName.trim();
    if (
      !trimmedNewName ||
      trimmedNewName.includes('/') ||
      trimmedNewName.includes('\\') ||
      trimmedNewName === '.' ||
      trimmedNewName === '..' ||
      RESERVED_NAMES.test(trimmedNewName)
    ) {
      res.status(400).json({
        error: 'INVALID_NAME',
        message: `"${newName}" is not a valid file or folder name.`,
      });
      return;
    }

    const baseProject = resolveWorkspaceProjectPath(projectPath, getDefaultRoot(res));
    const projectVal = validateSafePath(baseProject, baseProject, allowedRoots);
    if (!projectVal.isValid) {
      res.status(403).json({
        error: projectVal.errorCode || 'PATH_NOT_ALLOWED',
        message: projectVal.errorMessage,
      });
      return;
    }

    const safeProjectRoot = projectVal.resolvedPath;
    const oldVal = validateSafePath(oldPath, safeProjectRoot, allowedRoots);
    if (!oldVal.isValid) {
      res.status(403).json({
        error: oldVal.errorCode || 'PATH_NOT_ALLOWED',
        message: oldVal.errorMessage,
      });
      return;
    }

    const safeOldPath = oldVal.resolvedPath;
    if (
      process.platform === 'win32'
        ? safeOldPath.toLowerCase() === safeProjectRoot.toLowerCase()
        : safeOldPath === safeProjectRoot
    ) {
      res.status(403).json({
        error: 'CANNOT_RENAME_ROOT',
        message: 'Renaming the active workspace root directory is forbidden.',
      });
      return;
    }

    if (!fs.existsSync(safeOldPath)) {
      res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: `Source path does not exist: ${oldPath}`,
      });
      return;
    }

    const destCandidate = path.join(path.dirname(safeOldPath), trimmedNewName);
    const destVal = validateSafePath(destCandidate, safeProjectRoot, allowedRoots);
    if (!destVal.isValid) {
      res.status(403).json({
        error: destVal.errorCode || 'PATH_NOT_ALLOWED',
        message: destVal.errorMessage,
      });
      return;
    }

    const safeNewPath = destVal.resolvedPath;
    const isCaseOnlyRenameOnWin =
      process.platform === 'win32' &&
      safeOldPath.toLowerCase() === safeNewPath.toLowerCase() &&
      safeOldPath !== safeNewPath;

    if (!isCaseOnlyRenameOnWin && fs.existsSync(safeNewPath)) {
      res.status(409).json({
        error: 'FILE_ALREADY_EXISTS',
        message: `A file or folder named "${trimmedNewName}" already exists in this directory.`,
      });
      return;
    }

    await fs.promises.rename(safeOldPath, safeNewPath);
    const stat = await fs.promises.stat(safeNewPath);
    const relNewPath = path.relative(safeProjectRoot, safeNewPath).replace(/\\/g, '/');

    res.status(200).json({
      success: true,
      oldPath,
      newPath: relNewPath,
      name: trimmedNewName,
      type: stat.isDirectory() ? 'folder' : 'file',
    });
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    res.status(500).json({
      error: 'FS_RENAME_ERROR',
      message: error.message || 'Failed to rename item on host.',
    });
  }
});

/**
 * DELETE /api/v1/fs/delete
 * Body or query: { filePath, projectPath }
 */
fsRouter.delete('/delete', async (req: Request, res: Response): Promise<void> => {
  try {
    const allowedRoots = getRequestAllowedRoots(res);
    const filePath = (req.body?.filePath || req.query?.filePath) as string;
    const projectPath = resolveWorkspaceProjectPath(
      (req.body?.projectPath || req.query?.projectPath) as string,
      getDefaultRoot(res),
    );

    if (!filePath) {
      res.status(400).json({ error: 'INVALID_PATH', message: 'filePath is required.' });
      return;
    }

    const projectVal = validateSafePath(projectPath, projectPath, allowedRoots);
    const safeProjectRoot = projectVal.isValid
      ? projectVal.resolvedPath
      : path.resolve(projectPath);

    const validation = validateSafePath(filePath, safeProjectRoot, allowedRoots);
    if (!validation.isValid) {
      res.status(403).json({
        error: validation.errorCode || 'PATH_NOT_ALLOWED',
        message: validation.errorMessage,
      });
      return;
    }

    const safePath = validation.resolvedPath;

    const isRoot =
      process.platform === 'win32'
        ? safePath.toLowerCase() === safeProjectRoot.toLowerCase() ||
          safePath.toLowerCase() === path.resolve(process.cwd()).toLowerCase()
        : safePath === safeProjectRoot || safePath === path.resolve(process.cwd());

    if (isRoot) {
      res.status(403).json({
        error: 'CANNOT_DELETE_ROOT',
        message: 'Deleting the workspace root directory is forbidden.',
      });
      return;
    }

    if (!fs.existsSync(safePath)) {
      res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: `Target to delete does not exist: ${filePath}`,
      });
      return;
    }

    const stat = await fs.promises.stat(safePath);
    if (stat.isDirectory()) {
      await fs.promises.rm(safePath, { recursive: true, force: false });
    } else {
      await fs.promises.unlink(safePath);
    }

    res.json({ success: true, deletedPath: filePath });
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    res.status(500).json({
      error: 'FS_DELETE_ERROR',
      message: error.message || 'Failed to delete target on host.',
    });
  }
});
