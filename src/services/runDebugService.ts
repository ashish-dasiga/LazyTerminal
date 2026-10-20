import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

export interface ProjectTaskDefinition {
  id: string;
  name: string;
  description: string;
  cmd: string;
  args: string[];
  workingDir: string;
  category: 'node' | 'cargo' | 'python' | 'custom';
}

export interface TaskProcessRecord {
  taskId: string;
  name: string;
  cmd: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  pid?: number;
  startTime?: string;
  exitCode?: number | null;
  outputLines: string[];
  portsDetected: number[];
}

export interface ProjectInspectionResult {
  projectPath: string;
  projectType: string;
  availableTasks: ProjectTaskDefinition[];
}

class RunDebugManager {
  private activeProcesses: Map<string, { process: ChildProcess; record: TaskProcessRecord }> = new Map();
  private history: Map<string, TaskProcessRecord> = new Map();

  /**
   * Inspects a workspace directory to discover package.json scripts, Cargo.toml, or Python scripts.
   */
  public inspectProject(targetDir: string): ProjectInspectionResult {
    const resolvedPath = path.resolve(targetDir);
    const tasks: ProjectTaskDefinition[] = [];
    let projectType = 'Generic Workspace';

    if (!fs.existsSync(resolvedPath)) {
      return { projectPath: resolvedPath, projectType: 'Path Not Found', availableTasks: [] };
    }

    // 1. Check for package.json
    const packageJsonPath = path.join(resolvedPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        projectType = 'Node.js / Web Project';
        if (pkg.scripts && typeof pkg.scripts === 'object') {
          for (const [scriptName, scriptCmd] of Object.entries(pkg.scripts)) {
            tasks.push({
              id: `npm-${scriptName}`,
              name: `npm run ${scriptName}`,
              description: typeof scriptCmd === 'string' ? scriptCmd : `npm script ${scriptName}`,
              cmd: 'npm',
              args: ['run', scriptName],
              workingDir: resolvedPath,
              category: 'node',
            });
          }
        }
      } catch {
        // Ignore JSON parse errors in user files
      }
    }

    // 2. Check for Cargo.toml
    const cargoTomlPath = path.join(resolvedPath, 'Cargo.toml');
    if (fs.existsSync(cargoTomlPath)) {
      projectType = projectType === 'Generic Workspace' ? 'Rust / Cargo Project' : `${projectType} + Rust`;
      tasks.push(
        {
          id: 'cargo-build',
          name: 'cargo build',
          description: 'Compile binaries in development mode',
          cmd: 'cargo',
          args: ['build'],
          workingDir: resolvedPath,
          category: 'cargo',
        },
        {
          id: 'cargo-test',
          name: 'cargo test',
          description: 'Execute unit and integration tests',
          cmd: 'cargo',
          args: ['test'],
          workingDir: resolvedPath,
          category: 'cargo',
        },
        {
          id: 'cargo-clippy',
          name: 'cargo clippy',
          description: 'Run linter and static code inspections',
          cmd: 'cargo',
          args: ['clippy'],
          workingDir: resolvedPath,
          category: 'cargo',
        }
      );
    }

    // 3. Check for Python
    const hasPyProject = fs.existsSync(path.join(resolvedPath, 'pyproject.toml'));
    const hasReqs = fs.existsSync(path.join(resolvedPath, 'requirements.txt'));
    if (hasPyProject || hasReqs) {
      projectType = projectType === 'Generic Workspace' ? 'Python Project' : `${projectType} + Python`;
      tasks.push({
        id: 'python-pytest',
        name: 'pytest',
        description: 'Run Python test suite',
        cmd: 'pytest',
        args: [],
        workingDir: resolvedPath,
        category: 'python',
      });
    }

