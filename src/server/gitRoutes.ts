import { Router, Request, Response } from 'express';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { validateSafePath, resolveWorkspaceProjectPath } from './fsSecurity';
import { GitCommitRequest, GitCommitResponse, GitPushPullResponse, GitStatusResponse } from '../services/contracts';

export const gitRouter = Router();

function runGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }));
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
  });
}

async function verifyGitRepository(repoPath: string): Promise<boolean> {
  try {
    const { stdout } = await runGit(['rev-parse', '--is-inside-work-tree'], repoPath);
    return stdout === 'true';
  } catch {
    return false;
  }
}

/**
 * GET /api/v1/git/status
 * Query: projectPath
 */
gitRouter.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectPath = resolveWorkspaceProjectPath((req.query.projectPath || req.query.project || req.query.dir) as string || process.cwd());
    const validation = validateSafePath(projectPath);

    if (!validation.isValid) {
      res.status(403).json({
        error: validation.errorCode || 'PATH_NOT_ALLOWED',
        message: validation.errorMessage,
      });
      return;
    }

    const repoPath = validation.resolvedPath;
    const isGit = await verifyGitRepository(repoPath);

    if (!isGit) {
      res.status(404).json({
        error: 'NOT_A_GIT_REPOSITORY',
        message: `The directory "${projectPath}" is not a Git repository.`,
      });
      return;
    }

    // Run git status porcelain with branch info
    const { stdout: statusOutput } = await runGit(['status', '--porcelain=v1', '-b'], repoPath);

    const lines = statusOutput.split('\n').filter((l) => l.trim().length > 0);
    let branch = 'unknown';
    let ahead = 0;
    let behind = 0;

    const changedFiles: GitStatusResponse['changedFiles'] = [];

    for (const line of lines) {
      if (line.startsWith('##')) {
        // e.g. "## main...origin/main [ahead 1, behind 2]" or "## No commits yet on main"
        const branchHeader = line.substring(2).trim();
        const branchMatch = branchHeader.match(/^([^\s.]+)/);
        if (branchMatch) {
          branch = branchMatch[1];
        }

        const aheadMatch = branchHeader.match(/ahead (\d+)/);
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);

        const behindMatch = branchHeader.match(/behind (\d+)/);
        if (behindMatch) behind = parseInt(behindMatch[1], 10);
      } else {
        const x = line[0];
        const y = line[1];
        const filePath = line.substring(3).trim();

        if (x === '?' && y === '?') {
          changedFiles.push({
            path: filePath,
            status: 'U',
            staged: false,
          });
        } else {
          // Check staged (X column)
          if (x !== ' ' && x !== '?') {
            changedFiles.push({
              path: filePath,
              status: x === 'A' ? 'A' : x === 'D' ? 'D' : 'M',
              staged: true,
            });
          }
          // Check unstaged (Y column)
          if (y !== ' ' && y !== '?') {
            changedFiles.push({
              path: filePath,
              status: y === 'D' ? 'D' : 'M',
              staged: false,
            });
          }
        }
      }
    }

    // Get last commit info
    let lastCommit = {
      hash: '',
      message: 'No commits yet',
      author: '',
      time: '',
    };

    try {
      const { stdout: logOutput } = await runGit(
        ['log', '-1', '--format=%H%x00%s%x00%an%x00%cr'],
        repoPath
      );
      if (logOutput) {
        const [hash, message, author, time] = logOutput.split('\0');
        lastCommit = {
          hash: hash ? hash.substring(0, 7) : '',
          message: message || '',
          author: author || '',
          time: time || '',
        };
      }
    } catch {
      // Repository may have no commits yet
    }

    const response: GitStatusResponse = {
      projectPath: repoPath,
      branch,
      isDirty: changedFiles.length > 0,
      dirtyFilesCount: changedFiles.length,
      ahead,
      behind,
      lastCommit,
      changedFiles,
    };

    res.json(response);
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    res.status(500).json({
      error: 'GIT_STATUS_FAILED',
      message: error.stderr || error.message || 'Failed to inspect Git status.',
    });
  }
});

/**
 * GET /api/v1/git/diff
 * Query: projectPath, filePath, staged
 */
