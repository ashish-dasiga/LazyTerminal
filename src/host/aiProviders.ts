import { spawn, spawnSync, ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { redactSecrets } from '../services/cliDetector';
import { LineType } from '../types/relay';

export type SupportedAiProviderId = 'claude' | 'gemini' | 'codex' | 'antigravity';

export interface ResolvedSpawnSpec {
  command: string;
  args: string[];
  resolvedViaNodeShim: boolean;
  scriptPath?: string;
}

export interface ProviderAuthInspection {
  authStatus: 'authenticated' | 'unauthenticated' | 'unknown' | 'not_installed';
  authDetail?: string;
  launchSupported: boolean;
}

export interface ExecuteAiProviderTurnOptions {
  providerId: SupportedAiProviderId;
  executablePath: string;
  rawInput: string;
  workingDir: string;
  providerSessionId?: string;
  envOverrides?: Record<string, string>;
  augmentedPath: string;
  timeoutMs: number;
  onLine: (type: LineType, content: string) => void;
  onSpawn?: (child: ChildProcess) => void;
  isCancelled?: () => boolean;
}

export interface ExecuteAiProviderTurnResult {
  exitCode: number;
  nextProviderSessionId?: string;
}

/**
 * Resolves a Windows executable or npm `.cmd` wrapper into a direct `shell: false` spawn spec.
 * For npm `.cmd` wrappers (like `gemini.cmd` and `codex.cmd`), extracts the underlying Node `.js`
 * entrypoint so prompts with spaces, quotes, `&`, `|`, `%`, or newlines are passed via OS argv
 * without any `cmd.exe` shell interpolation or metacharacter mangling.
 */
export function resolveWindowsExecutableSpawn(
  executablePath: string,
  args: string[],
): ResolvedSpawnSpec {
  const isWinBatch =
    process.platform === 'win32' && /\.(cmd|bat)$/i.test(executablePath);

  if (isWinBatch) {
    try {
      const wrapperContent = fs.readFileSync(executablePath, 'utf8');
      const shimMatch = wrapperContent.match(
        /(?:%dp0%|%~dp0)[\\/]?([^"\r\n]+?\.(?:m|c)?js)/i,
      );
      if (shimMatch && shimMatch[1]) {
        const baseDir = path.dirname(executablePath);
        const candidateScript = path.resolve(baseDir, shimMatch[1]);
        if (fs.existsSync(candidateScript) && fs.statSync(candidateScript).isFile()) {
          const localNode = path.join(baseDir, 'node.exe');
          const nodeBinary =
            fs.existsSync(localNode) && fs.statSync(localNode).isFile()
              ? localNode
              : process.execPath;
          return {
            command: nodeBinary,
            args: [candidateScript, ...args],
            resolvedViaNodeShim: true,
            scriptPath: candidateScript,
          };
        }
      }
    } catch {
      // Fall back to ComSpec without shell interpolation below
    }

    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', executablePath, ...args],
      resolvedViaNodeShim: false,
    };
  }

  return {
    command: executablePath,
    args,
    resolvedViaNodeShim: false,
  };
}

/**
 * Tokenizes a CLI command string while respecting single and double quotes.
 */
export function tokenizeCliInput(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (ch === '\\' && i + 1 < input.length && input[i + 1] === quote) {
        current += quote;
        i += 1;
      } else if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
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

function killTree(pid: number | undefined): void {
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
    // Process already exited
  }
}

function probeCommandOutput(
  executablePath: string,
  args: string[],
  timeoutMs = 4500,
): { status: number | null; stdout: string; stderr: string } {
  const spec = resolveWindowsExecutableSpawn(executablePath, args);
  const res = spawnSync(spec.command, spec.args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
    windowsHide: true,
    env: {
      ...process.env,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    },
  });
  return {
    status: res.status,
    stdout: String(res.stdout || ''),
    stderr: String(res.stderr || ''),
  };
}

/**
 * Inspects real Windows authentication/configuration state for a CLI provider without exposing secrets.
 */
export function inspectProviderAuth(
  providerId: string,
  executablePath: string | null | undefined,
): ProviderAuthInspection {
  if (!executablePath) {
    return {
      authStatus: 'not_installed',
      authDetail: 'Executable not found on Windows PATH',
      launchSupported: false,
    };
  }

  const normalized = providerId.toLowerCase();
  const home = os.homedir();

  if (normalized === 'claude') {
    if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN) {
      return {
        authStatus: 'authenticated',
        authDetail: 'Environment credential configured',
        launchSupported: true,
      };
    }

    const probe = probeCommandOutput(executablePath, ['auth', 'status'], 4500);
    const trimmed = probe.stdout.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.loggedIn === true) {
        const method = typeof parsed.authMethod === 'string' ? parsed.authMethod : 'login';
        return {
          authStatus: 'authenticated',
          authDetail: `Logged in (${method})`,
          launchSupported: true,
        };
      }
      return {
        authStatus: 'unauthenticated',
        authDetail: 'Not logged in. Run "claude auth login" on Windows PC.',
        launchSupported: true,
      };
    } catch {
      if (/logged\s*in.*true/i.test(trimmed)) {
        return {
          authStatus: 'authenticated',
          authDetail: 'Logged in',
          launchSupported: true,
        };
      }
      return {
        authStatus: 'unknown',
        authDetail: 'Unable to verify Claude auth status non-interactively',
        launchSupported: true,
      };
    }
  }

  if (normalized === 'gemini') {
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      return {
        authStatus: 'authenticated',
        authDetail: 'API key environment variable configured',
        launchSupported: true,
      };
    }

    const geminiDir = path.join(home, '.gemini');
    const oauthCredsPath = path.join(geminiDir, 'oauth_creds.json');
    const accountsPath = path.join(geminiDir, 'google_accounts.json');

    try {
      if (fs.existsSync(oauthCredsPath) && fs.statSync(oauthCredsPath).size > 10) {
        return {
          authStatus: 'authenticated',
          authDetail: 'Google OAuth credentials present',
          launchSupported: true,
        };
      }
      if (fs.existsSync(accountsPath)) {
        const raw = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
        if (raw && (raw.active || (Array.isArray(raw.accounts) && raw.accounts.length > 0))) {
          return {
            authStatus: 'authenticated',
            authDetail: 'Google account signed in (~/.gemini)',
            launchSupported: true,
          };
        }
      }
    } catch {
      // Ignore malformed local metadata
    }

    return {
      authStatus: 'unauthenticated',
      authDetail: 'Sign in with "gemini" on Windows PC or set GEMINI_API_KEY',
      launchSupported: true,
    };
  }

  if (normalized === 'codex') {
    if (process.env.OPENAI_API_KEY) {
      return {
        authStatus: 'authenticated',
        authDetail: 'OPENAI_API_KEY configured',
        launchSupported: true,
      };
    }

    const codexAuthPath = path.join(home, '.codex', 'auth.json');
    try {
      if (fs.existsSync(codexAuthPath) && fs.statSync(codexAuthPath).size > 10) {
        return {
          authStatus: 'authenticated',
          authDetail: 'Codex auth profile present (~/.codex)',
          launchSupported: true,
        };
      }
    } catch {
      // Ignore
    }

    const probe = probeCommandOutput(executablePath, ['login', 'status'], 4500);
    const combined = `${probe.stdout}\n${probe.stderr}`;
    if (/logged in/i.test(combined) && !/not logged in/i.test(combined)) {
      return {
        authStatus: 'authenticated',
        authDetail: redactSecrets(combined.trim().split(/\r?\n/)[0] || 'Logged in'),
        launchSupported: true,
      };
    }

    return {
      authStatus: 'unauthenticated',
      authDetail: 'Run "codex login" on Windows PC or set OPENAI_API_KEY',
      launchSupported: true,
    };
  }

  if (normalized === 'antigravity' || normalized === 'agy') {
    return {
      authStatus: 'unknown',
      authDetail:
        'Antigravity CLI detected; autonomous IDE daemon bridge is unsupported (print mode only)',
      launchSupported: true,
    };
  }

  return {
    authStatus: 'unknown',
    launchSupported: true,
  };
}