    return {
      projectPath: resolvedPath,
      projectType,
      availableTasks: tasks,
    };
  }

  /**
   * Starts a project task safely without raw shell concatenation.
   */
  public startTask(
    taskId: string,
    command: string,
    args: string[] = [],
    workingDir: string = process.cwd()
  ): TaskProcessRecord {
    // If a process with this taskId is already running, return its record
    const existing = this.activeProcesses.get(taskId);
    if (existing && existing.record.status === 'running') {
      return existing.record;
    }

    const record: TaskProcessRecord = {
      taskId,
      name: `${command} ${args.join(' ')}`.trim(),
      cmd: `${command} ${args.join(' ')}`.trim(),
      status: 'running',
      startTime: new Date().toISOString(),
      outputLines: [`[Process started at ${new Date().toLocaleTimeString()} in ${workingDir}]`],
      portsDetected: [],
    };

    try {
      const isWindows = process.platform === 'win32';
      const cmdLower = command.toLowerCase();
      const needsShell = isWindows && (cmdLower === 'npm' || cmdLower === 'npx' || cmdLower.endsWith('.cmd') || cmdLower.endsWith('.bat'));
      const proc = spawn(command, args, {
        cwd: workingDir,
        shell: needsShell,
        env: { ...process.env, FORCE_COLOR: '0' },
        windowsHide: true,
      });

      record.pid = proc.pid;

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        const lines = text.split(/[\r\n]+/).filter(Boolean);
        for (const line of lines) {
          record.outputLines.push(line);
          // Detect port bindings in logs (e.g., localhost:3000, port 5173, etc.)
          const portMatch = line.match(/(?:localhost|127\.0\.0\.1|port)\s*[:= ]\s*(\d{4,5})/i);
          if (portMatch) {
            const portNum = parseInt(portMatch[1], 10);
            if (!record.portsDetected.includes(portNum)) {
              record.portsDetected.push(portNum);
            }
          }
        }
        if (record.outputLines.length > 500) {
          record.outputLines = record.outputLines.slice(-500);
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        const lines = text.split(/[\r\n]+/).filter(Boolean);
        for (const line of lines) {
          record.outputLines.push(`[stderr] ${line}`);
        }
      });

      proc.on('close', (code: number | null) => {
        record.status = code === 0 ? 'completed' : 'error';
        record.exitCode = code;
        record.outputLines.push(`[Process exited with code ${code}]`);
        this.activeProcesses.delete(taskId);
        this.history.set(taskId, record);
      });

      proc.on('error', (err: Error) => {
        record.status = 'error';
        record.outputLines.push(`[Process spawn error: ${err.message}]`);
        this.activeProcesses.delete(taskId);
        this.history.set(taskId, record);
      });

      this.activeProcesses.set(taskId, { process: proc, record });
      this.history.set(taskId, record);
      return record;
    } catch (err: any) {
      record.status = 'error';
      record.outputLines.push(`[Failed to launch: ${err.message}]`);
      this.history.set(taskId, record);
      return record;
    }
  }

  /**
   * Stops a running task process safely.
   */
  public stopTask(taskId: string): boolean {
    const entry = this.activeProcesses.get(taskId);
    if (!entry) return false;

    try {
      const pid = entry.process.pid;
      if (pid) {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', pid.toString(), '/T', '/F'], { windowsHide: true });
        } else {
          entry.process.kill('SIGTERM');
        }
      }
      entry.record.status = 'completed';
      entry.record.outputLines.push('[Process terminated by user]');
      this.activeProcesses.delete(taskId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the current record for a task.
   */
  public getTaskStatus(taskId: string): TaskProcessRecord | null {
    const active = this.activeProcesses.get(taskId);
    if (active) return active.record;
    return this.history.get(taskId) || null;
  }

  /**
   * Lists all tracked task records.
   */
  public listAllTasks(): TaskProcessRecord[] {
    const records = new Map<string, TaskProcessRecord>(this.history);
    for (const [id, entry] of this.activeProcesses.entries()) {
      records.set(id, entry.record);
    }
    return Array.from(records.values());
  }
}

export const runDebugManager = new RunDebugManager();
