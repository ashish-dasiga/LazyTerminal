import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  AiCliTool,
  CommandIntent,
  DeviceInfo,
  DevServer,
  Project,
  ProjectFile,
  TerminalLine,
  TerminalSession,
  UserAccount,
  MobileConnectionStep,
  MobileNavSection,
} from '../types/relay';
import { executeCommandOnDaemon } from '../services/mockDaemon';
import { getBackendAdapter, WindowsHostConnectionClient } from '../services';
import { GitStatusResponse } from '../services/contracts';
import {
  enqueueIntent,
  seedOrListIntents,
  detectDivergedIntents,
  updateIntentStatus,
  deleteIntent as deleteStoredIntent,
  clearAllIntents as clearAllStoredIntents,
} from '../services/offlineQueue';
import {
  markConnected,
  markDisconnected,
} from '../services/connectionMonitor';

export const DEFAULT_USER: UserAccount = {
  id: 'usr_dev_7701',
  username: 'alex.chen',
  email: 'alex.chen@workplace.internal',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  accountTier: 'Pro Developer',
  isLoggedIn: true,
  tokenExpiresAt: '2026-10-15 23:59 UTC',
};

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'hyper-relay',
    name: 'hyper-relay',
    path: 'C:\\Projects\\hyper-relay',
    branch: 'main',
    isDirty: true,
    dirtyCount: 2,
    ahead: 1,
    behind: 0,
    lastCommit: {
      hash: '3f7a8b1',
      message: 'feat: add local SQLite WAL intent persistence and sequence ledger',
      author: 'alex.chen@relay-terminal.io',
      time: '24m ago',
    },
    pinned: true,
    files: [
      {
        name: 'src',
        path: 'src',
        isDir: true,
        modified: '10/12/2026 09:10',
        children: [
          {
            name: 'relay_daemon.rs',
            path: 'src/relay_daemon.rs',
            isDir: false,
            size: '18.1 KB',
            modified: '10/12/2026 09:12',
            gitStatus: 'M',
            content: `// Windows 11 Native Relay Daemon\nuse tokio::net::TcpListener;\nuse ed25519_dalek::{PublicKey, Signature};\n\n#[tokio::main]\npub async fn main() -> Result<(), Box<dyn std::error::Error>> {\n    println!("Starting Relay Daemon on port 9871...");\n    let listener = TcpListener::bind("0.0.0.0:9871").await?;\n    println!("Listening for verified mobile pairing tokens...");\n    loop {\n        let (socket, _) = listener.accept().await?;\n        tokio::spawn(async move {\n            handle_client(socket).await;\n        });\n    }\n}`,
          },
          {
            name: 'wal_ledger.rs',
            path: 'src/wal_ledger.rs',
            isDir: false,
            size: '7.4 KB',
            modified: '10/12/2026 08:40',
            gitStatus: 'clean',
            content: `// SQLite WAL Reconciler\nuse rusqlite::{Connection, Result};\n\npub fn sync_offline_intents(conn: &Connection) -> Result<usize> {\n    let mut stmt = conn.prepare("SELECT id, cmd, seq FROM intents WHERE status = 'queued'")?;\n    // verify causal sequence...\n    Ok(0)\n}`,
          },
        ],
      },
      {
        name: 'config',
        path: 'config',
        isDir: true,
        modified: '10/12/2026 08:44',
        children: [
          {
            name: 'tunnel.yaml',
            path: 'config/tunnel.yaml',
            isDir: false,
            size: '1.2 KB',
            modified: '10/12/2026 08:30',
            gitStatus: 'U',
            content: `version: 2\ntunnel:\n  id: tun-784-relay-direct\n  key_exchange: ed25519-chacha20poly1305\n  heartbeat_ms: 1200\n  local_forward: 9871\n  cloud_fallback: optional`,
          },
        ],
      },
      {
        name: 'Cargo.toml',
        path: 'Cargo.toml',
        isDir: false,
        size: '2.4 KB',
        modified: '10/12/2026 09:10',
        gitStatus: 'M',
        content: `[package]\nname = "hyper-relay"\nversion = "1.4.0"\nedition = "2021"\n\n[dependencies]\ntokio = { version = "1.36", features = ["full"] }\nrusqlite = "0.31"\ned25519-dalek = "2.1"\nserde = { version = "1.0", features = ["derive"] }`,
      },
      {
        name: 'README.md',
        path: 'README.md',
        isDir: false,
        size: '4.8 KB',
        modified: '10/11/2026 14:02',
        gitStatus: 'clean',
        content: `# Hyper Relay Windows Host\n\nHigh-performance remote development bridge for Windows 11 PC.\nConnect from Android phone via random 6-character connection key.`,
      },
      {
        name: 'notes.txt',
        path: 'notes.txt',
        isDir: false,
        size: '0.9 KB',
        modified: '10/12/2026 07:15',
        gitStatus: 'clean',
        content: `TODO list:\n- Verify TLS 1.3 socket reconnect\n- Test offline intent batching\n- Review Claude Code AST inspect tool`,
      },
    ],
  },
  {
    id: 'ai-agents',
    name: 'claude-fleet',
    path: 'C:\\Dev\\ai-agents\\claude-fleet',
    branch: 'feat/tool-streaming',
    isDirty: false,
    dirtyCount: 0,
    ahead: 3,
    behind: 0,
    lastCommit: {
      hash: 'a9c210d',
      message: 'perf: stream tool outputs directly to xterm vt100 sink',
      author: 'alex.chen@relay-terminal.io',
      time: '2h ago',
    },
    pinned: true,
    files: [
      {
        name: 'agent.ts',
        path: 'agent.ts',
        isDir: false,
        size: '12.4 KB',
        modified: '10/12/2026 07:44',
        gitStatus: 'clean',
        content: `import { Agent } from '@anthropic-ai/claude-code';\n\nexport const fleet = new Agent({\n  name: 'Terminal-Fleet',\n  tools: ['bash', 'read_file', 'edit_file'],\n});`,
      },
      {
        name: 'package.json',
        path: 'package.json',
        isDir: false,
        size: '1.8 KB',
        modified: '10/12/2026 07:20',
        gitStatus: 'clean',
        content: `{\n  "name": "claude-fleet",\n  "version": "1.0.0",\n  "type": "module"\n}`,
      },
    ],
  },
  {
    id: 'enterprise-dashboard',
    name: 'enterprise-dashboard',
    path: 'C:\\Work\\enterprise-dashboard',
    branch: 'release/v2.4',
    isDirty: false,
    dirtyCount: 0,
    ahead: 0,
    behind: 1,
    lastCommit: {
      hash: '7e11409',
      message: 'chore: update production bundle chunking',
      author: 'ci-bot',
      time: 'Yesterday',
    },
    pinned: false,
    files: [
      {
        name: 'next.config.mjs',
        path: 'next.config.mjs',
        isDir: false,
        size: '3.1 KB',
        modified: '10/11/2026 14:00',
        gitStatus: 'clean',
        content: `export default { reactStrictMode: true };`,
      },
    ],
  },
];

