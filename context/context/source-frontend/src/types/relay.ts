export type IntentStatus =
  | 'queued'
  | 'dependency_blocked'
  | 'diverged'
  | 'reconciled'
  | 'skipped'
  | 'cancelled'
  | 'executing'
  | 'failed';

export interface CommandIntent {
  id: string;
  seq: number;
  command: string;
  workingDir: string;
  projectName: string;
  timestamp: number;
  status: IntentStatus;
  causalDependencyHash: string;
  expectedBaseBranch: string;
  expectedHeadCommit: string;
  resultOutput?: string;
  executionDurationMs?: number;
  divergenceDetails?: {
    reason: string;
    pcCurrentBranch: string;
    pcDirtyFiles: number;
    diffSnippet: string;
    suggestedResolution: 'rebase' | 'force_run' | 'skip';
  };
}

export type LineType =
  | 'input'
  | 'output'
  | 'error'
  | 'system'
  | 'intent_buffered'
  | 'ai_thought'
  | 'reconciled_exec'
  | 'progress';

export interface TerminalLine {
  id: string;
  type: LineType;
  content: string;
  timestamp: string;
  seq?: number;
  intentId?: string;
  isStreaming?: boolean;
}

export interface TerminalSession {
  id: string;
  title: string;
  type: 'powershell' | 'cmd' | 'bash' | 'claude' | 'codex' | 'gemini' | 'antigravity' | 'build' | 'process_monitor';
  workingDir: string;
  history: string[];
  buffer: TerminalLine[];
  isRunning: boolean;
  activePid?: number;
}

export interface ProjectFile {
  name: string;
  path: string;
  isDir: boolean;
  size?: string;
  modified: string;
  gitStatus?: 'M' | 'A' | 'D' | 'U' | 'clean';
  content?: string;
  children?: ProjectFile[];
}

export interface Project {
  id: string;
  name: string;
  path: string;
  branch: string;
  isDirty: boolean;
  dirtyCount: number;
  ahead: number;
  behind: number;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    time: string;
  };
  pinned: boolean;
  files: ProjectFile[];
}

export interface AiCliTool {
  id: string;
  name: string;
  cliName: string;
  description: string;
  vendor: string;
  status: 'installed' | 'needs_setup' | 'update_available' | 'running' | 'unavailable';
  version: string;
  installCommand: string;
  installScope: string;
  runCommand: string;
  permissionsRequired: string[];
  capabilities: string[];
}

export interface DevServer {
  id: string;
  port: number;
  url: string;
  name: string;
  framework: string;
  status: 'active' | 'restarting' | 'idle';
  tunnelLatencyMs: number;
  route: string;
}

export interface DeviceInfo {
  isOnline: boolean;
  deviceName: string;
  os: string;
  ip: string;
  port: number;
  daemonVersion: string;
  pingMs: number;
  pairedAt: string;
  ed25519Fingerprint: string;
  pairingToken: string;
  sqliteDbSizeKb: number;
  isReconciling?: boolean;
  backendServerStatus: 'running' | 'stopped' | 'starting';
  tunnelStatus: 'active' | 'reconnecting' | 'idle';
  totalIntentsProcessed: number;
  cpuUsagePercent: number;
  memoryUsageMb: number;
  activePortBindings: number[];
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  avatarUrl: string;
  accountTier: 'Pro Developer' | 'Enterprise Team' | 'Personal';
  isLoggedIn: boolean;
  tokenExpiresAt: string;
}

export type MobileNavSection =
  | 'explorer'
  | 'terminal'
  | 'git'
  | 'run'
  | 'preview'
  | 'settings'
  | 'more';

export type MobileConnectionStep =
  | 'welcome'
  | 'login'
  | 'enter_key'
  | 'connecting'
  | 'connected'
  | 'error';
