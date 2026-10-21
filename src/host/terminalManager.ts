import { spawn, spawnSync, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import {
  CreateSessionRequest,
  ExecuteCommandRequest,
  ExecuteCommandResponse,
  SendSignalRequest,
} from '../services/contracts';
import { TerminalLine, TerminalSession } from '../types/relay';
import {
  HostConfig,
  isPathWithinAllowedRoots,
  resolveAuthorizedWorkingDir,
} from './config';
import { validateCommandSafety } from './commandGuard';
import { HostLogger } from './logger';

interface KnownCliMeta {
  cliName: string;
  toolName: string;
  installCommand: string;
}

const KNOWN_AI_CLIS: Record<string, KnownCliMeta> = {
  claude: {
    cliName: 'claude',
    toolName: 'Claude Code',
    installCommand: 'npm install -g @anthropic-ai/claude-code',
  },
  codex: {
    cliName: 'codex',
    toolName: 'OpenAI Codex CLI',
    installCommand: 'npm install -g @openai/codex-cli',
  },
  gemini: {
    cliName: 'gemini',
    toolName: 'Gemini CLI',
    installCommand: 'npm install -g @google/gemini-cli',
  },
  antigravity: {
    cliName: 'antigravity',
    toolName: 'Antigravity Agent Runtime',
    installCommand: 'antigravity-daemon --host 127.0.0.1:9872',
  },
};

interface PendingCommandExecution {
  commandId: string;
  command: string;
  lines: Array<{ type: TerminalLine['type']; content: string; delay?: number }>;
  stdoutRemainder: string;
  stderrRemainder: string;
  totalBytes: number;
  truncated: boolean;
  timeoutHandle: NodeJS.Timeout;
  resolve: (res: ExecuteCommandResponse & { workingDir: string }) => void;
}

interface ManagedSessionState {
  session: TerminalSession;
  proc: ChildProcessWithoutNullStreams | null;
  pending: PendingCommandExecution | null;
  emitter: EventEmitter;
  seqCounter: number;
}

function findExecutableOnPath(binaryNames: string[]): string | null {
  const pathEnv = process.env.PATH || process.env.Path || '';
  const pathDirs = pathEnv.split(path.delimiter).filter(Boolean);
  const pathExts =
    process.platform === 'win32'
      ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';')
      : [''];

  for (const name of binaryNames) {
    for (const dir of pathDirs) {
      for (const ext of pathExts) {
        const candidate = path.join(
          dir,
          name.toLowerCase().endsWith(ext.toLowerCase()) ? name : `${name}${ext}`
        );
        try {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
          }
        } catch {
          // ignore inaccessible PATH entry
        }
      }
    }
  }
  return null;
}

function killProcessTree(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch {
    // Process may already have exited
  }
}

export class TerminalSessionManager {
  private readonly config: HostConfig;
  private readonly logger: HostLogger;
  private readonly sessions = new Map<string, ManagedSessionState>();
  private readonly resolvedPwshBinary: string;
  private readonly resolvedCmdBinary: string;
  private readonly resolvedBashBinary: string | null;

  constructor(config: HostConfig, logger: HostLogger) {
    this.config = config;
    this.logger = logger;

    this.resolvedPwshBinary =
      findExecutableOnPath(['pwsh.exe', 'powershell.exe']) || 'powershell.exe';
    this.resolvedCmdBinary =
      findExecutableOnPath(['cmd.exe']) || process.env.ComSpec || 'cmd.exe';
    this.resolvedBashBinary = findExecutableOnPath(['bash.exe']);

    this.seedDefaultSessions();
  }

  private seedDefaultSessions(): void {
    const cwd = this.config.defaultWorkspaceRoot;
    const defaults: Array<{
      id: string;
      title: string;
      type: TerminalSession['type'];
    }> = [
      { id: 'sess-pwsh', title: 'PowerShell', type: 'powershell' },
      { id: 'sess-cmd', title: 'Command Prompt (CMD)', type: 'cmd' },
      { id: 'sess-bash', title: 'Bash (WSL / Git Bash)', type: 'bash' },
    ];

    for (const item of defaults) {
      this.sessions.set(item.id, {
        session: {
          id: item.id,
          title: item.title,
          type: item.type,
          workingDir: cwd,
          history: [],
          buffer: [],
          isRunning: false,
        },
        proc: null,
        pending: null,
        emitter: new EventEmitter(),
        seqCounter: 0,
      });
    }
  }