const INITIAL_CLI_TOOLS: AiCliTool[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    cliName: 'claude',
    description: 'Anthropic agentic CLI for full-codebase navigation, editing, and tool execution on Windows PC.',
    vendor: 'Anthropic PBC',
    status: 'installed',
    version: 'v1.0.8',
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
    description: 'Code synthesizer and shell automation assistant powered by OpenAI models.',
    vendor: 'OpenAI Inc.',
    status: 'installed',
    version: 'v0.9.4',
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
    description: 'Developer multi-turn workspace reasoning CLI with grounding in your local repo.',
    vendor: 'Google LLC',
    status: 'installed',
    version: 'v2.5.0',
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
    description: 'Autonomous agent runtime environment for automated workspace tasks.',
    vendor: 'Google LLC',
    status: 'installed',
    version: 'v1.2.0',
    installCommand: 'antigravity-daemon --host 127.0.0.1:9872',
    installScope: 'Host Agent Daemon Service (Port 9872)',
    runCommand: 'antigravity',
    permissionsRequired: ['Agent Runtime Control', 'Autonomous Workspace Execution'],
    capabilities: ['Autonomous task planning', 'Multi-file edits', 'Agent observation'],
  },
];

const INITIAL_DEV_SERVERS: DevServer[] = [
  {
    id: 'srv-vite',
    port: 5173,
    url: 'http://localhost:5173',
    name: 'Vite Frontend (hyper-relay client)',
    framework: 'React + TypeScript + Vite 5.4',
    status: 'active',
    tunnelLatencyMs: 14,
    route: '/',
  },
  {
    id: 'srv-api',
    port: 9871,
    url: 'http://localhost:9871',
    name: 'Relay Daemon Control API',
    framework: 'Rust Tokio Async Daemon',
    status: 'active',
    tunnelLatencyMs: 9,
    route: '/api/v1/health',
  },
];

const INITIAL_SESSIONS: TerminalSession[] = [
  {
    id: 'sess-pwsh',
    title: 'PowerShell 7.4',
    type: 'powershell',
    workingDir: 'C:\\Projects\\hyper-relay',
    history: ['git status', 'cargo check', 'git diff'],
    isRunning: false,
    buffer: [],
  },
  {
    id: 'sess-cmd',
    title: 'Command Prompt (CMD)',
    type: 'cmd',
    workingDir: 'C:\\Projects\\hyper-relay',
    history: ['dir', 'ver'],
    isRunning: false,
    buffer: [],
  },
  {
    id: 'sess-bash',
    title: 'Bash (WSL)',
    type: 'bash',
    workingDir: 'C:\\Projects\\hyper-relay',
    history: ['uname -a', 'ls -la'],
    isRunning: false,
    buffer: [],
  },
  {
    id: 'sess-claude',
    title: 'Claude Code',
    type: 'claude',
    workingDir: 'C:\\Projects\\hyper-relay',
    history: ['claude "inspect SQLite WAL checkpoint code"'],
    isRunning: false,
    buffer: [
      {
        id: 'cl-init-1',
        type: 'ai_thought',
        content: `\x1b[35m[Claude Code v1.0.8]\x1b[0m Attached to persistent session. Reading workspace context...`,
        timestamp: '09:08:40',
      },
      {
        id: 'cl-init-2',
        type: 'output',
        content: `\x1b[32mâœ” Project indexed\x1b[0m: 7 files parsed. Ready for developer commands.`,
        timestamp: '09:08:42',
      },
    ],
  },
  {
    id: 'sess-codex',
    title: 'Codex CLI',
    type: 'codex',
    workingDir: 'C:\\Projects\\hyper-relay',
    history: ['codex "generate tests"'],
    isRunning: false,
    buffer: [],
  },
  {
    id: 'sess-gemini',
    title: 'Gemini CLI',
    type: 'gemini',
    workingDir: 'C:\\Projects\\hyper-relay',
    history: ['gemini "explain wal_ledger.rs"'],
    isRunning: false,
    buffer: [
      {
        id: 'gemini-init-1',
        type: 'ai_thought',
        content: `\x1b[34m[Gemini CLI v2.5.0]\x1b[0m Ready. Authenticated with Google Cloud Project.\nWorkspace indexed. Multi-turn reasoning available.`,
        timestamp: '14:00:10',
      },
    ],
  },
  {
    id: 'sess-antigravity',
    title: 'Antigravity',
    type: 'antigravity',
    workingDir: 'C:\\Projects\\hyper-relay',
    history: ['antigravity status'],
    isRunning: false,
    buffer: [
      {
        id: 'ag-init-1',
        type: 'output',
        content: `\x1b[32m[Antigravity Agent Runtime v1.2.0]\x1b[0m Connected to Windows daemon bridge.\nAutonomous planner idle. Listening for tasks.`,
        timestamp: '14:00:15',
      },
    ],
  },
  {
    id: 'sess-build',
    title: 'Dev Server Watcher',
    type: 'build',
    workingDir: 'C:\\Projects\\hyper-relay',
    history: ['npm run dev'],
    isRunning: true,
    buffer: [
      {
        id: 'b-init-1',
        type: 'output',
        content: `\x1b[32m  VITE v5.4.8\x1b[0m  \x1b[90mready in \x1b[1m218 ms\x1b[0m\n\n  \x1b[32mâžœ\x1b[0m  \x1b[1mLocal:\x1b[0m   \x1b[36mhttp://localhost:5173/\x1b[0m\n  \x1b[32mâžœ\x1b[0m  \x1b[1mTunnel:\x1b[0m  \x1b[36mhttps://tun-784.relay.internal/\x1b[0m (Sub-15ms E2E Encrypted)\n  \x1b[90m[HMR] websocket connection established\x1b[0m`,
        timestamp: '09:05:00',
      },
    ],
  },
];