const PROVIDER_BINARY_ALIASES: Record<SupportedAiProviderId, string[]> = {
  claude: ['claude', 'claude.exe', 'claude.cmd'],
  gemini: ['gemini', 'gemini.cmd', 'gemini.exe'],
  codex: ['codex', 'codex.cmd', 'codex.exe'],
  antigravity: ['antigravity', 'agy', 'agy.exe', 'agy.cmd'],
};

const DIRECT_SUBCOMMANDS = new Set([
  'auth',
  'login',
  'logout',
  'mcp',
  'doctor',
  'config',
  'update',
  'exec',
  'skills',
  'extensions',
  'hooks',
]);

function parseProviderInput(
  providerId: SupportedAiProviderId,
  rawInput: string,
): { mode: 'direct_args'; args: string[] } | { mode: 'prompt'; prompt: string } {
  const trimmed = rawInput.trim();
  const tokens = tokenizeCliInput(trimmed);
  if (tokens.length > 0) {
    const firstLower = tokens[0].toLowerCase();
    const aliases = PROVIDER_BINARY_ALIASES[providerId];
    if (aliases.includes(firstLower)) {
      if (tokens.length === 1) {
        return { mode: 'direct_args', args: ['--version'] };
      }
      const second = tokens[1];
      if (second.startsWith('-') || DIRECT_SUBCOMMANDS.has(second.toLowerCase())) {
        return { mode: 'direct_args', args: tokens.slice(1) };
      }
      // e.g. `claude "Explain this folder"` -> prompt mode
      return { mode: 'prompt', prompt: tokens.slice(1).join(' ') };
    }
  }
  return { mode: 'prompt', prompt: trimmed };
}