  public listSessions(): TerminalSession[] {
    return Array.from(this.sessions.values()).map((entry) => ({
      ...entry.session,
      history: [...entry.session.history],
      buffer: [...entry.session.buffer],
    }));
  }

  public getSession(sessionId: string): TerminalSession | undefined {
    const state = this.sessions.get(sessionId);
    if (!state) return undefined;
    return {
      ...state.session,
      history: [...state.session.history],
      buffer: [...state.session.buffer],
    };
  }

  public createSession(req: CreateSessionRequest): TerminalSession {
    const dirResult = resolveAuthorizedWorkingDir(req.workingDir, this.config);
    if (!dirResult.ok) {
      throw new Error(dirResult.error);
    }

    const id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const session: TerminalSession = {
      id,
      title: req.title || `Session (${req.type})`,
      type: req.type,
      workingDir: dirResult.resolvedPath,
      history: [],
      buffer: [],
      isRunning: false,
    };

    this.sessions.set(id, {
      session,
      proc: null,
      pending: null,
      emitter: new EventEmitter(),
      seqCounter: 0,
    });

    this.logger.info('Created terminal session', {
      sessionId: id,
      type: req.type,
      workingDir: session.workingDir,
    });

    return { ...session };
  }

  private ensureManagedSession(
    sessionId: string,
    requestedWorkingDir?: string
  ): ManagedSessionState {
    let state = this.sessions.get(sessionId);
    if (!state) {
      const dirRes = resolveAuthorizedWorkingDir(requestedWorkingDir, this.config);
      const initialDir = dirRes.ok
        ? dirRes.resolvedPath
        : this.config.defaultWorkspaceRoot;
      const inferredType: TerminalSession['type'] = sessionId.includes('cmd')
        ? 'cmd'
        : sessionId.includes('bash')
        ? 'bash'
        : 'powershell';

      state = {
        session: {
          id: sessionId,
          title:
            inferredType === 'cmd'
              ? 'Command Prompt (CMD)'
              : inferredType === 'bash'
              ? 'Bash'
              : 'PowerShell',
          type: inferredType,
          workingDir: initialDir,
          history: [],
          buffer: [],
          isRunning: false,
        },
        proc: null,
        pending: null,
        emitter: new EventEmitter(),
        seqCounter: 0,
      };
      this.sessions.set(sessionId, state);
    }
    return state;
  }

  private ensureShellProcess(state: ManagedSessionState): ChildProcessWithoutNullStreams {
    if (state.proc && !state.proc.killed && state.proc.exitCode === null) {
      return state.proc;
    }

    const shellType = state.session.type;
    let binary = this.resolvedPwshBinary;
    let args: string[] = ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '-'];

    if (shellType === 'cmd') {
      binary = this.resolvedCmdBinary;
      args = ['/Q', '/K', 'prompt $P$G'];
    } else if (shellType === 'bash') {
      if (!this.resolvedBashBinary) {
        throw new Error(
          'Bash executable is not installed or not found on Windows PATH.'
        );
      }
      binary = this.resolvedBashBinary;
      args = ['--norc', '--noprofile'];
    }

    const child = spawn(binary, args, {
      cwd: state.session.workingDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    state.proc = child;
    state.session.activePid = child.pid;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      this.handleProcessOutput(state, chunk, 'output');
    });

    child.stderr.on('data', (chunk: string) => {
      this.handleProcessOutput(state, chunk, 'error');
    });

