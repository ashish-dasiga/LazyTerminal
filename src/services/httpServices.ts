import {
  IFileSystemService,
  IGitService,
  ListFilesRequest,
  ReadFileRequest,
  ReadFileResponse,
  WriteFileRequest,
  WriteFileResponse,
  CreateFileRequest,
  DeleteFileRequest,
  GitStatusResponse,
  GitCommitRequest,
  GitCommitResponse,
  GitPushPullResponse,
} from './contracts';
import { ProjectFile } from '../types/relay';

function getHostBaseUrl(): string {
  // If running in browser and origin is available, use relative or configured host
  if (typeof window !== 'undefined') {
    // If running on Vite dev server (port 3000), host backend is on the same port or 3000
    return window.location.origin;
  }
  return 'http://127.0.0.1:3000';
}

/**
 * Concrete implementation of IFileSystemService communicating with the PC Companion over REST.
 */
export class HttpFileSystemService implements IFileSystemService {
  private baseUrl: string;

  constructor(customBaseUrl?: string) {
    this.baseUrl = customBaseUrl || getHostBaseUrl();
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  async listFiles(req: ListFilesRequest): Promise<ProjectFile[]> {
    const params = new URLSearchParams();
    if (req.projectPath) params.set('projectPath', req.projectPath);
    if (req.subDirectory) params.set('subDirectory', req.subDirectory);

    const res = await fetch(`${this.baseUrl}/api/v1/fs/list?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to list files: ${res.statusText}`);
    }
    const data = await res.json();
    return data.files as ProjectFile[];
  }

  async readFile(req: ReadFileRequest): Promise<ReadFileResponse> {
    const params = new URLSearchParams({ filePath: req.filePath });
    const res = await fetch(`${this.baseUrl}/api/v1/fs/read?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to read file: ${res.statusText}`);
    }
    return (await res.json()) as ReadFileResponse;
  }

  async writeFile(req: WriteFileRequest): Promise<WriteFileResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/fs/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to write file: ${res.statusText}`);
    }
    return (await res.json()) as WriteFileResponse;
  }

  async createFile(req: CreateFileRequest): Promise<ProjectFile> {
    const res = await fetch(`${this.baseUrl}/api/v1/fs/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to create file: ${res.statusText}`);
    }
    return (await res.json()) as ProjectFile;
  }

  async deleteFile(req: DeleteFileRequest): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/fs/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to delete file: ${res.statusText}`);
    }
  }
}

/**
 * Concrete implementation of IGitService communicating with the PC Companion over REST.
 */
export class HttpGitService implements IGitService {
  private baseUrl: string;

  constructor(customBaseUrl?: string) {
    this.baseUrl = customBaseUrl || getHostBaseUrl();
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  async getStatus(projectPath: string): Promise<GitStatusResponse> {
    const params = new URLSearchParams({ projectPath });
    const res = await fetch(`${this.baseUrl}/api/v1/git/status?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to get Git status: ${res.statusText}`);
    }
    return (await res.json()) as GitStatusResponse;
  }

  async stageFiles(files: string[], projectPath?: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/git/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, projectPath }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to stage files: ${res.statusText}`);
    }
  }

  async unstageFiles(files: string[], projectPath?: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/git/unstage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, projectPath }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to unstage files: ${res.statusText}`);
    }
  }

  async commit(req: GitCommitRequest): Promise<GitCommitResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/git/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to commit: ${res.statusText}`);
    }
    return (await res.json()) as GitCommitResponse;
  }

  async push(branch?: string, projectPath?: string): Promise<GitPushPullResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/git/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch, projectPath }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to push: ${res.statusText}`);
    }
    return (await res.json()) as GitPushPullResponse;
  }

  async pull(branch?: string, projectPath?: string): Promise<GitPushPullResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/git/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch, projectPath }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to pull: ${res.statusText}`);
    }
    return (await res.json()) as GitPushPullResponse;
  }

  async switchBranch(branchName: string, projectPath?: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/git/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchName, projectPath }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to switch branch: ${res.statusText}`);
    }
  }

  async getDiff(projectPath: string, filePath?: string, staged?: boolean): Promise<string> {
    const params = new URLSearchParams({ projectPath });
    if (filePath) params.set('filePath', filePath);
    if (staged) params.set('staged', 'true');

    const res = await fetch(`${this.baseUrl}/api/v1/git/diff?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to get diff: ${res.statusText}`);
    }
    const data = await res.json();
    return data.diff || '';
  }

  async getBranches(projectPath: string): Promise<{ branches: string[]; currentBranch: string }> {
    const params = new URLSearchParams({ projectPath });
    const res = await fetch(`${this.baseUrl}/api/v1/git/branches?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Failed to list branches: ${res.statusText}`);
    }
    return await res.json();
  }
}