function buildSafeChildEnv(
  augmentedPath: string,
  envOverrides?: Record<string, string>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: augmentedPath,
    Path: augmentedPath,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    TERM: 'xterm-256color',
  };

  if (envOverrides) {
    for (const [k, v] of Object.entries(envOverrides)) {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) {
        env[k] = String(v);
      }
    }
  }
  return env;
}

function emitMultiline(
  onLine: (type: LineType, content: string) => void,
  type: LineType,
  rawText: string,
): void {
  const safe = redactSecrets(rawText);
  const lines = safe.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim().length > 0) {
      onLine(type, line);
    }
  }
}

async function runDirectArgsTurn(
  opts: ExecuteAiProviderTurnOptions,
  args: string[],
): Promise<ExecuteAiProviderTurnResult> {
  const spec = resolveWindowsExecutableSpawn(opts.executablePath, args);
  const env = buildSafeChildEnv(opts.augmentedPath, opts.envOverrides);

  return new Promise<ExecuteAiProviderTurnResult>((resolve) => {
    const child = spawn(spec.command, spec.args, {
      cwd: opts.workingDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    opts.onSpawn?.(child);

    let outRem = '';
    let errRem = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      opts.onLine('error', `[Command timed out after ${opts.timeoutMs}ms]`);
      killTree(child.pid);
    }, opts.timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      outRem += chunk;
      const parts = outRem.split(/\r?\n/);
      outRem = parts.pop() ?? '';
      for (const line of parts) {
        if (line.trim().length > 0) {
          opts.onLine('output', redactSecrets(line));
        }
      }
    });

    child.stderr.on('data', (chunk: string) => {
      errRem += chunk;
      const parts = errRem.split(/\r?\n/);
      errRem = parts.pop() ?? '';
      for (const line of parts) {
        if (
          line.trim().length > 0 &&
          !/256-color support not detected|Ripgrep is not available/i.test(line)
        ) {
          opts.onLine('error', redactSecrets(line));
        }
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      opts.onLine('error', redactSecrets(err.message));
      resolve({ exitCode: 1, nextProviderSessionId: opts.providerSessionId });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (outRem.trim()) opts.onLine('output', redactSecrets(outRem));
      if (errRem.trim() && !/256-color support not detected|Ripgrep is not available/i.test(errRem)) {
        opts.onLine('error', redactSecrets(errRem));
      }
      resolve({
        exitCode: timedOut ? 124 : code ?? 1,
        nextProviderSessionId: opts.providerSessionId,
      });
    });
  });
}

