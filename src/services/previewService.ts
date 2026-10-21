import os from 'os';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess, execFile } from 'child_process';
import { promisify } from 'util';
import { DevServer } from '../types/relay';
import { PythonPreviewResponse, DesktopAppStreamInfo } from './contracts';

const execFileAsync = promisify(execFile);

export interface ActiveServerEntry {
  server: DevServer;
  process?: ChildProcess;
  startedAt: string;
}

/**
 * Splits a command string into executable + arguments while preserving quoted strings
 * so `shell: true` is never needed (preventing DEP0190 and command injection).
 */
export function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quoteChar: '"' | "'" | null = null;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quoteChar) {
      if (ch === quoteChar) {
        quoteChar = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quoteChar = ch;
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

class PreviewManager {
  private activeServers: Map<string, ActiveServerEntry> = new Map();

  /**
   * Discovers primary local IPv4 address of the Windows PC host for LAN access.
   */
  public getHostLanIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;
      for (const iface of netList) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  /**
   * Checks whether a port is currently open / in use on localhost.
   */
  public async isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Lists all tracked dev servers.
   */
  public listDevServers(): DevServer[] {
    return Array.from(this.activeServers.values()).map((entry) => entry.server);
  }

  /**
   * Starts or registers a development HTTP server safely without shell:true deprecation warnings.
   */
  public async startDevServer(
    command: string,
    port: number,
    workingDir: string = process.cwd()
  ): Promise<DevServer> {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      throw new Error(`Invalid preview port '${port}'. Must be an integer between 1024 and 65535.`);
    }

    const resolvedDir = path.resolve(workingDir);
    if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
      throw new Error(`Working directory '${resolvedDir}' does not exist.`);
    }

    const tokens = tokenizeCommand(command.trim());
    if (tokens.length === 0) {
      throw new Error('Preview start command cannot be empty.');
    }

    const serverId = `srv-${port}`;
    const lanIp = this.getHostLanIp();

    // Check if port is already running our server
    const existing = this.activeServers.get(serverId);
    if (existing && existing.server.status === 'active') {
      return existing.server;
    }

    // Check if port is in use by another external service
    const portOccupied = await this.isPortInUse(port);

    const devServer: DevServer = {
      id: serverId,
      port,
      url: `http://${lanIp}:${port}`,
      name: `Dev Server (:${port})`,
      framework: command.includes('vite') ? 'Vite Dev Server' : 'Local Web Server',
      status: portOccupied ? 'active' : 'restarting',
      tunnelLatencyMs: 14,
      route: '/',
    };

    if (portOccupied) {
      this.activeServers.set(serverId, {
        server: devServer,
        startedAt: new Date().toISOString(),
      });
      return devServer;
    }

    const mainCmd = tokens[0];
    const args = tokens.slice(1);
    const isWindows = process.platform === 'win32';
    const cmdLower = mainCmd.toLowerCase();
    const isBatchCmd =
      isWindows &&
      (cmdLower === 'npm' || cmdLower === 'npx' || cmdLower.endsWith('.cmd') || cmdLower.endsWith('.bat'));

    const spawnBin = isBatchCmd ? 'cmd.exe' : mainCmd;
    const spawnArgs = isBatchCmd ? ['/d', '/s', '/c', mainCmd, ...args] : args;

    try {
      const proc = spawn(spawnBin, spawnArgs, {
        cwd: resolvedDir,
        shell: false,
        env: { ...process.env, PORT: port.toString() },
        windowsHide: true,
      });

      proc.on('close', () => {
        const item = this.activeServers.get(serverId);
        if (item) {
          item.server.status = 'idle';
        }
      });

      proc.on('error', () => {
        const item = this.activeServers.get(serverId);
        if (item) {
          item.server.status = 'idle';
        }
      });

      devServer.status = 'active';
      this.activeServers.set(serverId, {
        server: devServer,
        process: proc,
        startedAt: new Date().toISOString(),
      });

      return devServer;
    } catch {
      devServer.status = 'idle';
      this.activeServers.set(serverId, {
        server: devServer,
        startedAt: new Date().toISOString(),
      });
      return devServer;
    }
  }

  /**
   * Stops an active dev server and kills its process tree.
   */
  public async stopDevServer(serverId: string): Promise<void> {
    const entry = this.activeServers.get(serverId);
    if (!entry) return;

    if (entry.process && entry.process.pid) {
      const pid = entry.process.pid;
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', pid.toString(), '/T', '/F'], { windowsHide: true });
      } else {
        entry.process.kill('SIGTERM');
      }
    }

    entry.server.status = 'idle';
    this.activeServers.delete(serverId);
  }

  /**
   * Executes a Python preview script and collects output metrics.
   */
  public async runPythonPreview(scriptPath: string): Promise<PythonPreviewResponse> {
    const startTime = Date.now();
    try {
      let args = [scriptPath];
      if (scriptPath.startsWith('-c ')) {
        args = ['-c', scriptPath.slice(3).replace(/^["']|["']$/g, '')];
      }
      const { stdout, stderr } = await execFileAsync('python', args, {
        timeout: 10000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      return {
        scriptPath,
        exitCode: 0,
        stdout: stdout || '(No stdout produced)',
        stderr: stderr || '',
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        scriptPath,
        exitCode: typeof err.code === 'number' ? err.code : 1,
        stdout: err.stdout || '',
        stderr: err.stderr || err.message,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Returns metadata and unsupported indicator for files that cannot be web-previewed.
   */
  public inspectFilePreviewCapability(fileName: string): {
    supported: boolean;
    category: 'web' | 'python' | 'desktop' | 'unsupported';
    reason?: string;
  } {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['html', 'htm', 'js', 'jsx', 'ts', 'tsx', 'css'].includes(ext || '')) {
      return { supported: true, category: 'web' };
    }
    if (['py'].includes(ext || '')) {
      return { supported: true, category: 'python' };
    }
    if (['exe', 'app'].includes(ext || '')) {
      return {
        supported: false,
        category: 'desktop',
        reason: `${fileName} is a native desktop executable. Native GUI window streaming (WebRTC/Win32 capture) is unsupported in the local-first MVP; use Web Dev Server preview instead.`,
      };
    }
    return {
      supported: false,
      category: 'unsupported',
      reason: `${fileName} is a compiled or binary asset that cannot be rendered as a Web preview or Python console.`,
    };
  }

  /**
   * Reports honest unsupported status for native desktop GUI streaming in MVP (Phase S5).
   */
  public getDesktopAppStream(appId: string): DesktopAppStreamInfo {
    return {
      appId,
      appName: 'Native Windows GUI Stream (Unsupported in MVP)',
      windowTitle: 'Native Desktop Window Capture Unavailable',
      isStreamActive: false,
      fps: 0,
      resolution: 'Unsupported in MVP (Web preview only; native Win32/WebRTC capture not enabled)',
      streamUrl: '',
    };
  }
}

export const previewManager = new PreviewManager();
