import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { validateSafePath, resolveWorkspaceProjectPath } from './fsSecurity';
import { ProjectFile } from '../types/relay';

export const fsRouter = Router();

// 5 MB maximum size for inline text editing
const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024;

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

/**
 * GET /api/v1/fs/list
 * Query: projectPath, subDirectory
 */
fsRouter.get('/list', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectPath = resolveWorkspaceProjectPath(req.query.projectPath as string);
    const subDirectory = (req.query.subDirectory as string) || '';

    const targetDir = subDirectory ? path.join(projectPath, subDirectory) : projectPath;
    const validation = validateSafePath(targetDir, projectPath);

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

    const entries = await fs.promises.readdir(safeDir, { withFileTypes: true });
    const files: ProjectFile[] = [];

    for (const entry of entries) {
      // Skip git internal directory by default in listings
      if (entry.name === '.git') continue;

      const fullPath = path.join(safeDir, entry.name);

      try {
        const itemStat = await fs.promises.stat(fullPath);
        const isDir = entry.isDirectory();

        files.push({
          name: entry.name,
          path: subDirectory ? `${subDirectory.replace(/\\/g, '/')}/${entry.name}` : entry.name,
          isDir,
          size: isDir ? undefined : formatFileSize(itemStat.size),
          modified: itemStat.mtime.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          gitStatus: 'clean',
        });
      } catch {
        // Skip inaccessible entries
      }
    }

    // Sort: directories first, then alphabetical
    files.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });

    res.json({ files, directory: safeDir });
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'EACCES') {
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
 * GET /api/v1/fs/read
 * Query: filePath, projectPath
 */
fsRouter.get('/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const filePath = req.query.filePath as string;
    const projectPath = resolveWorkspaceProjectPath(req.query.projectPath as string);

    if (!filePath) {
      res.status(400).json({ error: 'INVALID_PATH', message: 'filePath is required.' });
      return;
    }

    const validation = validateSafePath(filePath, projectPath);
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
        content: `[Binary file - size: ${formatFileSize(stat.size)}]`,
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
    if (error.code === 'EACCES') {
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
    const { filePath, content, expectedVersionHash, projectPath } = req.body;

    if (!filePath || typeof content !== 'string') {
      res.status(400).json({
        error: 'INVALID_PAYLOAD',
        message: 'filePath and string content are required.',
      });
      return;
    }

    const validation = validateSafePath(filePath, resolveWorkspaceProjectPath(projectPath));
    if (!validation.isValid) {
      res.status(403).json({
        error: validation.errorCode || 'PATH_NOT_ALLOWED',
        message: validation.errorMessage,
      });
      return;
    }

    const safePath = validation.resolvedPath;

    // Detect concurrent / external modification conflicts
    if (expectedVersionHash && fs.existsSync(safePath)) {
      const existingBuffer = await fs.promises.readFile(safePath);
      const existingHash = computeSha256(existingBuffer);

      if (existingHash !== expectedVersionHash) {
        res.status(409).json({
          error: 'FILE_CONFLICT',
          message: 'The file on the host has been modified since you opened it. Please reload the latest version to prevent overwriting external changes.',
          currentHash: existingHash,
          expectedHash: expectedVersionHash,
        });
        return;
      }
    }

    // Atomic write via temp file in same directory
    const parentDir = path.dirname(safePath);
    await fs.promises.mkdir(parentDir, { recursive: true });

    const tempPath = path.join(parentDir, `.tmp.${Date.now()}.${Math.random().toString(16).slice(2)}`);
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
    if (error.code === 'EACCES') {
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
 * Body: { directoryPath, fileName, isTextOnly, isFolder, projectPath }
 */
fsRouter.post('/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const { directoryPath, fileName, isTextOnly, isFolder, projectPath } = req.body;

    if (!fileName || typeof fileName !== 'string') {
      res.status(400).json({ error: 'INVALID_NAME', message: 'fileName is required.' });
      return;
    }

    if (fileName.includes('/') || fileName.includes('\\')) {
      res.status(400).json({
        error: 'INVALID_NAME',
        message: 'Name cannot contain directory separators.',
      });
      return;
    }

    const cleanName = !isFolder && isTextOnly && !fileName.includes('.') ? `${fileName}.txt` : fileName;
    const baseDir = resolveWorkspaceProjectPath(directoryPath || projectPath);
    const targetPath = path.join(baseDir, cleanName);

    const validation = validateSafePath(targetPath, baseDir);
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

    if (isFolder) {
      await fs.promises.mkdir(safePath, { recursive: true });
      const createdFolder: ProjectFile = {
        name: cleanName,
        path: cleanName,
        isDir: true,
        modified: 'Just now',
        gitStatus: 'clean',
        children: [],
      };
      res.status(201).json(createdFolder);
      return;
    }

    const initialContent = cleanName.endsWith('.txt') ? '# New text file\n' : '// New file\n';
    await fs.promises.writeFile(safePath, initialContent, 'utf-8');

    const stat = await fs.promises.stat(safePath);

    const createdFile: ProjectFile = {
      name: cleanName,
      path: cleanName,
      isDir: false,
      size: formatFileSize(stat.size),
      modified: 'Just now',
      gitStatus: 'U',
      content: initialContent,
    };

    res.status(201).json(createdFile);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    res.status(500).json({
      error: 'FS_CREATE_ERROR',
      message: error.message || 'Failed to create file.',
    });
  }
});

/**
 * DELETE /api/v1/fs/delete
 * Body or query: { filePath, projectPath }
 */
fsRouter.delete('/delete', async (req: Request, res: Response): Promise<void> => {
  try {
    const filePath = (req.body?.filePath || req.query?.filePath) as string;
    const projectPath = resolveWorkspaceProjectPath((req.body?.projectPath || req.query?.projectPath) as string);

    if (!filePath) {
      res.status(400).json({ error: 'INVALID_PATH', message: 'filePath is required.' });
      return;
    }

    const validation = validateSafePath(filePath, projectPath);
    if (!validation.isValid) {
      res.status(403).json({
        error: validation.errorCode || 'PATH_NOT_ALLOWED',
        message: validation.errorMessage,
      });
      return;
    }

    const safePath = validation.resolvedPath;

    // Disallow deleting the root workspace directory
    if (safePath === path.resolve(projectPath) || safePath === path.resolve(process.cwd())) {
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
      await fs.promises.rm(safePath, { recursive: true, force: true });
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
