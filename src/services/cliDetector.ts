import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { AiCliTool } from '../types/relay';
import { CliStatusResponse, InstallToolResponse } from './contracts';

const execFileAsync = promisify(execFile);

export type CapabilitySupportLevel = 'verified' | 'unverified' | 'unsupported';

export interface CliCapabilityMatrixEntry {
  id: string;
  name: string;
  vendor: string;
  windowsSupport: CapabilitySupportLevel;
  authMechanism: string;
  nonInteractiveCheck: CapabilitySupportLevel;
  interactivePtySession: CapabilitySupportLevel;
  autonomousDaemonBridge: CapabilitySupportLevel;
  notes: string;
}

export interface CliMetadataConfig {
  id: string;
  name: string;
  cliName: string;
  binaryCandidates: string[];
  description: string;
  vendor: string;
  versionArgs: string[];
  installCommand: string;
  installScope: string;
  runCommand: string;
  permissionsRequired: string[];
  capabilities: string[];
  authEnvVars: string[];
  isAutomationRuntime?: boolean;
}

export interface CliLaunchRequest {
  toolId: string;
  workingDir?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface CliLaunchResponse {
  toolId: string;
  launched: boolean;
  status: 'running' | 'completed' | 'requires_auth' | 'requires_pty' | 'unsupported' | 'not_installed' | 'error';
  executablePath?: string;
  workingDir: string;
  version?: string;
  exitCode?: number | null;
  output: string;
  redactedEnvKeys: string[];
}

export const SUPPORTED_CLI_DEFINITIONS: CliMetadataConfig[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    cliName: 'claude',
    binaryCandidates: ['claude.exe', 'claude.cmd', 'claude'],
    description: 'Anthropic agentic CLI for full-codebase navigation, editing, and tool execution on Windows PC.',
    vendor: 'Anthropic PBC',
    versionArgs: ['--version'],
    installCommand: 'npm install -g @anthropic-ai/claude-code',
    installScope: 'Global Windows Node.js (%APPDATA%\\npm)',
    runCommand: 'claude',
    permissionsRequired: ['Native Shell Execution', 'File System Read/Write', 'Child Process Spawning'],
    capabilities: ['Sub-agent delegation', 'Diff inspections', 'Curses interactive UI', 'AST refactoring'],
    authEnvVars: ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'],
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    cliName: 'codex',
    binaryCandidates: ['codex.exe', 'codex.cmd', 'codex'],
    description: 'Code synthesizer and shell automation assistant powered by OpenAI models.',
    vendor: 'OpenAI Inc.',
    versionArgs: ['--version'],
    installCommand: 'npm install -g @openai/codex',
    installScope: 'Global Windows Node.js (%APPDATA%\\npm)',
    runCommand: 'codex',
    permissionsRequired: ['Native Shell Execution', 'File System Read'],
    capabilities: ['Code synthesis', 'Refactoring suggestions', 'Inline bug detection'],
    authEnvVars: ['OPENAI_API_KEY'],
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    cliName: 'gemini',
    binaryCandidates: ['gemini.exe', 'gemini.cmd', 'gemini'],
    description: 'Developer multi-turn workspace reasoning CLI with grounding in your local repo.',
    vendor: 'Google LLC',
    versionArgs: ['--version'],
    installCommand: 'npm install -g @google/gemini-cli',
    installScope: 'Global Windows Node.js (%APPDATA%\\npm)',
    runCommand: 'gemini',
    permissionsRequired: ['Native Shell Execution', 'File System Read/Write'],
    capabilities: ['Code reasoning', 'Semantic repo search', 'Multimodal context'],
    authEnvVars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    cliName: 'antigravity',
    binaryCandidates: ['antigravity.exe', 'antigravity.cmd', 'agy.exe', 'agy.cmd', 'agy'],
    description: 'Autonomous agent runtime environment for automated workspace tasks.',
    vendor: 'Google LLC',
    versionArgs: ['--version'],
    installCommand: 'agy --version',
    installScope: 'Local Antigravity IDE / CLI Companion (%LOCALAPPDATA%\\agy\\bin)',
    runCommand: 'agy',
    permissionsRequired: ['Agent Runtime Control', 'Autonomous Workspace Execution'],
    capabilities: ['Autonomous task planning', 'Multi-file edits', 'Agent observation'],
    authEnvVars: ['GOOGLE_API_KEY', 'ANTIGRAVITY_TOKEN'],
    isAutomationRuntime: true,
  },
];