async function runClaudePromptTurn(
  opts: ExecuteAiProviderTurnOptions,
  prompt: string,
): Promise<ExecuteAiProviderTurnResult> {
  const cliArgs = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    ...(opts.providerSessionId ? ['--resume', opts.providerSessionId] : []),
  ];
  const spec = resolveWindowsExecutableSpawn(opts.executablePath, cliArgs);
  const env = buildSafeChildEnv(opts.augmentedPath, opts.envOverrides);

  return new Promise<ExecuteAiProviderTurnResult>((resolve) => {
    const child = spawn(spec.command, spec.args, {
      cwd: opts.workingDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    opts.onSpawn?.(child);

    let outRem = '';
    let errRem = '';
    let candidateSessionId: string | undefined;
    let sawTurnError = false;
    let timedOut = false;
    const emittedFingerprints = new Set<string>();

    const timer = setTimeout(() => {
      timedOut = true;
      opts.onLine('error', `[Claude Code timed out after ${opts.timeoutMs}ms]`);
      killTree(child.pid);
    }, opts.timeoutMs);

    const handleStdoutLine = (rawLine: string) => {
      const trimmed = rawLine.trim();
      if (!trimmed) return;

      if (!trimmed.startsWith('{')) {
        opts.onLine('output', redactSecrets(trimmed));
        return;
      }

      try {
        const evt = JSON.parse(trimmed);
        if (typeof evt.session_id === 'string' && evt.session_id) {
          candidateSessionId = evt.session_id;
        }

        if (evt.type === 'assistant' && evt.message && Array.isArray(evt.message.content)) {
          const isApiErr = Boolean(evt.is_api_error_message || evt.error);
          if (isApiErr) sawTurnError = true;

          for (const block of evt.message.content) {
            if (block.type === 'tool_use' && block.name) {
              opts.onLine('system', `[Claude Tool: ${block.name}]`);
            } else if (block.type === 'text' && typeof block.text === 'string') {
              const cleanText = redactSecrets(block.text).trim();
              if (cleanText) {
                emittedFingerprints.add(cleanText);
                emitMultiline(opts.onLine, isApiErr ? 'error' : 'output', cleanText);
              }
            }
          }
          return;
        }

        if (evt.type === 'result') {
          const isError = Boolean(evt.is_error);
          if (isError) sawTurnError = true;
          if (typeof evt.result === 'string' && evt.result.trim()) {
            const cleanResult = redactSecrets(evt.result).trim();
            if (!emittedFingerprints.has(cleanResult)) {
              emittedFingerprints.add(cleanResult);
              emitMultiline(opts.onLine, isError ? 'error' : 'output', cleanResult);
            }
          }
          return;
        }
      } catch {
        opts.onLine('output', redactSecrets(trimmed));
      }
    };

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      outRem += chunk;
      const parts = outRem.split(/\r?\n/);
      outRem = parts.pop() ?? '';
      for (const line of parts) {
        handleStdoutLine(line);
      }
    });

    child.stderr.on('data', (chunk: string) => {
      errRem += chunk;
      const parts = errRem.split(/\r?\n/);
      errRem = parts.pop() ?? '';
      for (const line of parts) {
        const t = line.trim();
        if (!t) continue;
        // Suppress non-fatal internal model warning noise if structured JSON error follows
        if (t.startsWith('[claude-code:unrecognized_model]')) continue;
        opts.onLine('error', redactSecrets(t));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      opts.onLine('error', redactSecrets(err.message));
      resolve({ exitCode: 1, nextProviderSessionId: opts.providerSessionId });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (outRem.trim()) handleStdoutLine(outRem);
      if (errRem.trim() && !errRem.trim().startsWith('[claude-code:unrecognized_model]')) {
        opts.onLine('error', redactSecrets(errRem.trim()));
      }
      const exitCode = timedOut ? 124 : code ?? (sawTurnError ? 1 : 0);
      resolve({
        exitCode,
        nextProviderSessionId:
          exitCode === 0 && !sawTurnError
            ? candidateSessionId || opts.providerSessionId
            : opts.providerSessionId,
      });
    });
  });
}