const INITIAL_INTENTS: CommandIntent[] = [
  {
    id: 'intent-101',
    seq: 1,
    command: 'git checkout -b feature/reconciliation-engine',
    workingDir: 'C:\\Projects\\hyper-relay',
    projectName: 'hyper-relay',
    timestamp: Date.now() - 1000 * 60 * 18,
    status: 'queued',
    causalDependencyHash: 'sha256:8f2a1b9',
    expectedBaseBranch: 'main',
    expectedHeadCommit: '3f7a8b1',
  },
  {
    id: 'intent-102',
    seq: 2,
    command: 'git add src/relay_daemon.rs config/tunnel.yaml',
    workingDir: 'C:\\Projects\\hyper-relay',
    projectName: 'hyper-relay',
    timestamp: Date.now() - 1000 * 60 * 14,
    status: 'queued',
    causalDependencyHash: 'sha256:4c1e7a0',
    expectedBaseBranch: 'feature/reconciliation-engine',
    expectedHeadCommit: '3f7a8b1',
  },
  {
    id: 'intent-103',
    seq: 3,
    command: 'git commit -m "feat(wal): persist causal graph sequence for offline reconciliation"',
    workingDir: 'C:\\Projects\\hyper-relay',
    projectName: 'hyper-relay',
    timestamp: Date.now() - 1000 * 60 * 8,
    status: 'queued',
    causalDependencyHash: 'sha256:0d9f4e2',
    expectedBaseBranch: 'feature/reconciliation-engine',
    expectedHeadCommit: '3f7a8b1',
  },
];

interface RelayContextType {
  // Dual frontend switcher
  activeFrontend: 'portal' | 'mobile' | 'laptop';
  setActiveFrontend: (fe: 'portal' | 'mobile' | 'laptop') => void;

  // User Account & Mobile Connection Flow
  currentUser: UserAccount;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserAccount>>;
  connectionStep: MobileConnectionStep;
  setConnectionStep: (step: MobileConnectionStep) => void;
  connectionError: string | null;
  setConnectionError: (err: string | null) => void;
  generatedConnectionKey: string;
  regenerateConnectionKey: () => string;
  loginUser: (email: string, pass: string) => Promise<boolean>;
  connectWithKey: (key: string) => Promise<boolean>;
  disconnectMobile: () => void;

  // Mobile Navigation
  mobileNav: MobileNavSection;
  setMobileNav: (nav: MobileNavSection) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;

  // Device & Host PC State
  device: DeviceInfo;
  setDevice: React.Dispatch<React.SetStateAction<DeviceInfo>>;
  togglePcOnline: () => void;
  toggleBackendServer: () => void;

  // Projects & Files
  projects: Project[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  activeProject: Project;
  activeFile: ProjectFile | null;
  setActiveFile: (file: ProjectFile | null) => void;
  saveFileContent: (path: string, newContent: string) => void;
  createFile: (name: string, isTextOnly?: boolean) => void;
  createFolder: (name: string) => void;
  unsavedFiles: Record<string, string>;
  setUnsavedDraft: (path: string, draft: string, originalContent?: string) => void;
  clearUnsavedDraft: (path: string) => void;
  fileModal: 'none' | 'new_file' | 'new_folder' | 'open_with' | 'no_file_selected';
  setFileModal: (modal: 'none' | 'new_file' | 'new_folder' | 'open_with' | 'no_file_selected') => void;
  fileLoading: boolean;
  fileError: string | null;
  clearFileError: () => void;
  loadFileContent: (filePath: string) => Promise<string>;
  refreshFiles: (subDir?: string) => Promise<void>;
  deleteProjectFile: (filePath: string) => Promise<void>;
  gitStatus: GitStatusResponse | null;
  refreshGitStatus: () => Promise<void>;

  // Sessions & Terminal
  sessions: TerminalSession[];
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  activeSession: TerminalSession;
  createSession: (title: string, type: TerminalSession['type']) => void;
  closeSession: (id: string) => void;
  executeCommand: (cmd: string) => Promise<void>;
  sendSignal: (signal: 'SIGINT' | 'SIGTERM' | 'CLEAR') => void;
  history: string[];

  // Tools & Preview
  cliTools: AiCliTool[];
  installCliTool: (id: string) => Promise<void>;
  devServers: DevServer[];
  isScanningPc: boolean;
  scanPcRepositories: () => Promise<void>;

  // Offline Queue
  intentQueue: CommandIntent[];
  addDraftIntent: (cmd: string) => void;
  reconcileSingleIntent: (id: string, action: 'run' | 'skip' | 'cancel') => Promise<void>;
  reconcileAllIntents: (forceRun?: boolean) => Promise<void>;
  clearIntentQueue: () => void;
  deleteIntent: (id: string) => void;
  reconciliationPromptOpen: boolean;
  setReconciliationPromptOpen: (open: boolean) => void;

  // Styling & Options
  fontSize: number;
  setFontSize: React.Dispatch<React.SetStateAction<number>>;
  scanlineEffect: boolean;
  setScanlineEffect: React.Dispatch<React.SetStateAction<boolean>>;
  interceptedCli: { toolName: string; cliName: string; installCommand: string } | null;
  dismissCliIntercept: () => void;
}

const RelayContext = createContext<RelayContextType | null>(null);

function getInitialFrontend(): 'portal' | 'mobile' | 'laptop' {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'mobile' || params.get('source') === 'pwa' || params.get('source') === 'apk') {
      return 'mobile';
    }
    if (params.get('view') === 'laptop') {
      return 'laptop';
    }
    if (params.get('view') === 'install' || params.get('view') === 'portal') {
      return 'portal';
    }
    // Inside native Android APK WebView (file:///android_asset/...)
    if (window.location.protocol === 'file:') {
      return 'mobile';
    }
  }
  return 'portal';
}