const SECRET_KEY_PATTERN = /(api[_-]?key|token|secret|password|authorization|credential|private[_-]?key)/i;
const SECRET_VALUE_PATTERN = /(sk-[a-zA-Z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|ghp_[0-9A-Za-z]{20,}|Bearer\s+[A-Za-z0-9._-]{12,})/g;

/**
 * Redacts API keys, bearer tokens, and secret assignments from logs/output.
 */
export function redactSecrets(input: string): string {
  if (!input) return '';
  return input
    .replace(SECRET_VALUE_PATTERN, '[REDACTED_SECRET]')
    .replace(
      /((?:ANTHROPIC_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|TOKEN|SECRET|PASSWORD)\s*[:=]\s*)([^\s"'`]+)/gi,
      '$1[REDACTED_SECRET]'
    );
}

/**
 * Filters environment variables so sensitive credentials are never logged or leaked.
 */
export function sanitizeLaunchEnv(
  customEnv: Record<string, string> = {}
): { mergedEnv: NodeJS.ProcessEnv; redactedKeys: string[] } {
  const redactedKeys: string[] = [];
  const safeCustomEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(customEnv)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      redactedKeys.push(key);
    } else {
      safeCustomEnv[key] = value;
    }
  }

  return {
    mergedEnv: {
      ...process.env,
      ...safeCustomEnv,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    },
    redactedKeys,
  };
}

/**
 * Returns the S1 Capability Audit Matrix listing verified, unverified, and unsupported features.
 */
export function getCapabilityMatrix(): CliCapabilityMatrixEntry[] {
  return [
    {
      id: 'claude',
      name: 'Claude Code',
      vendor: 'Anthropic PBC',
      windowsSupport: 'verified',
      authMechanism: 'Anthropic OAuth (`claude login`) or `ANTHROPIC_API_KEY`',
      nonInteractiveCheck: 'verified',
      interactivePtySession: 'verified',
      autonomousDaemonBridge: 'unsupported',
      notes: 'Verified native Windows binary (`claude.exe`). Interactive TUI requires host terminal session.',
    },
    {
      id: 'codex',
      name: 'OpenAI Codex',
      vendor: 'OpenAI Inc.',
      windowsSupport: 'verified',
      authMechanism: 'OpenAI OAuth or `OPENAI_API_KEY`',
      nonInteractiveCheck: 'verified',
      interactivePtySession: 'verified',
      autonomousDaemonBridge: 'unsupported',
      notes: 'Verified Windows npm wrapper (`codex.cmd`). Interactive mode runs inside host terminal session.',
    },
    {
      id: 'gemini',
      name: 'Gemini CLI',
      vendor: 'Google LLC',
      windowsSupport: 'verified',
      authMechanism: 'Google OAuth or `GEMINI_API_KEY`',
      nonInteractiveCheck: 'verified',
      interactivePtySession: 'verified',
      autonomousDaemonBridge: 'unsupported',
      notes: 'Verified Windows npm wrapper (`gemini.cmd`). Requires interactive Google login on first launch if no API key is set.',
    },
    {
      id: 'antigravity',
      name: 'Antigravity',
      vendor: 'Google LLC',
      windowsSupport: 'verified',
      authMechanism: 'Desktop IDE session (`agy.exe`)',
      nonInteractiveCheck: 'verified',
      interactivePtySession: 'unverified',
      autonomousDaemonBridge: 'unsupported',
      notes: 'Local `agy.exe` CLI binary is detectable for version/workspace launch, but headless autonomous agent streaming over a public daemon API is unsupported in MVP.',
    },
  ];
}

/**
 * Searches system PATH and common Windows install directories for executable candidates.
 */
export function findExecutableOnPath(candidateNames: string[]): string | null {
  const pathEnv = process.env.PATH || '';
  const pathDirs = pathEnv.split(path.delimiter).filter(Boolean);

  // Common additional Windows directories where developer CLIs might reside
  const homeDir = process.env.USERPROFILE || process.env.HOME || '';
  const additionalDirs = [
    path.join(homeDir, '.local', 'bin'),
    path.join(homeDir, 'AppData', 'Roaming', 'npm'),
    path.join(homeDir, 'AppData', 'Local', 'agy', 'bin'),
    path.join(homeDir, 'AppData', 'Local', 'Programs', 'Antigravity', 'bin'),
    path.join(homeDir, 'AppData', 'Local', 'Programs', 'Antigravity IDE', 'bin'),
  ].filter((d) => fs.existsSync(d));

  const allDirs = Array.from(new Set([...pathDirs, ...additionalDirs]));

  for (const dir of allDirs) {
    for (const name of candidateNames) {
      const fullPath = path.join(dir, name);
      try {
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          if (stats.isFile()) {
            return fullPath;
          }
        }
      } catch {
        // Ignore file access permission errors during traversal
      }
    }
  }

  return null;
}