interface GeminiAttemptOutcome {
  exitCode: number;
  sessionId?: string;
  hitServiceUnavailable503: boolean;
  emittedAnyAssistantOutput: boolean;
}

function runGeminiSingleAttempt(
  opts: ExecuteAiProviderTurnOptions,
  prompt: string,
  modelOverride: string | undefined,
  allow503FastFallback: boolean,
): Promise<GeminiAttemptOutcome> {
  const configuredModel = modelOverride || process.env.GEMINI_MODEL;
  const cliArgs = [
    '--skip-trust',
    ...(configuredModel ? ['-m', configuredModel] : []),
    ...(opts.providerSessionId ? ['--resume', opts.providerSessionId] : []),
    '-p',
    prompt,
    '-o',
    'stream-json',
  ];

  const spec = resolveWindowsExecutableSpawn(opts.executablePath, cliArgs);
  const env = buildSafeChildEnv(opts.augmentedPath, opts.envOverrides);

  return new Promise<GeminiAttemptOutcome>((resolve) => {
    const child = spawn(spec.command, spec.args, {
      cwd: opts.workingDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    opts.onSpawn?.(child);

    let outRem = '';
    let errRem = '';
    let assistantDeltaBuffer = '';
    let sessionId: string | undefined;
    let sawStructuredError = false;
    let hitServiceUnavailable503 = false;
    let emittedAnyAssistantOutput = false;
    let abortedFor503Fallback = false;
    let timedOut = false;
    const fatalStderrLines: string[] = [];

    const flushDeltaBuffer = () => {
      if (assistantDeltaBuffer.trim().length > 0) {
        emittedAnyAssistantOutput = true;
        emitMultiline(opts.onLine, 'output', assistantDeltaBuffer);
      }
      assistantDeltaBuffer = '';
    };

    const timer = setTimeout(() => {
      timedOut = true;
      flushDeltaBuffer();
      opts.onLine('error', `[Gemini CLI timed out after ${opts.timeoutMs}ms]`);
      killTree(child.pid);
    }, opts.timeoutMs);

    const handleStdoutLine = (rawLine: string) => {
      const trimmed = rawLine.trim();
      if (!trimmed) return;
      if (!trimmed.startsWith('{')) {
        opts.onLine('output', redactSecrets(trimmed));
        return;
      }

      try {
        const evt = JSON.parse(trimmed);
        if (evt.type === 'init' && typeof evt.session_id === 'string') {
          sessionId = evt.session_id;
          return;
        }

        if (evt.type === 'message' && evt.role === 'assistant' && typeof evt.content === 'string') {
          assistantDeltaBuffer += evt.content;
          const parts = assistantDeltaBuffer.split(/\r?\n/);
          assistantDeltaBuffer = parts.pop() ?? '';
          for (const completeLine of parts) {
            if (completeLine.length > 0) {
              emittedAnyAssistantOutput = true;
              opts.onLine('output', redactSecrets(completeLine));
            }
          }
          return;
        }

        if (evt.type === 'tool_use' && evt.tool_name) {
          flushDeltaBuffer();
          opts.onLine('system', `[Gemini Tool: ${evt.tool_name}]`);
          return;
        }

        if (evt.type === 'result') {
          flushDeltaBuffer();
          if (evt.status === 'error') {
            sawStructuredError = true;
            const errMsg =
              typeof evt.error?.message === 'string'
                ? evt.error.message
                : 'Gemini CLI returned an error result.';
            if (/503|high demand|UNAVAILABLE/i.test(errMsg)) {
              hitServiceUnavailable503 = true;
              if (allow503FastFallback) {
                return;
              }
            }
            emitMultiline(opts.onLine, 'error', errMsg);
          }
          return;
        }
      } catch {
        opts.onLine('output', redactSecrets(trimmed));
      }
    };

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      outRem += chunk;
      const parts = outRem.split(/\r?\n/);
      outRem = parts.pop() ?? '';
      for (const line of parts) {
        handleStdoutLine(line);
      }
    });

    child.stderr.on('data', (chunk: string) => {
      errRem += chunk;
      const parts = errRem.split(/\r?\n/);
      errRem = parts.pop() ?? '';
      for (const line of parts) {
        const t = line.trim();
        if (!t) continue;
        if (/256-color support not detected|Ripgrep is not available/i.test(t)) {
          continue;
        }
        if (/status\s*[:=]?\s*503|high demand|Service Unavailable/i.test(t)) {
          hitServiceUnavailable503 = true;
          if (allow503FastFallback && !emittedAnyAssistantOutput && !abortedFor503Fallback) {
            abortedFor503Fallback = true;
            killTree(child.pid);
          }
          continue;
        }
        if (!t.startsWith('at ')) {
          fatalStderrLines.push(t);
        }
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      opts.onLine('error', redactSecrets(err.message));
      resolve({
        exitCode: 1,
        sessionId,
        hitServiceUnavailable503: false,
        emittedAnyAssistantOutput,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (outRem.trim()) handleStdoutLine(outRem);
      flushDeltaBuffer();

      if (abortedFor503Fallback) {
        resolve({
          exitCode: 1,
          sessionId,
          hitServiceUnavailable503: true,
          emittedAnyAssistantOutput,
        });
        return;
      }

      const exitCode = timedOut ? 124 : code ?? (sawStructuredError ? 1 : 0);
      if (exitCode !== 0 && !sawStructuredError && fatalStderrLines.length > 0) {
        emitMultiline(opts.onLine, 'error', fatalStderrLines.slice(0, 4).join('\n'));
      }

      resolve({
        exitCode,
        sessionId,
        hitServiceUnavailable503,
        emittedAnyAssistantOutput,
      });
    });
  });
}

async function runGeminiPromptTurn(
  opts: ExecuteAiProviderTurnOptions,
  prompt: string,
): Promise<ExecuteAiProviderTurnResult> {
  const hasExplicitModel = Boolean(
    process.env.GEMINI_MODEL || opts.envOverrides?.GEMINI_MODEL,
  );
  const first = await runGeminiSingleAttempt(opts, prompt, undefined, !hasExplicitModel);

  if (
    first.hitServiceUnavailable503 &&
    !first.emittedAnyAssistantOutput &&
    !hasExplicitModel &&
    !opts.isCancelled?.()
  ) {
    opts.onLine(
      'system',
      '[Gemini] Default auto model reported 503 high demand; retrying with gemini-3.5-flash-lite...',
    );
    const fallback = await runGeminiSingleAttempt(
      opts,
      prompt,
      'gemini-3.5-flash-lite',
      false,
    );
    return {
      exitCode: fallback.exitCode,
      nextProviderSessionId:
        fallback.exitCode === 0
          ? fallback.sessionId || opts.providerSessionId
          : opts.providerSessionId,
    };
  }

  return {
    exitCode: first.exitCode,
    nextProviderSessionId:
      first.exitCode === 0
        ? first.sessionId || opts.providerSessionId
        : opts.providerSessionId,
  };
}

async function runCodexPromptTurn(
  opts: ExecuteAiProviderTurnOptions,
  prompt: string,
): Promise<ExecuteAiProviderTurnResult> {
  const cliArgs = opts.providerSessionId
    ? ['exec', 'resume', opts.providerSessionId, '--skip-git-repo-check', prompt]
    : ['exec', '--skip-git-repo-check', prompt];

  const spec = resolveWindowsExecutableSpawn(opts.executablePath, cliArgs);
  const env = buildSafeChildEnv(opts.augmentedPath, opts.envOverrides);

  return new Promise<ExecuteAiProviderTurnResult>((resolve) => {
    const child = spawn(spec.command, spec.args, {
      cwd: opts.workingDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    opts.onSpawn?.(child);

    let outRem = '';
    let errRem = '';
    let capturedSessionId: string | undefined;
    let timedOut = false;
    const stderrErrors: string[] = [];

    const timer = setTimeout(() => {
      timedOut = true;
      opts.onLine('error', `[Codex CLI timed out after ${opts.timeoutMs}ms]`);
      killTree(child.pid);
    }, opts.timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      outRem += chunk;
      const parts = outRem.split(/\r?\n/);
      outRem = parts.pop() ?? '';
      for (const line of parts) {
        if (line.trim().length > 0) {
          opts.onLine('output', redactSecrets(line));
        }
      }
    });

    child.stderr.on('data', (chunk: string) => {
      errRem += chunk;
      const parts = errRem.split(/\r?\n/);
      errRem = parts.pop() ?? '';
      for (const line of parts) {
        const sidMatch = line.match(/^session id:\s*([0-9a-fA-F-]{8,})/i);
        if (sidMatch) {
          capturedSessionId = sidMatch[1];
          continue;
        }
        if (/error|unauthorized|forbidden|failed to authenticate/i.test(line) && !/failed to load skill/i.test(line)) {
          stderrErrors.push(line.trim());
        }
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      opts.onLine('error', redactSecrets(err.message));
      resolve({ exitCode: 1, nextProviderSessionId: opts.providerSessionId });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (outRem.trim()) opts.onLine('output', redactSecrets(outRem));
      const exitCode = timedOut ? 124 : code ?? 1;
      if (exitCode !== 0 && stderrErrors.length > 0) {
        emitMultiline(opts.onLine, 'error', stderrErrors.join('\n'));
      }
      resolve({
        exitCode,
        nextProviderSessionId:
          exitCode === 0
            ? capturedSessionId || opts.providerSessionId
            : opts.providerSessionId,
      });
    });
  });
}

async function runAntigravityPromptTurn(
  opts: ExecuteAiProviderTurnOptions,
  prompt: string,
): Promise<ExecuteAiProviderTurnResult> {
  const cliArgs = [...(opts.providerSessionId ? ['-c'] : []), '-p', prompt];
  const res = await runDirectArgsTurn(opts, cliArgs);
  return {
    exitCode: res.exitCode,
    nextProviderSessionId: res.exitCode === 0 ? 'continue' : opts.providerSessionId,
  };
}

/**
 * Executes a single turn inside a dedicated AI CLI session (`claude`, `gemini`, `codex`, `antigravity`).
 */
export async function executeAiProviderTurn(
  opts: ExecuteAiProviderTurnOptions,
): Promise<ExecuteAiProviderTurnResult> {
  const parsed = parseProviderInput(opts.providerId, opts.rawInput);
  if (parsed.mode === 'direct_args') {
    return runDirectArgsTurn(opts, parsed.args);
  }

  switch (opts.providerId) {
    case 'claude':
      return runClaudePromptTurn(opts, parsed.prompt);
    case 'gemini':
      return runGeminiPromptTurn(opts, parsed.prompt);
    case 'codex':
      return runCodexPromptTurn(opts, parsed.prompt);
    case 'antigravity':
      return runAntigravityPromptTurn(opts, parsed.prompt);
  }
}