gitRouter.get('/diff', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectPath = (req.query.projectPath as string) || process.cwd();
    const filePath = req.query.filePath as string | undefined;
    const isStaged = req.query.staged === 'true';

    const validation = validateSafePath(projectPath);
    if (!validation.isValid) {
      res.status(403).json({ error: 'PATH_NOT_ALLOWED', message: validation.errorMessage });
      return;
    }

    const repoPath = validation.resolvedPath;
    const args = ['diff'];
    if (isStaged) {
      args.push('--cached');
    }
    if (filePath) {
      args.push('--', filePath);
    }

    const { stdout } = await runGit(args, repoPath);
    res.json({ diff: stdout });
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    res.status(500).json({
      error: 'GIT_DIFF_FAILED',
      message: error.stderr || error.message || 'Failed to generate git diff.',
    });
  }
});

/**
 * POST /api/v1/git/stage
 * Body: { projectPath, files }
 */
gitRouter.post('/stage', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectPath, files } = req.body;
    const validation = validateSafePath(projectPath || process.cwd());

    if (!validation.isValid) {
      res.status(403).json({ error: 'PATH_NOT_ALLOWED', message: validation.errorMessage });
      return;
    }

    const repoPath = validation.resolvedPath;
    const args = ['add'];

    if (!files || files.length === 0 || files.includes('-A') || files.includes('.')) {
      args.push('-A');
    } else {
      args.push('--', ...files);
    }

    await runGit(args, repoPath);
    res.json({ success: true, stagedFiles: files || ['all'] });
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    res.status(500).json({
      error: 'GIT_STAGE_FAILED',
      message: error.stderr || error.message || 'Failed to stage files.',
    });
  }
});

/**
 * POST /api/v1/git/unstage
 * Body: { projectPath, files }
 */
gitRouter.post('/unstage', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectPath, files } = req.body;
    const validation = validateSafePath(projectPath || process.cwd());

    if (!validation.isValid) {
      res.status(403).json({ error: 'PATH_NOT_ALLOWED', message: validation.errorMessage });
      return;
    }

    const repoPath = validation.resolvedPath;
    const targetFiles = Array.isArray(files) && files.length > 0 ? files : ['.'];

    try {
      // Modern Git: restore --staged
      await runGit(['restore', '--staged', '--', ...targetFiles], repoPath);
    } catch {
      // Legacy fallback: reset HEAD
      await runGit(['reset', 'HEAD', '--', ...targetFiles], repoPath);
    }

    res.json({ success: true, unstagedFiles: targetFiles });
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    res.status(500).json({
      error: 'GIT_UNSTAGE_FAILED',
      message: error.stderr || error.message || 'Failed to unstage files.',
    });
  }
});

/**
 * POST /api/v1/git/commit
 * Body: { projectPath, message, amend }
 */
gitRouter.post('/commit', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectPath, message, amend } = req.body as GitCommitRequest;

    if (!message || !message.trim()) {
      res.status(400).json({ error: 'INVALID_COMMIT_MESSAGE', message: 'Commit message is required.' });
      return;
    }

    const validation = validateSafePath(projectPath || process.cwd());
    if (!validation.isValid) {
      res.status(403).json({ error: 'PATH_NOT_ALLOWED', message: validation.errorMessage });
      return;
    }

    const repoPath = validation.resolvedPath;
    const args = ['commit', '-m', message.trim()];
    if (amend) {
      args.push('--amend');
    }

    await runGit(args, repoPath);

    const { stdout: commitHash } = await runGit(['rev-parse', '--short', 'HEAD'], repoPath);
    const { stdout: branch } = await runGit(['branch', '--show-current'], repoPath);

    const result: GitCommitResponse = {
      commitHash,
      branch: branch || 'HEAD',
      summary: message.trim(),
    };

    res.json(result);
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    res.status(500).json({
      error: 'GIT_COMMIT_FAILED',
      message: error.stderr || error.message || 'Failed to create git commit.',
    });
  }
});

/**
 * POST /api/v1/git/checkout
 * Body: { projectPath, branchName, createNew }
 */