/**
 * Executes an executable or Windows .cmd/.bat wrapper safely without shell:true deprecation warnings.
 */
async function runExecutableSafe(
  exePath: string,
  args: string[],
  options: { cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<{ stdout: string; stderr: string }> {
  const isWinBatch = process.platform === 'win32' && /\.(cmd|bat)$/i.test(exePath);
  const timeout = options.timeout ?? 5000;
  const env = options.env ?? process.env;

  if (isWinBatch) {
    // Run via cmd.exe using the executable's directory as cwd when no cwd is required,
    // or pass the short/basename command if on PATH so spaces in USERPROFILE do not break cmd.exe parsing.
    const exeDir = path.dirname(exePath);
    const exeBase = path.basename(exePath);
    const mergedPath = `${exeDir}${path.delimiter}${env.PATH || process.env.PATH || ''}`;
    const res = await execFileAsync('cmd.exe', ['/d', '/s', '/c', exeBase, ...args], {
      cwd: options.cwd || exeDir,
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 64,
      env: { ...env, PATH: mergedPath },
    });
    return { stdout: String(res.stdout || ''), stderr: String(res.stderr || '') };
  }

  const res = await execFileAsync(exePath, args, {
    cwd: options.cwd,
    timeout,
    windowsHide: true,
    maxBuffer: 1024 * 64,
    env,
  });
  return { stdout: String(res.stdout || ''), stderr: String(res.stderr || '') };
}

/**
 * Executes executable with versionArgs to extract live version string.
 */
export async function queryExecutableVersion(exePath: string, args: string[] = ['--version']): Promise<string | null> {
  try {
    const { stdout, stderr } = await runExecutableSafe(exePath, args, { timeout: 5000 });
    const output = (stdout || stderr || '').trim();
    if (!output) return null;
    const firstLine = output.split(/[\r\n]+/)[0].trim();
    return redactSecrets(firstLine.substring(0, 80));
  } catch {
    return null;
  }
}

/**
 * Inspects a specific CLI tool by identifier or command name.
 */
export async function inspectCliStatus(nameOrId: string): Promise<CliStatusResponse> {
  const def = SUPPORTED_CLI_DEFINITIONS.find(
    (d) => d.id === nameOrId.toLowerCase() || d.cliName === nameOrId.toLowerCase()
  );

  const candidates = def ? def.binaryCandidates : [nameOrId, `${nameOrId}.exe`, `${nameOrId}.cmd`];
  const foundPath = findExecutableOnPath(candidates);

  if (!foundPath) {
    return {
      cliName: nameOrId,
      isInstalled: false,
    };
  }

  const version = await queryExecutableVersion(foundPath, def?.versionArgs || ['--version']);

  return {
    cliName: nameOrId,
    isInstalled: true,
    path: foundPath,
    version: version || 'Installed (version unknown)',
  };
}

/**
 * Returns full AiCliTool array populated with real host detection state.
 */
export async function getLiveCliCatalog(): Promise<AiCliTool[]> {
  const tools: AiCliTool[] = [];

  for (const def of SUPPORTED_CLI_DEFINITIONS) {
    const status = await inspectCliStatus(def.id);
    tools.push({
      id: def.id,
      name: def.name,
      cliName: def.cliName,
      description: def.description,
      vendor: def.vendor,
      status: status.isInstalled ? 'installed' : def.id === 'gemini' ? 'needs_setup' : 'unavailable',
      version: status.version || 'Not installed',
      installCommand: def.installCommand,
      installScope: def.installScope,
      runCommand: def.runCommand,
      permissionsRequired: def.permissionsRequired,
      capabilities: def.capabilities,
    });
  }

  return tools;
}

/**
 * Phase S3: Agent-specific launch adapter with working-directory validation,
 * secret redaction, and honest unsupported/manual-auth states.
 */
export async function launchCliAgent(req: CliLaunchRequest): Promise<CliLaunchResponse> {
  const toolId = (req.toolId || '').toLowerCase().trim();
  const workingDir = path.resolve(req.workingDir || process.cwd());
  const { mergedEnv, redactedKeys } = sanitizeLaunchEnv(req.env);

  const def = SUPPORTED_CLI_DEFINITIONS.find((d) => d.id === toolId || d.cliName === toolId);
  if (!def) {
    return {
      toolId: req.toolId,
      launched: false,
      status: 'unsupported',
      workingDir,
      output: `Tool '${req.toolId}' is not in the verified Windows CLI catalog.`,
      redactedEnvKeys: redactedKeys,
    };
  }

  if (!fs.existsSync(workingDir) || !fs.statSync(workingDir).isDirectory()) {
    return {
      toolId: def.id,
      launched: false,
      status: 'error',
      workingDir,
      output: `Invalid working directory: '${workingDir}' does not exist or is not a directory.`,
      redactedEnvKeys: redactedKeys,
    };
  }

  const status = await inspectCliStatus(def.id);
  if (!status.isInstalled || !status.path) {
    return {
      toolId: def.id,
      launched: false,
      status: 'not_installed',
      workingDir,
      output: `${def.name} is not installed on this Windows host. Install with: ${def.installCommand}`,
      redactedEnvKeys: redactedKeys,
    };
  }

  // Honest provider-specific state for Antigravity autonomous runtime
  if (def.isAutomationRuntime && (!req.args || req.args.length === 0)) {
    return {
      toolId: def.id,
      launched: false,
      status: 'unsupported',
      executablePath: status.path,
      workingDir,
      version: status.version,
      output: `Antigravity binary (${status.version}) is present at '${status.path}', but headless autonomous agent streaming is unsupported without an active IDE daemon bridge.`,
      redactedEnvKeys: redactedKeys,
    };
  }

  const safeArgs = req.args && req.args.length > 0 ? req.args : ['--version'];
  try {
    const { stdout, stderr } = await runExecutableSafe(status.path, safeArgs, {
      cwd: workingDir,
      timeout: 6000,
      env: mergedEnv,
    });
    const combined = redactSecrets((stdout || stderr || '').trim());
    return {
      toolId: def.id,
      launched: true,
      status: 'completed',
      executablePath: status.path,
      workingDir,
      version: status.version,
      exitCode: 0,
      output: combined || `${def.name} (${status.version}) verified in ${workingDir}. Attach to host terminal session for interactive TUI.`,
      redactedEnvKeys: redactedKeys,
    };
  } catch (err: any) {
    const rawMsg = redactSecrets(String(err.stderr || err.stdout || err.message || 'Unknown launch error').trim());
    const needsAuth = /auth|login|api[_ -]?key|unauthorized|credential/i.test(rawMsg);
    return {
      toolId: def.id,
      launched: false,
      status: needsAuth ? 'requires_auth' : 'error',
      executablePath: status.path,
      workingDir,
      version: status.version,
      exitCode: typeof err.code === 'number' ? err.code : 1,
      output: needsAuth
        ? `${def.name} requires manual authentication in an interactive terminal session: ${rawMsg}`
        : `Failed to launch ${def.name}: ${rawMsg}`,
      redactedEnvKeys: redactedKeys,
    };
  }
}

/**
 * Handles authorized installation check with structured log output.
 */
export async function executeInstallTool(toolId: string): Promise<InstallToolResponse> {
  const def = SUPPORTED_CLI_DEFINITIONS.find((d) => d.id === toolId);
  if (!def) {
    return {
      toolId,
      success: false,
      installedVersion: '',
      outputLog: `Error: Tool ID '${toolId}' is not recognized in supported catalog.`,
    };
  }

  // Check if already installed
  const existing = await inspectCliStatus(def.id);
  if (existing.isInstalled) {
    return {
      toolId,
      success: true,
      installedVersion: existing.version || 'Installed',
      outputLog: `Tool '${def.name}' is already installed at: ${existing.path}`,
    };
  }

  return {
    toolId,
    success: false,
    installedVersion: '',
    outputLog: `Installation requires elevated terminal authorization. Command: ${def.installCommand}`,
  };
}