export function RelayProvider({ children }: { children: ReactNode }) {
  const [activeFrontend, setActiveFrontend] = useState<'portal' | 'mobile' | 'laptop'>(getInitialFrontend);
  const [currentUser, setCurrentUser] = useState<UserAccount>(DEFAULT_USER);
  const [connectionStep, setConnectionStep] = useState<MobileConnectionStep>('enter_key');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [generatedConnectionKey, setGeneratedConnectionKey] = useState<string>('');

  // Mobile drawer & navigation
  const [mobileNav, setMobileNav] = useState<MobileNavSection>('terminal');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Host PC & backend
  const [device, setDevice] = useState<DeviceInfo>({
    isOnline: true,
    deviceName: 'DESKTOP-WIN11-PRO',
    os: 'Windows 11 Pro 23H2 (Build 22631.4169)',
    ip: '192.168.1.142',
    port: 9871,
    daemonVersion: 'v1.4.0 (tokio-xterm-vt100)',
    pingMs: 18,
    pairedAt: 'October 12, 2026',
    ed25519Fingerprint: 'SHA256:4b7f8c2e91a0...93d8',
    pairingToken: '',
    sqliteDbSizeKb: 142,
    backendServerStatus: 'running',
    tunnelStatus: 'idle',
    totalIntentsProcessed: 28,
    cpuUsagePercent: 4.2,
    memoryUsageMb: 184,
    activePortBindings: [5173, 9871, 3000],
  });

  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>('hyper-relay');
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [unsavedFiles, setUnsavedFiles] = useState<Record<string, string>>({});
  const [fileModal, setFileModal] = useState<'none' | 'new_file' | 'new_folder' | 'open_with' | 'no_file_selected'>('none');

  const [sessions, setSessions] = useState<TerminalSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>('sess-pwsh');

  const [cliTools, setCliTools] = useState<AiCliTool[]>(INITIAL_CLI_TOOLS);
  const [devServers, setDevServers] = useState<DevServer[]>(INITIAL_DEV_SERVERS);
  const [intentQueue, setIntentQueue] = useState<CommandIntent[]>(INITIAL_INTENTS);
  const [history, setHistory] = useState<string[]>([
    'git status',
    'git diff',
    'cargo test',
    'claude "inspect SQLite WAL checkpoint code"',
    'dir',
  ]);

  const [isScanningPc, setIsScanningPc] = useState(false);
  const [reconciliationPromptOpen, setReconciliationPromptOpen] = useState(false);
  const [fontSize, setFontSize] = useState<number>(13);
  const [scanlineEffect, setScanlineEffect] = useState(false);
  const [interceptedCli, setInterceptedCli] = useState<{
    toolName: string;
    cliName: string;
    installCommand: string;
  } | null>(null);

  // Ashritha Subsystem 4 & 5: Live Filesystem & Git State
  const [fileLoading, setFileLoading] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatusResponse | null>(null);
  const fileHashesRef = useRef<Record<string, string>>({});
  const clearFileError = useCallback(() => setFileError(null), []);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Helper map for installed CLIs
  const installedCliMap = cliTools.reduce<Record<string, boolean>>((acc, tool) => {
    acc[tool.cliName] = tool.status === 'installed' || tool.status === 'running';
    return acc;
  }, {});

  // Sync initial pairing key from the local Windows PC companion on startup
  useEffect(() => {
    let cancelled = false;
    const syncHostKey = async () => {
      const adapter = getBackendAdapter();
      const conn = adapter.connection as any;
      if (conn && typeof conn.fetchActiveHostKey === 'function') {
        try {
          const keyEnvelope = await conn.fetchActiveHostKey();
          if (!cancelled && keyEnvelope?.pairingKey) {
            setGeneratedConnectionKey(keyEnvelope.pairingKey);
            setDevice((prev) => ({
              ...prev,
              isOnline: true,
              backendServerStatus: 'running',
              pairingToken: keyEnvelope.pairingKey,
            }));
          }
        } catch {
          if (!cancelled) {
            setDevice((prev) => ({
              ...prev,
              isOnline: false,
              backendServerStatus: 'stopped',
              tunnelStatus: 'idle',
            }));
          }
        }
      }
    };
    syncHostKey();
    return () => {
      cancelled = true;
    };
  }, []);

  // Regenerate random connection key for Windows PC
  const regenerateConnectionKey = useCallback(() => {
    const adapter = getBackendAdapter();
    const conn = adapter.connection as any;
    if (conn && typeof conn.generateHostKey === 'function') {
      conn
        .generateHostKey()
        .then((res: any) => {
          if (res?.pairingKey) {
            setGeneratedConnectionKey(res.pairingKey);
            setDevice((prev) => ({ ...prev, pairingToken: res.pairingKey }));
          }
        })
        .catch((err: any) => {
          setConnectionError(
            err instanceof Error ? err.message : 'Failed to regenerate key on Windows host.'
          );
        });
      return generatedConnectionKey;
    }

    const d1 = Math.floor(100 + Math.random() * 900);
    const d2 = Math.floor(100 + Math.random() * 900);
    const key = `${d1}-${d2}`;
    setGeneratedConnectionKey(key);
    setDevice((prev) => ({ ...prev, pairingToken: key }));
    return key;
  }, [generatedConnectionKey]);

  // Login handler
  const loginUser = useCallback(async (email: string, _pass: string) => {
    await new Promise((r) => setTimeout(r, 600));
    setCurrentUser((prev) => ({
      ...prev,
      email: email || prev.email,
      username: email ? email.split('@')[0] : prev.username,
      isLoggedIn: true,
    }));
    return true;
  }, []);

  // Connect with random key
  const connectWithKey = useCallback(async (key: string) => {
    setConnectionError(null);
    setConnectionStep('connecting');

    const adapter = getBackendAdapter();
    if (!adapter.isMock) {
      try {
        const res = await adapter.connection.connectToHost({ pairingKey: key });
        if (res.success) {
          setDevice((prev) => ({
            ...prev,
            ...res.device,
            pairingToken: generatedConnectionKey,
            isOnline: true,
            backendServerStatus: 'running',
            tunnelStatus: 'active',
          }));
          setConnectionStep('connected');
          setMobileNav('terminal');
          return true;
        }
        setConnectionStep('enter_key');
        setConnectionError(
          res.errorMessage ||
            `Incorrect token number "${key}". Please check the current 6-digit key displayed on your Windows PC.`
        );
        return false;
      } catch (err) {
        setConnectionStep('enter_key');
        const rawMsg = err instanceof Error ? err.message : String(err);
        const cleanMsg =
          rawMsg.toLowerCase().includes('<!doctype') ||
          rawMsg.toLowerCase().includes('<html') ||
          rawMsg.includes('404')
            ? 'Unable to connect to Windows PC companion. Ensure Lazy Terminal companion is running on your PC and both devices are on the same Wi-Fi.'
            : rawMsg;
        setConnectionError(cleanMsg);
        return false;
      }
    }

    await new Promise((r) => setTimeout(r, 600));

    // Normalize keys: strip dashes and spaces, lowercase
    const normalizedInput = key.replace(/[\s-]/g, '').toLowerCase();
    const normalizedTarget = generatedConnectionKey.replace(/[\s-]/g, '').toLowerCase();

    // Allow exact match (ignoring dashes/spaces)
    if (normalizedInput === normalizedTarget) {
      setConnectionStep('connected');
      setMobileNav('terminal');
      return true;
    } else {
      setConnectionStep('enter_key');
      setConnectionError(
        `Incorrect pairing code "${key}". Please enter the 6-digit code shown on your Windows companion app.`
      );
      return false;
    }
  }, [generatedConnectionKey]);

  // Disconnect mobile
  const disconnectMobile = useCallback(() => {
    const adapter = getBackendAdapter();
    if (!adapter.isMock) {
      adapter.connection.disconnectHost().catch(() => {});
    }
    setConnectionStep('enter_key');
    setConnectionError(null);
    setDevice((prev) => ({
      ...prev,
      tunnelStatus: 'idle',
    }));
  }, []);

  // Toggle PC Online / Offline
  const togglePcOnline = useCallback(() => {
    setDevice((prev) => {
      const willBeOnline = !prev.isOnline;
      return {
        ...prev,
        isOnline: willBeOnline,
        pingMs: willBeOnline ? 18 + Math.floor(Math.random() * 8) : 0,
        tunnelStatus: willBeOnline ? 'active' : 'idle',
      };
    });
  }, []);

  // Toggle Windows Backend Server
  const toggleBackendServer = useCallback(() => {
    const adapter = getBackendAdapter();
    const nextAction = device.backendServerStatus === 'running' ? 'stop' : 'start';

    if (!adapter.isMock) {
      adapter.connection
        .setHostServerStatus(nextAction)
        .then((statusRes) => {
          const isRunning = statusRes.status === 'running';
          const maybeNewKey = (statusRes as { pairingKey?: string }).pairingKey;
          if (maybeNewKey) {
            setGeneratedConnectionKey(maybeNewKey);
          }
          setDevice((prev) => ({
            ...prev,
            backendServerStatus: statusRes.status,
            isOnline: isRunning,
            tunnelStatus: isRunning ? 'active' : 'idle',
            activePortBindings: statusRes.activePortBindings,
            cpuUsagePercent: statusRes.cpuUsagePercent,
            memoryUsageMb: statusRes.memoryUsageMb,
            ...(maybeNewKey ? { pairingToken: maybeNewKey } : {}),
          }));
          if (!isRunning) {
            setConnectionStep('enter_key');
          }
        })
        .catch((err) => {
          setConnectionError(
            err instanceof Error ? err.message : 'Failed to toggle Windows host daemon.'
          );
        });
      return;
    }

    setDevice((prev) => {
      const nextStatus = prev.backendServerStatus === 'running' ? 'stopped' : 'running';
      return {
        ...prev,
        backendServerStatus: nextStatus,
        isOnline: nextStatus === 'running',
        tunnelStatus: nextStatus === 'running' ? 'active' : 'idle',
      };
    });
  }, [device.backendServerStatus]);

  // Load or seed persisted offline queue from IndexedDB on startup
  useEffect(() => {
    let mounted = true;
    seedOrListIntents(INITIAL_INTENTS)
      .then((stored) => {
        if (mounted && stored.length > 0) {
          setIntentQueue(stored);
        }
      })
      .catch((err) => {
        console.warn('[RelayContext] Failed to load offline intents from IndexedDB:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Update connection monitor and check for state divergence when device state toggles
  useEffect(() => {
    if (device.isOnline) {
      markConnected();
      detectDivergedIntents(
        activeProject.branch,
        activeProject.lastCommit.hash,
        activeProject.name,
      )
        .then((updated) => {
          if (mountedQueueHasChanges(updated)) {
            setIntentQueue(updated);
          }
        })
        .catch(() => {});
    } else {
      markDisconnected('Host offline');
    }
    function mountedQueueHasChanges(updated: CommandIntent[]) {
      return updated.length > 0;
    }
  }, [device.isOnline, activeProject.branch, activeProject.lastCommit.hash, activeProject.name]);

  // Prompt reconciliation when connected and PC comes online with pending intents
  useEffect(() => {
    if (connectionStep === 'connected' && device.isOnline && intentQueue.filter((i) => i.status === 'queued').length > 0) {
      setReconciliationPromptOpen(true);
    }
  }, [connectionStep, device.isOnline, intentQueue]);

  // Save file content with host persistence and conflict checks
  const saveFileContent = useCallback(
    async (filePath: string, newContent: string) => {
      if (device.isOnline) {
        setFileLoading(true);
        setFileError(null);
        try {
          const writeRes = await getBackendAdapter().fileSystem.writeFile({
            filePath,
            content: newContent,
            expectedVersionHash: fileHashesRef.current[filePath],
          });
          if (writeRes.newHash) {
            fileHashesRef.current[filePath] = writeRes.newHash;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Save failed on host';
          setFileError(msg);
          setFileLoading(false);
          throw err;
        } finally {
          setFileLoading(false);
        }
      }

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== activeProjectId) return p;

          const updateRecursive = (files: ProjectFile[]): ProjectFile[] => {
            return files.map((f) => {
              if (f.path === filePath) {
                return { ...f, content: newContent, gitStatus: 'M', modified: 'Just now' };
              }
              if (f.children) {
                return { ...f, children: updateRecursive(f.children) };
              }
              return f;
            });
          };

          return {
            ...p,
            isDirty: true,
            dirtyCount: p.dirtyCount + 1,
            files: updateRecursive(p.files),
          };
        })
      );

      // Clear unsaved draft so unsaved dot is removed on successful save
      setUnsavedFiles((prev) => {
        if (!prev[filePath]) return prev;
        const copy = { ...prev };
        delete copy[filePath];
        return copy;
      });

      setActiveFile((prev) => (prev ? { ...prev, content: newContent, gitStatus: 'M' } : null));
    },
    [activeProjectId, device.isOnline]
  );

  // Load raw file content from host
  const loadFileContent = useCallback(
    async (filePath: string): Promise<string> => {
      if (device.isOnline) {
        setFileLoading(true);
        setFileError(null);
        try {
          const res = (await getBackendAdapter().fileSystem.readFile({ filePath })) as {
            content: string;
            sizeBytes: number;
            hash?: string;
          };
          if (res.hash) {
            fileHashesRef.current[filePath] = res.hash;
          }
          setProjects((prev) =>
            prev.map((p) => {
              if (p.id !== activeProjectId) return p;
              const updateRecursive = (files: ProjectFile[]): ProjectFile[] =>
                files.map((f) => {
                  if (f.path === filePath) {
                    return {
                      ...f,
                      content: res.content,
                      size: `${(res.sizeBytes / 1024).toFixed(1)} KB`,
                    };
                  }
                  if (f.children) return { ...f, children: updateRecursive(f.children) };
                  return f;
                });
              return { ...p, files: updateRecursive(p.files) };
            })
          );
          setActiveFile((prev) =>
            prev && prev.path === filePath ? { ...prev, content: res.content } : prev
          );
          return res.content;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to read file from host';
          setFileError(msg);
          throw err;
        } finally {
          setFileLoading(false);
        }
      }
      return '';
    },
    [activeProjectId, device.isOnline]
  );

  // Refresh directory files from host
  const refreshFiles = useCallback(
    async (subDir?: string) => {
      if (device.isOnline) {
        setFileLoading(true);
        setFileError(null);
        try {
          const rawItems = await getBackendAdapter().fileSystem.listFiles({
            projectPath: activeProject.path,
            subDirectory: subDir,
          });
          const items: ProjectFile[] = Array.isArray(rawItems) ? rawItems : ((rawItems as any)?.files || []);
          if (items && items.length > 0) {
            setProjects((prev) =>
              prev.map((p) => {
                if (p.id !== activeProjectId) return p;
                if (!subDir) {
                  const existingChildren = new Map(
                    p.files.filter((f) => f.isDir && f.children).map((f) => [f.name, f.children])
                  );
                  const merged = items.map((item) =>
                    item.isDir && existingChildren.has(item.name)
                      ? { ...item, children: existingChildren.get(item.name) }
                      : item
                  );
                  return { ...p, files: merged };
                }
                const segments = subDir.split('/').filter(Boolean);
                const attachChildren = (list: ProjectFile[], depth: number): ProjectFile[] =>
                  list.map((f) => {
                    if (f.isDir && f.name === segments[depth]) {
                      if (depth === segments.length - 1) {
                        return { ...f, children: items };
                      }
                      return { ...f, children: attachChildren(f.children || [], depth + 1) };
                    }
                    return f;
                  });
                return { ...p, files: attachChildren(p.files, 0) };
              })
            );
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to list directory from host';
          setFileError(msg);
        } finally {
          setFileLoading(false);
        }
      }
    },
    [activeProject.path, activeProjectId, device.isOnline]
  );

  // Delete file or folder on host
  const deleteProjectFile = useCallback(
    async (filePath: string) => {
      if (device.isOnline) {
        setFileLoading(true);
        setFileError(null);
        try {
          await getBackendAdapter().fileSystem.deleteFile({ filePath });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to delete file on host';
          setFileError(msg);
          throw err;
        } finally {
          setFileLoading(false);
        }
      }

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== activeProjectId) return p;
          const removeRecursive = (files: ProjectFile[]): ProjectFile[] =>
            files
              .filter((f) => f.path !== filePath && f.name !== filePath)
              .map((f) => (f.children ? { ...f, children: removeRecursive(f.children) } : f));
          return { ...p, files: removeRecursive(p.files) };
        })
      );

      setActiveFile((prev) => (prev?.path === filePath ? null : prev));
    },
    [activeProjectId, device.isOnline]
  );

  // Query live Git status from host
  const refreshGitStatus = useCallback(async () => {
    if (device.isOnline) {
      try {
        const status = await getBackendAdapter().git.getStatus(activeProject.path);
        setGitStatus(status);
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== activeProjectId) return p;
            return {
              ...p,
              branch: status.branch,
              isDirty: status.isDirty,
              dirtyCount: status.dirtyFilesCount,
              ahead: status.ahead,
              behind: status.behind,
              lastCommit: status.lastCommit,
            };
          })
        );
      } catch {
        // Leave previous status intact if host is offline or not git repo
      }
    }
  }, [activeProject.path, activeProjectId, device.isOnline]);

  // Track draft content per file
  const setUnsavedDraft = useCallback((filePath: string, draft: string, originalContent?: string) => {
    setUnsavedFiles((prev) => {
      // If draft matches saved original content, remove from unsavedFiles
      if (originalContent !== undefined && draft === originalContent) {
        if (!prev[filePath]) return prev;
        const copy = { ...prev };
        delete copy[filePath];
        return copy;
      }
      return { ...prev, [filePath]: draft };
    });
  }, []);

  const clearUnsavedDraft = useCallback((filePath: string) => {
    setUnsavedFiles((prev) => {
      if (!prev[filePath]) return prev;
      const copy = { ...prev };
      delete copy[filePath];
      return copy;
    });
  }, []);

  // Create new file in active project
  const createFile = useCallback(
    async (name: string, isTextOnly?: boolean) => {
      const cleanName = isTextOnly && !name.includes('.') ? `${name}.txt` : name;
      let createdContent = isTextOnly ? '# New text document\n' : '// New source file\n';

      if (device.isOnline) {
        setFileLoading(true);
        setFileError(null);
        try {
          const res = await getBackendAdapter().fileSystem.createFile({
            directoryPath: activeProject.path,
            fileName: cleanName,
            isTextOnly,
          });
          if (res.content) createdContent = res.content;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Create file failed on host';
          setFileError(msg);
        } finally {
          setFileLoading(false);
        }
      }

      const newFile: ProjectFile = {
        name: cleanName,
        path: cleanName,
        isDir: false,
        size: '0 B',
        modified: 'Just now',
        gitStatus: 'U',
        content: createdContent,
      };

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== activeProjectId) return p;
          return {
            ...p,
            isDirty: true,
            dirtyCount: p.dirtyCount + 1,
            files: [...p.files, newFile],
          };
        })
      );

      setActiveFile(newFile);
    },
    [activeProjectId, activeProject.path, device.isOnline]
  );

  // Sync live host filesystem and Git status on mount / project switch
  useEffect(() => {
    if (device.isOnline) {
      refreshFiles().catch(() => {});
      refreshGitStatus().catch(() => {});
    }
  }, [device.isOnline, activeProjectId, refreshFiles, refreshGitStatus]);

  // Create new folder in active project
  const createFolder = useCallback(
    async (folderName: string) => {
      const cleanName = folderName.trim();
      if (!cleanName) return;

      if (device.isOnline) {
        setFileLoading(true);
        setFileError(null);
        try {
          const fsService = getBackendAdapter().fileSystem as {
            createFile: (req: { directoryPath: string; fileName: string; isFolder?: boolean }) => Promise<ProjectFile>;
          };
          await fsService.createFile({
            directoryPath: activeProject.path,
            fileName: cleanName,
            isFolder: true,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Create folder failed on host';
          setFileError(msg);
        } finally {
          setFileLoading(false);
        }
      }

      const newFolder: ProjectFile = {
        name: cleanName,
        path: cleanName,
        isDir: true,
        modified: 'Just now',
        children: [],
      };

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== activeProjectId) return p;
          return {
            ...p,
            files: [...p.files, newFolder],
          };
        })
      );
    },
    [activeProjectId, activeProject.path, device.isOnline]
  );

  // Execute terminal command
  const executeCommand = useCallback(
    async (cmd: string) => {
      if (!cmd.trim()) return;

      const trimmedCmd = cmd.trim();
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

      // Add to session history
      setHistory((prev) => {
        const filtered = prev.filter((h) => h !== trimmedCmd);
        return [trimmedCmd, ...filtered];
      });

      // Special handling for 'cls' or 'clear'
      if (trimmedCmd.toLowerCase() === 'cls' || trimmedCmd.toLowerCase() === 'clear') {
        setSessions((prev) =>
          prev.map((s) => (s.id === activeSessionId ? { ...s, buffer: [] } : s))
        );
        return;
      }

      // Add user input line to active session
      const inputLine: TerminalLine = {
        id: `in-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'input',
        content: trimmedCmd,
        timestamp,
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                buffer: [...s.buffer, inputLine],
                isRunning: true,
              }
            : s
        )
      );

      // --- HONEST OFFLINE STATE ---
      // If PC is offline, never claim it executed. Buffer honest intent in SQLite queue!
      if (!device.isOnline) {
        const now = Date.now();
        const existingDup = intentQueue.find(
          (e) =>
            e.command === trimmedCmd &&
            e.projectName === activeProject.name &&
            e.status === 'queued' &&
            Math.abs(now - e.timestamp) < 5000,
        );
        const nextSeq =
          existingDup
            ? existingDup.seq
            : intentQueue.length > 0
            ? Math.max(...intentQueue.map((i) => i.seq)) + 1
            : 1;
        const newIntent: CommandIntent = existingDup ?? {
          id: `intent-${now}-${Math.random().toString(36).substring(2, 8)}`,
          seq: nextSeq,
          command: trimmedCmd,
          workingDir: activeProject.path,
          projectName: activeProject.name,
          timestamp: now,
          status: 'queued',
          causalDependencyHash: `sha256:${Math.random().toString(16).substring(2, 10)}`,
          expectedBaseBranch: activeProject.branch.replace('*', ''),
          expectedHeadCommit: activeProject.lastCommit.hash,
        };

        if (!existingDup) {
          enqueueIntent(newIntent).catch((err) =>
            console.warn('[RelayContext] Failed to persist offline intent:', err)
          );
          setIntentQueue((prev) => [...prev, newIntent]);
        }

        const bufferedLine: TerminalLine = {
          id: `buf-${Date.now()}`,
          type: 'intent_buffered',
          content: `\x1b[33m[OFFLINE INTENT #${String(nextSeq).padStart(2, '0')} BUFFERED]\x1b[0m PC is currently disconnected. Stored in local phone queue. Will reconcile when Windows PC reconnects.`,
          timestamp,
          seq: nextSeq,
          intentId: newIntent.id,
        };

        setTimeout(() => {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    buffer: [...s.buffer, bufferedLine],
                    isRunning: false,
                  }
                : s
            )
          );
        }, 120);
        return;
      }

      // If PC is online: execute on real Windows Host Companion via adapter (or mock fallback)
      const adapter = getBackendAdapter();
      if (!adapter.isMock) {
        try {
          const hostResult = (await adapter.terminal.executeCommand({
            sessionId: activeSessionId,
            command: trimmedCmd,
            workingDir: activeSession.workingDir || activeProject.path,
          })) as Awaited<ReturnType<typeof adapter.terminal.executeCommand>> & {
            workingDir?: string;
          };

          if (hostResult.interceptCliPrompt) {
            setInterceptedCli(hostResult.interceptCliPrompt);
          }

          if (hostResult.workingDir) {
            const newDir = hostResult.workingDir;
            setSessions((prev) =>
              prev.map((s) =>
                s.id === activeSessionId ? { ...s, workingDir: newDir } : s
              )
            );
            setProjects((prev) =>
              prev.map((p) =>
                p.id === activeProjectId ? { ...p, path: newDir } : p
              )
            );
          }

          const outLines: TerminalLine[] = hostResult.lines.map((line, idx) => ({
            id: `out-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            type: line.type,
            content: line.content,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          }));

          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    buffer: [...s.buffer, ...outLines],
                    isRunning: false,
                  }
                : s
            )
          );
          return;
        } catch (err) {
          const errMessage =
            err instanceof Error ? err.message : 'Failed to execute command on Windows host.';
          const errorLine: TerminalLine = {
            id: `err-${Date.now()}`,
            type: 'error',
            content: `[Host Execution Error] ${errMessage}`,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          };
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    buffer: [...s.buffer, errorLine],
                    isRunning: false,
                  }
                : s
            )
          );
          return;
        }
      }

      const result = executeCommandOnDaemon(trimmedCmd, activeProject, installedCliMap);

      if (result.interceptCliPrompt) {
        setInterceptedCli(result.interceptCliPrompt);
      }

      if (result.stateChanges) {
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id === activeProjectId) {
              return {
                ...p,
                ...(result.stateChanges?.branch ? { branch: result.stateChanges.branch } : {}),
                ...(result.stateChanges?.isDirty !== undefined
                  ? {
                      isDirty: result.stateChanges.isDirty,
                      dirtyCount: result.stateChanges.dirtyCount ?? p.dirtyCount,
                    }
                  : {}),
                ...(result.stateChanges?.newCommit
                  ? {
                      lastCommit: result.stateChanges.newCommit,
                      ahead: p.ahead + 1,
                    }
                  : {}),
              };
            }
            return p;
          })
        );
      }

      for (const line of result.lines) {
        await new Promise((resolve) => setTimeout(resolve, line.delay || 60));
        const outLine: TerminalLine = {
          id: `out-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: line.type,
          content: line.content,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        };

        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  buffer: [...s.buffer, outLine],
                }
              : s
          )
        );
      }

      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, isRunning: false } : s))
      );
    },
    [
      activeProjectId,
      activeSessionId,
      activeSession.workingDir,
      activeProject,
      device.isOnline,
      installedCliMap,
      intentQueue,
    ]
  );

  const dismissCliIntercept = () => setInterceptedCli(null);

  // Send signals
  const sendSignal = useCallback(
    (signal: 'SIGINT' | 'SIGTERM' | 'CLEAR') => {
      const adapter = getBackendAdapter();
      if (!adapter.isMock) {
        adapter.terminal
          .sendSignal({ sessionId: activeSessionId, signal })
          .catch(() => {});
      }

      const now = new Date().toLocaleTimeString('en-US', { hour12: false });
      if (signal === 'CLEAR') {
        setSessions((prev) =>
          prev.map((s) => (s.id === activeSessionId ? { ...s, buffer: [] } : s))
        );
        return;
      }

      if (signal === 'SIGINT' || signal === 'SIGTERM') {
        const sigLine: TerminalLine = {
          id: `sig-${Date.now()}`,
          type: 'system',
          content: `^C\n\x1b[31m[${signal}]\x1b[0m Process interrupted by mobile client signal.`,
          timestamp: now,
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, isRunning: false, buffer: [...s.buffer, sigLine] }
              : s
          )
        );
      }
    },
    [activeSessionId]
  );

  // Create session
  const createSession = useCallback((title: string, type: TerminalSession['type']) => {
    const adapter = getBackendAdapter();
    if (!adapter.isMock) {
      adapter.terminal
        .createSession({ title, type, workingDir: activeProject.path })
        .then((created) => {
          setSessions((prev) => [...prev, created]);
          setActiveSessionId(created.id);
        })
        .catch(() => {
          const fallbackId = `sess-${Date.now()}`;
          const newSession: TerminalSession = {
            id: fallbackId,
            title,
            type,
            workingDir: activeProject.path,
            history: [],
            buffer: [],
            isRunning: false,
          };
          setSessions((prev) => [...prev, newSession]);
          setActiveSessionId(fallbackId);
        });
      return;
    }

    const newId = `sess-${Date.now()}`;
    const newSession: TerminalSession = {
      id: newId,
      title,
      type,
      workingDir: activeProject.path,
      history: [],
      buffer: [],
      isRunning: false,
    };
    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newId);
  }, [activeProject.path]);

  // Close session
  const closeSession = useCallback((id: string) => {
    const adapter = getBackendAdapter();
    if (!adapter.isMock) {
      adapter.terminal.closeSession(id).catch(() => {});
    }
    setSessions((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((s) => s.id !== id);
      if (activeSessionId === id && next.length > 0) {
        setActiveSessionId(next[0].id);
      }
      return next;
    });
  }, [activeSessionId]);

  // Add draft intent directly from offline screen
  const addDraftIntent = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    const now = Date.now();
    const existingDup = intentQueue.find(
      (e) =>
        e.command === trimmed &&
        e.projectName === activeProject.name &&
        e.status === 'queued' &&
        Math.abs(now - e.timestamp) < 5000,
    );
    if (existingDup) return;

    const nextSeq =
      intentQueue.length > 0 ? Math.max(...intentQueue.map((i) => i.seq)) + 1 : 1;
    const newIntent: CommandIntent = {
      id: `intent-${now}-${Math.random().toString(36).substring(2, 8)}`,
      seq: nextSeq,
      command: trimmed,
      workingDir: activeProject.path,
      projectName: activeProject.name,
      timestamp: now,
      status: 'queued',
      causalDependencyHash: `sha256:${Math.random().toString(16).substring(2, 10)}`,
      expectedBaseBranch: activeProject.branch.replace('*', ''),
      expectedHeadCommit: activeProject.lastCommit.hash,
    };

    // Persist to IndexedDB offline queue with matching id & seq
    enqueueIntent(newIntent).catch((err) =>
      console.warn('[RelayContext] Failed to persist draft intent:', err)
    );

    setIntentQueue((prev) => [...prev, newIntent]);
  }, [activeProject, intentQueue]);

  // Scan PC Repositories
  const scanPcRepositories = useCallback(async () => {
    setIsScanningPc(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsScanningPc(false);
  }, []);

  // Install CLI Tool
  const installCliTool = useCallback(async (cliId: string) => {
    setCliTools((prev) =>
      prev.map((t) => (t.id === cliId ? { ...t, status: 'running' } : t))
    );
    await new Promise((r) => setTimeout(r, 1400));
    setCliTools((prev) =>
      prev.map((t) => (t.id === cliId ? { ...t, status: 'installed', version: 'v1.1.0' } : t))
    );
  }, []);

  // Reconcile single intent
  const reconcileSingleIntent = useCallback(
    async (id: string, action: 'run' | 'skip' | 'cancel') => {
      const intent = intentQueue.find((i) => i.id === id);
      if (!intent) return;

      if (action === 'cancel') {
        deleteStoredIntent(id).catch(() => {});
        setIntentQueue((prev) => prev.filter((i) => i.id !== id));
        return;
      }

      if (action === 'skip') {
        updateIntentStatus(id, 'skipped').catch(() => {});
        setIntentQueue((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: 'skipped' } : i))
        );
        return;
      }

      // Mark executing
      updateIntentStatus(id, 'executing').catch(() => {});
      setIntentQueue((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: 'executing' } : i))
      );

      await new Promise((r) => setTimeout(r, 700));

      const res = executeCommandOnDaemon(intent.command, activeProject, installedCliMap);
      const outText = res.lines.map((l) => l.content).join('\n');

      updateIntentStatus(id, 'reconciled', {
        resultOutput: outText,
        executionDurationMs: 420,
      }).catch(() => {});

      setIntentQueue((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'reconciled',
                resultOutput: outText,
                executionDurationMs: 420,
              }
            : i
        )
      );
    },
    [activeProject, installedCliMap, intentQueue]
  );

  // Reconcile all intents
  const reconcileAllIntents = useCallback(
    async (_forceRun?: boolean) => {
      setDevice((prev) => ({ ...prev, isReconciling: true }));
      try {
        const pending = intentQueue.filter((i) => i.status === 'queued' || i.status === 'diverged');
        for (const intent of pending) {
          await reconcileSingleIntent(intent.id, 'run');
        }
        setReconciliationPromptOpen(false);
      } finally {
        setDevice((prev) => ({ ...prev, isReconciling: false }));
      }
    },
    [intentQueue, reconcileSingleIntent]
  );

  const clearIntentQueue = useCallback(() => {
    clearAllStoredIntents().catch(() => {});
    setIntentQueue([]);
  }, []);

  const deleteIntent = useCallback((id: string) => {
    deleteStoredIntent(id).catch(() => {});
    setIntentQueue((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return (
    <RelayContext.Provider
      value={{
        activeFrontend,
        setActiveFrontend,
        currentUser,
        setCurrentUser,
        connectionStep,
        setConnectionStep,
        connectionError,
        setConnectionError,
        generatedConnectionKey,
        regenerateConnectionKey,
        loginUser,
        connectWithKey,
        disconnectMobile,
        mobileNav,
        setMobileNav,
        isDrawerOpen,
        setIsDrawerOpen,
        device,
        setDevice,
        togglePcOnline,
        toggleBackendServer,
        projects,
        activeProjectId,
        setActiveProjectId,
        activeProject,
        activeFile,
        setActiveFile,
        saveFileContent,
        createFile,
        createFolder,
        unsavedFiles,
        setUnsavedDraft,
        clearUnsavedDraft,
        fileModal,
        setFileModal,
        fileLoading,
        fileError,
        clearFileError,
        loadFileContent,
        refreshFiles,
        deleteProjectFile,
        gitStatus,
        refreshGitStatus,
        sessions,
        activeSessionId,
        setActiveSessionId,
        activeSession,
        createSession,
        closeSession,
        executeCommand,
        sendSignal,
        history,
        cliTools,
        installCliTool,
        devServers,
        isScanningPc,
        scanPcRepositories,
        intentQueue,
        addDraftIntent,
        reconcileSingleIntent,
        reconcileAllIntents,
        clearIntentQueue,
        deleteIntent,
        reconciliationPromptOpen,
        setReconciliationPromptOpen,
        fontSize,
        setFontSize,
        scanlineEffect,
        setScanlineEffect,
        interceptedCli,
        dismissCliIntercept,
      }}
    >
      {children}
    </RelayContext.Provider>
  );
}

export function useRelay() {
  const ctx = useContext(RelayContext);
  if (!ctx) throw new Error('useRelay must be used within RelayProvider');
  return ctx;
}