    child.on('exit', (code) => {
      state.proc = null;
      state.session.activePid = undefined;
      state.session.isRunning = false;

      if (state.pending) {
        const pending = state.pending;
        state.pending = null;
        clearTimeout(pending.timeoutHandle);
        if (pending.stdoutRemainder.trim()) {
          this.appendOutputLine(state, pending, 'output', pending.stdoutRemainder);
        }
        if (pending.stderrRemainder.trim()) {
          this.appendOutputLine(state, pending, 'error', pending.stderrRemainder);
        }
        pending.resolve({
          commandId: pending.commandId,
          lines: pending.lines,
          exitCode: code ?? 1,
          workingDir: state.session.workingDir,
        });
      }
    });

    return child;
  }

  private appendOutputLine(
    state: ManagedSessionState,
    pending: PendingCommandExecution,
    lineType: 'output' | 'error' | 'system',
    content: string
  ): void {
    const clean = content.replace(/\r$/, '');
    const byteLen = Buffer.byteLength(clean, 'utf8');
    if (pending.totalBytes + byteLen > this.config.maxOutputBytes) {
      if (!pending.truncated) {
        pending.truncated = true;
        const truncMsg = `[Output truncated at ${this.config.maxOutputBytes} bytes limit]`;
        pending.lines.push({ type: 'error', content: truncMsg });
        this.pushToSessionBuffer(state, 'error', truncMsg);
      }
      return;
    }

    pending.totalBytes += byteLen;
    pending.lines.push({ type: lineType, content: clean });
    this.pushToSessionBuffer(state, lineType, clean);
  }

  private pushToSessionBuffer(
    state: ManagedSessionState,
    lineType: TerminalLine['type'],
    content: string
  ): TerminalLine {
    state.seqCounter += 1;
    const line: TerminalLine = {
      id: `ln-${Date.now()}-${state.seqCounter}`,
      type: lineType,
      content,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      seq: state.seqCounter,
    };
    state.session.buffer.push(line);
    if (state.session.buffer.length > 500) {
      state.session.buffer.shift();
    }
    state.emitter.emit('line', line);
    return line;
  }

  private handleProcessOutput(
    state: ManagedSessionState,
    chunk: string,
    stream: 'output' | 'error'
  ): void {
    const pending = state.pending;
    if (!pending) {
      return;
    }

    const sentinelPrefix = `__LT_DONE_${pending.commandId}__:`;

    if (stream === 'error') {
      pending.stderrRemainder += chunk;
      const parts = pending.stderrRemainder.split(/\r?\n/);
      pending.stderrRemainder = parts.pop() ?? '';
      for (const line of parts) {
        if (line.trim().length > 0) {
          this.appendOutputLine(state, pending, 'error', line);
        }
      }
      return;
    }

    pending.stdoutRemainder += chunk;
    const parts = pending.stdoutRemainder.split(/\r?\n/);
    pending.stdoutRemainder = parts.pop() ?? '';

    for (const rawLine of parts) {
      const sentinelIndex = rawLine.indexOf(sentinelPrefix);
      if (sentinelIndex !== -1) {
        const beforeSentinel = rawLine.slice(0, sentinelIndex).trimEnd();
        if (beforeSentinel.length > 0) {
          this.appendOutputLine(state, pending, 'output', beforeSentinel);
        }

        const afterPrefix = rawLine.slice(sentinelIndex + sentinelPrefix.length);
        const colonIdx = afterPrefix.indexOf(':');
        const exitCodeStr =
          colonIdx !== -1 ? afterPrefix.slice(0, colonIdx) : afterPrefix;
        const reportedCwd =
          colonIdx !== -1 ? afterPrefix.slice(colonIdx + 1).trim() : '';

        this.completePendingCommand(
          state,
          pending,
          Number.isFinite(Number(exitCodeStr)) ? Number(exitCodeStr) : 0,
          reportedCwd
        );
        return;
      }

      this.appendOutputLine(state, pending, 'output', rawLine);
    }

    // Also check if sentinel is sitting in stdoutRemainder without a trailing newline
    const remSentinelIdx = pending.stdoutRemainder.indexOf(sentinelPrefix);
    if (remSentinelIdx !== -1 && pending.stdoutRemainder.endsWith('__END__')) {
      const before = pending.stdoutRemainder.slice(0, remSentinelIdx).trimEnd();
      if (before.length > 0) {
        this.appendOutputLine(state, pending, 'output', before);
      }
      const afterPrefix = pending.stdoutRemainder
        .slice(remSentinelIdx + sentinelPrefix.length)
        .replace(/__END__$/, '');
      const colonIdx = afterPrefix.indexOf(':');
      const exitCodeStr =
        colonIdx !== -1 ? afterPrefix.slice(0, colonIdx) : afterPrefix;
      const reportedCwd =
        colonIdx !== -1 ? afterPrefix.slice(colonIdx + 1).trim() : '';
      pending.stdoutRemainder = '';
      this.completePendingCommand(
        state,
        pending,
        Number.isFinite(Number(exitCodeStr)) ? Number(exitCodeStr) : 0,
        reportedCwd
      );
    }
  }

  private completePendingCommand(
    state: ManagedSessionState,
    pending: PendingCommandExecution,
    exitCode: number,
    reportedCwd: string
  ): void {
    if (state.pending !== pending) {
      return;
    }
    state.pending = null;
    clearTimeout(pending.timeoutHandle);

    if (pending.stderrRemainder.trim().length > 0) {
      this.appendOutputLine(state, pending, 'error', pending.stderrRemainder.trimEnd());
      pending.stderrRemainder = '';
    }

    // Verify working directory confinement after command execution
    if (reportedCwd) {
      if (isPathWithinAllowedRoots(reportedCwd, this.config.allowedRoots)) {
        state.session.workingDir = path.resolve(reportedCwd);
      } else {
        // Revert unauthorized directory escape inside the persistent shell
        const revertDir = state.session.workingDir;
        if (state.proc && !state.proc.killed) {
          if (state.session.type === 'cmd') {
            state.proc.stdin.write(`cd /d "${revertDir}"\r\n`);
          } else if (state.session.type === 'bash') {
            state.proc.stdin.write(`cd "${revertDir.replace(/\\/g, '/')}"\n`);
          } else {
            state.proc.stdin.write(
              `Set-Location -LiteralPath '${revertDir.replace(/'/g, "''")}'\n`
            );
          }
        }
        const msg = `Directory change to "${reportedCwd}" blocked: outside authorized workspace roots. Reverted to "${revertDir}".`;
        this.appendOutputLine(state, pending, 'error', msg);
      }
    }

    state.session.isRunning = false;
    state.emitter.emit('commandComplete', {
      commandId: pending.commandId,
      exitCode,
      workingDir: state.session.workingDir,
    });

    pending.resolve({
      commandId: pending.commandId,
      lines: pending.lines,
      exitCode,
      workingDir: state.session.workingDir,
    });
  }

  private detectMissingAiCli(command: string): KnownCliMeta | null {
    const firstToken = command.trim().split(/\s+/)[0]?.toLowerCase();
    if (!firstToken || !KNOWN_AI_CLIS[firstToken]) {
      return null;
    }
    const found = findExecutableOnPath([firstToken]);
    if (found) {
      return null;
    }
    return KNOWN_AI_CLIS[firstToken];
  }

  public async executeCommand(
    req: ExecuteCommandRequest
  ): Promise<ExecuteCommandResponse & { workingDir?: string }> {
    const commandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const state = this.ensureManagedSession(req.sessionId, req.workingDir);

    // 1. Validate command safety
    const safety = validateCommandSafety(req.command);
    if (!safety.allowed) {
      this.logger.warn('Blocked unsafe or invalid terminal command', {
        sessionId: req.sessionId,
        code: safety.code,
        reason: safety.reason,
      });
      const errMsg = `[SECURITY GUARD: ${safety.code}] ${safety.reason}`;
      this.pushToSessionBuffer(state, 'error', errMsg);
      return {
        commandId,
        exitCode: 126,
        workingDir: state.session.workingDir,
        lines: [{ type: 'error', content: errMsg }],
      };
    }

    // 2. Validate requested working directory if explicitly supplied and not a virtual frontend path
    if (req.workingDir) {
      const dirCheck = resolveAuthorizedWorkingDir(req.workingDir, this.config);
      if (!dirCheck.ok) {
        this.logger.warn('Blocked terminal command in unauthorized working directory', {
          sessionId: req.sessionId,
          requestedDir: req.workingDir,
        });
        this.pushToSessionBuffer(state, 'error', dirCheck.error);
        return {
          commandId,
          exitCode: 126,
          workingDir: state.session.workingDir,
          lines: [{ type: 'error', content: dirCheck.error }],
        };
      }
      // Only force-set the session working directory if the session has never run a command yet
      if (state.session.history.length === 0 && !dirCheck.mappedFromVirtual) {
        state.session.workingDir = dirCheck.resolvedPath;
      }
    }

    // 3. Check if an uninstalled AI CLI was invoked
    const missingCli = this.detectMissingAiCli(req.command);
    if (missingCli) {
      const msg = `'${missingCli.cliName}' is not installed on the Windows host PATH. Install with: ${missingCli.installCommand}`;
      this.pushToSessionBuffer(state, 'error', msg);
      return {
        commandId,
        exitCode: 127,
        workingDir: state.session.workingDir,
        lines: [{ type: 'error', content: msg }],
        interceptCliPrompt: {
          toolName: missingCli.toolName,
          cliName: missingCli.cliName,
          installCommand: missingCli.installCommand,
        },
      };
    }

    // 4. Reject concurrent execution on the same session while busy
    if (state.pending) {
      const busyMsg =
        'Session currently has an active command running. Wait for completion or send SIGINT (Ctrl+C).';
      return {
        commandId,
        exitCode: 1,
        workingDir: state.session.workingDir,
        lines: [{ type: 'error', content: busyMsg }],
      };
    }

    const trimmedCmd = req.command.trim();
    state.session.history = [
      trimmedCmd,
      ...state.session.history.filter((h) => h !== trimmedCmd),
    ].slice(0, 100);
    this.pushToSessionBuffer(state, 'input', trimmedCmd);

    let child: ChildProcessWithoutNullStreams;
    try {
      child = this.ensureShellProcess(state);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.pushToSessionBuffer(state, 'error', message);
      return {
        commandId,
        exitCode: 1,
        workingDir: state.session.workingDir,
        lines: [{ type: 'error', content: message }],
      };
    }

    state.session.isRunning = true;

    return new Promise<ExecuteCommandResponse & { workingDir: string }>((resolve) => {
      const timeoutHandle = setTimeout(() => {
        if (state.pending && state.pending.commandId === commandId) {
          this.logger.warn('Terminal command timed out; killing process tree', {
            sessionId: state.session.id,
            commandId,
            timeoutMs: this.config.commandTimeoutMs,
          });
          const timeoutMsg = `[Command timed out after ${this.config.commandTimeoutMs}ms and was terminated]`;
          this.appendOutputLine(state, state.pending, 'error', timeoutMsg);
          const pendingRef = state.pending;
          state.pending = null;
          state.session.isRunning = false;
          killProcessTree(child.pid);
          state.proc = null;
          pendingRef.resolve({
            commandId,
            lines: pendingRef.lines,
            exitCode: 124,
            workingDir: state.session.workingDir,
          });
        }
      }, this.config.commandTimeoutMs);

      const pending: PendingCommandExecution = {
        commandId,
        command: trimmedCmd,
        lines: [],
        stdoutRemainder: '',
        stderrRemainder: '',
        totalBytes: 0,
        truncated: false,
        timeoutHandle,
        resolve,
      };
      state.pending = pending;

      // Apply any per-request environment variable overrides
      const envEntries = Object.entries(req.envOverrides || {}).filter(([k]) =>
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)
      );

      if (state.session.type === 'cmd') {
        const envCommands = envEntries
          .map(([k, v]) => `set "${k}=${String(v).replace(/"/g, '')}"`)
          .join('\r\n');
        const payload = [
          ...(envCommands ? [envCommands] : []),
          trimmedCmd,
          `echo __LT_DONE_${commandId}__:%ERRORLEVEL%:%CD%`,
        ].join('\r\n') + '\r\n';
        child.stdin.write(payload);
      } else if (state.session.type === 'bash') {
        const envCommands = envEntries
          .map(([k, v]) => `export ${k}='${String(v).replace(/'/g, "'\\''")}'`)
          .join('\n');
        const payload = [
          ...(envCommands ? [envCommands] : []),
          trimmedCmd,
          `__lt_ec=$?; printf "__LT_DONE_${commandId}__:%d:%s\\n" "$__lt_ec" "$(pwd -W 2>/dev/null || pwd)"`,
        ].join('\n') + '\n';
        child.stdin.write(payload);
      } else {
        // Default: PowerShell
        const envCommands = envEntries
          .map(([k, v]) => `$env:${k} = '${String(v).replace(/'/g, "''")}'`)
          .join('\n');
        const sentinelLine = `$__lt_ok = $?; $__lt_ec = if (-not $__lt_ok) { if ($global:LASTEXITCODE) { $global:LASTEXITCODE } else { 1 } } elseif ($global:LASTEXITCODE) { $global:LASTEXITCODE } else { 0 }; [Console]::Out.WriteLine("__LT_DONE_${commandId}__:$($__lt_ec):$((Get-Location).Path)")`;
        const payload = [
          '$global:LASTEXITCODE = 0',
          ...(envCommands ? [envCommands] : []),
          trimmedCmd,
          sentinelLine,
        ].join('\n') + '\n';
        child.stdin.write(payload);
      }
    });
  }

  public sendSignal(req: SendSignalRequest): void {
    const state = this.sessions.get(req.sessionId);
    if (!state) return;

    if (req.signal === 'CLEAR') {
      state.session.buffer = [];
      state.emitter.emit('clear');
      return;
    }

    // SIGINT or SIGTERM: interrupt running command and kill child process tree
    const sigMsg = `^C\n[SIGINT] Process interrupted by client signal (${req.signal}).`;
    if (state.pending) {
      const pending = state.pending;
      state.pending = null;
      clearTimeout(pending.timeoutHandle);
      this.appendOutputLine(state, pending, 'error', sigMsg);
      state.session.isRunning = false;
      if (state.proc) {
        killProcessTree(state.proc.pid);
        state.proc = null;
        state.session.activePid = undefined;
      }
      pending.resolve({
        commandId: pending.commandId,
        lines: pending.lines,
        exitCode: 130,
        workingDir: state.session.workingDir,
      });
    } else if (state.proc) {
      killProcessTree(state.proc.pid);
      state.proc = null;
      state.session.activePid = undefined;
      state.session.isRunning = false;
      this.pushToSessionBuffer(state, 'system', sigMsg);
    }

    this.logger.info('Sent signal to terminal session', {
      sessionId: req.sessionId,
      signal: req.signal,
    });
  }

  public closeSession(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    if (state.pending) {
      clearTimeout(state.pending.timeoutHandle);
      state.pending.resolve({
        commandId: state.pending.commandId,
        lines: state.pending.lines,
        exitCode: 143,
        workingDir: state.session.workingDir,
      });
      state.pending = null;
    }

    if (state.proc) {
      killProcessTree(state.proc.pid);
      state.proc = null;
    }

    state.emitter.removeAllListeners();
    this.sessions.delete(sessionId);

    this.logger.info('Closed terminal session and cleaned up process tree', {
      sessionId,
    });
  }

  public subscribeSession(
    sessionId: string,
    onLine: (line: TerminalLine) => void
  ): () => void {
    const state = this.ensureManagedSession(sessionId);
    state.emitter.on('line', onLine);
    return () => {
      state.emitter.off('line', onLine);
    };
  }

  public shutdownAll(): void {
    for (const sessionId of Array.from(this.sessions.keys())) {
      this.closeSession(sessionId);
    }
  }
}
