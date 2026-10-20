import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { AiCliTool } from '../types/relay';
import { CliStatusResponse, InstallToolResponse } from './contracts';

const execFileAsync = promisify(execFile);

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
  isAutomationRuntime?: boolean;
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
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    cliName: 'codex',
    binaryCandidates: ['codex.exe', 'codex.cmd', 'codex'],
    description: 'Code synthesizer and shell automation assistant powered by OpenAI models.',
    vendor: 'OpenAI Inc.',
    versionArgs: ['--version'],
    installCommand: 'npm install -g @openai/codex-cli',
    installScope: 'Global Windows Node.js (%APPDATA%\\npm)',
    runCommand: 'codex',
    permissionsRequired: ['Native Shell Execution', 'File System Read'],
    capabilities: ['Code synthesis', 'Refactoring suggestions', 'Inline bug detection'],
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
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    cliName: 'antigravity',
    binaryCandidates: ['antigravity.exe', 'antigravity.cmd', 'agy.exe', 'agy.cmd', 'agy'],
    description: 'Autonomous agent runtime environment for automated workspace tasks.',
    vendor: 'Google LLC',
    versionArgs: ['--version'],
    installCommand: 'antigravity-daemon --host 127.0.0.1:9872',
    installScope: 'Host Agent Daemon Service (Port 9872)',
    runCommand: 'agy',
    permissionsRequired: ['Agent Runtime Control', 'Autonomous Workspace Execution'],
    capabilities: ['Autonomous task planning', 'Multi-file edits', 'Agent observation'],
    isAutomationRuntime: true,
  },
];

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
 * Executes executable with versionArgs to extract live version string.
 */
export async function queryExecutableVersion(exePath: string, args: string[] = ['--version']): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(exePath, args, {
      timeout: 4000,
      windowsHide: true,
      maxBuffer: 1024 * 64,
    });
    const output = (stdout || stderr || '').trim();
    if (!output) return null;
    // Extract first line
    const firstLine = output.split(/[\r\n]+/)[0].trim();
    return firstLine.substring(0, 80);
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
 * Simulates or handles authorized installation with structured log output.
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