gitRouter.post('/checkout', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectPath, branchName, createNew } = req.body;

    if (!branchName || typeof branchName !== 'string') {
      res.status(400).json({ error: 'INVALID_BRANCH', message: 'branchName is required.' });
      return;
    }

    const validation = validateSafePath(projectPath || process.cwd());
    if (!validation.isValid) {
      res.status(403).json({ error: 'PATH_NOT_ALLOWED', message: validation.errorMessage });
      return;
    }

    const repoPath = validation.resolvedPath;

    // Validate branch name against git ref format
    try {
      await runGit(['check-ref-format', '--branch', branchName.trim()], repoPath);
    } catch {
      res.status(400).json({
        error: 'INVALID_BRANCH_NAME',
        message: `"${branchName}" is not a valid Git branch name.`,
      });
      return;
    }

    const args = createNew ? ['checkout', '-b', branchName.trim()] : ['checkout', branchName.trim()];
    const { stdout, stderr } = await runGit(args, repoPath);

    res.json({
      success: true,
      branch: branchName.trim(),
      output: stdout || stderr,
    });
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    res.status(500).json({
      error: 'GIT_CHECKOUT_FAILED',
      message: error.stderr || error.message || 'Failed to switch git branch.',
    });
  }
});

/**
 * POST /api/v1/git/push
 * Body: { projectPath, branch }
 */
gitRouter.post('/push', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectPath, branch } = req.body;
    const validation = validateSafePath(projectPath || process.cwd());

    if (!validation.isValid) {
      res.status(403).json({ error: 'PATH_NOT_ALLOWED', message: validation.errorMessage });
      return;
    }

    const repoPath = validation.resolvedPath;
    const args = ['push'];
    if (branch) {
      args.push('origin', branch);
    }

    const { stdout, stderr } = await runGit(args, repoPath);
    const { stdout: newHead } = await runGit(['rev-parse', '--short', 'HEAD'], repoPath);

    const response: GitPushPullResponse = {
      success: true,
      output: stdout || stderr || 'Branch pushed successfully.',
      newHeadCommit: newHead,
    };

    res.json(response);
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    res.status(500).json({
      error: 'GIT_PUSH_FAILED',
      message: error.stderr || error.message || 'Failed to push to remote repository.',
    });
  }
});

/**
 * POST /api/v1/git/pull
 * Body: { projectPath, branch }
 */
gitRouter.post('/pull', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectPath, branch } = req.body;
    const validation = validateSafePath(projectPath || process.cwd());

    if (!validation.isValid) {
      res.status(403).json({ error: 'PATH_NOT_ALLOWED', message: validation.errorMessage });
      return;
    }

    const repoPath = validation.resolvedPath;
    const args = ['pull'];
    if (branch) {
      args.push('origin', branch);
    }

    const { stdout, stderr } = await runGit(args, repoPath);
    const { stdout: newHead } = await runGit(['rev-parse', '--short', 'HEAD'], repoPath);

    const response: GitPushPullResponse = {
      success: true,
      output: stdout || stderr || 'Branch pulled successfully.',
      newHeadCommit: newHead,
    };

    res.json(response);
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    res.status(500).json({
      error: 'GIT_PULL_FAILED',
      message: error.stderr || error.message || 'Failed to pull from remote repository.',
    });
  }
});

/**
 * GET /api/v1/git/branches
 * Query: projectPath
 */
gitRouter.get('/branches', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectPath = (req.query.projectPath as string) || process.cwd();
    const validation = validateSafePath(projectPath);

    if (!validation.isValid) {
      res.status(403).json({ error: 'PATH_NOT_ALLOWED', message: validation.errorMessage });
      return;
    }

    const repoPath = validation.resolvedPath;
    const { stdout } = await runGit(['branch', '--list', '--format=%(refname:short)%00%(HEAD)'], repoPath);

    const branches: string[] = [];
    let currentBranch = '';

    const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines) {
      const [name, isHead] = line.split('\0');
      if (name) {
        branches.push(name.trim());
        if (isHead && isHead.trim() === '*') {
          currentBranch = name.trim();
        }
      }
    }

    res.json({ branches, currentBranch });
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    res.status(500).json({
      error: 'GIT_BRANCHES_FAILED',
      message: error.stderr || error.message || 'Failed to list branches.',
    });
  }
});
