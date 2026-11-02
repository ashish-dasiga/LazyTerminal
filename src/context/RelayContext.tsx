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
import { getBackendAdapter, getSessionToken, setSessionToken, ApiError } from '../services';
import {
  GitStatusResponse,
  WorkspaceBrowseResponse,
  WorkspaceInfo,
} from '../services/contracts';
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
  username: 'local.developer',
  email: 'local@windows-host.lan',
  avatarUrl: '',
  accountTier: 'Personal',
  isLoggedIn: true,
  tokenExpiresAt: 'Session-scoped',
};

const DEMO_SEED_INTENT_IDS = new Set(['intent-101', 'intent-102', 'intent-103']);

const REAL_PLACEHOLDER_PROJECT: Project = {
  id: 'host-workspace',
  name: 'Workspace',
  path: '',
  isGitRepo: false,
  exists: true,
  accessible: true,
  branch: 'local',
  isDirty: false,
  dirtyCount: 0,
  ahead: 0,
  behind: 0,
  lastCommit: {
    hash: '—',
    message: 'Select or connect to a Windows PC folder',
    author: '',
    time: '',
  },
  pinned: true,
  files: [],
};

const REAL_INITIAL_SESSIONS: TerminalSession[] = [
  {
    id: 'sess-pwsh',
    title: 'PowerShell',
    type: 'powershell',
    workingDir: '',
    history: [],
    isRunning: false,
    buffer: [],
  },
];

const REAL_INITIAL_CLI_TOOLS: AiCliTool[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    cliName: 'claude',
    description: 'Anthropic agentic CLI for codebase navigation, editing, and tool execution on Windows PC.',
    vendor: 'Anthropic PBC',
    status: 'unavailable',
    version: 'Not checked',
    installCommand: 'npm install -g @anthropic-ai/claude-code',
    installScope: 'Windows Host PATH / %USERPROFILE%\\.local\\bin',
    runCommand: 'claude',
    permissionsRequired: ['Native Shell Execution', 'File System Read/Write', 'Child Process Spawning'],
    capabilities: ['Multi-turn sessions', 'Codebase reasoning', 'File edits'],
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    cliName: 'gemini',
    description: 'Google Gemini workspace reasoning CLI running directly on your Windows PC.',
    vendor: 'Google LLC',
    status: 'unavailable',
    version: 'Not checked',
    installCommand: 'npm install -g @google/gemini-cli',
    installScope: 'Global Windows Node.js (%APPDATA%\\npm)',
    runCommand: 'gemini',
    permissionsRequired: ['Native Shell Execution', 'File System Read/Write'],
    capabilities: ['Multi-turn sessions', 'Code reasoning', 'Repo search'],
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    cliName: 'codex',
    description: 'OpenAI Codex terminal coding agent running on your Windows PC.',
    vendor: 'OpenAI Inc.',
    status: 'unavailable',
    version: 'Not checked',
    installCommand: 'npm install -g @openai/codex',
    installScope: 'Global Windows Node.js (%APPDATA%\\npm)',
    runCommand: 'codex',
    permissionsRequired: ['Native Shell Execution', 'File System Read/Write'],
    capabilities: ['Non-interactive exec', 'Session resume', 'Code edits'],
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    cliName: 'agy',
    description: 'Google Antigravity CLI on Windows PC.',
    vendor: 'Google LLC',
    status: 'unavailable',
    version: 'Not checked',
    installCommand: 'agy --version',
    installScope: 'Windows Host (%LOCALAPPDATA%\\agy\\bin)',
    runCommand: 'agy',
    permissionsRequired: ['Workspace Access', 'Agent Prompt Execution'],
    capabilities: ['Print mode (-p)', 'JSON streaming', 'Continue session (-c)'],
  },
];

// Mock-only fixtures retained strictly for explicitVITE_ADAPTER_MODE=mock unit tests
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
        name: 'README.md',
        path: 'README.md',
        isDir: false,
        size: '4.8 KB',
        modified: '10/11/2026 14:02',
        gitStatus: 'clean',
        content: '# Hyper Relay Mock Fixture\n',
      },
    ],
  },
];

const INITIAL_SESSIONS: TerminalSession[] = [
  {
    id: 'sess-pwsh',
    title: 'PowerShell 7.4 (Mock)',
    type: 'powershell',
    workingDir: 'C:\\Projects\\hyper-relay',
    history: [],
    isRunning: false,
    buffer: [],
  },
];

const INITIAL_INTENTS: CommandIntent[] = [
  {
    id: 'intent-101',
    seq: 1,
    command: 'git status',
    workingDir: 'C:\\Projects\\hyper-relay',
    projectName: 'hyper-relay',
    timestamp: Date.now() - 1000 * 60 * 18,
    status: 'queued',
    causalDependencyHash: 'sha256:8f2a1b9',
    expectedBaseBranch: 'main',
    expectedHeadCommit: '3f7a8b1',
  },
];

export function workspaceInfoToProject(
  ws: WorkspaceInfo,
  existingFiles: ProjectFile[] = [],
): Project {
  return {
    id: ws.id,
    name: ws.name,
    path: ws.path,
    isGitRepo: ws.isGitRepo,
    exists: ws.exists,
    accessible: ws.accessible,
    branch: ws.isGitRepo ? ws.branch || 'HEAD' : 'local',
    isDirty: (ws.dirtyFiles ?? 0) > 0,
    dirtyCount: ws.dirtyFiles ?? 0,
    ahead: 0,
    behind: 0,
    lastCommit: {
      hash: ws.lastCommitHash || (ws.isGitRepo ? 'HEAD' : '—'),
      message:
        ws.lastCommitMsg ||
        (ws.isGitRepo ? 'Git repository synced' : 'Local Windows folder (non-Git)'),
      author: '',
      time: ws.lastSyncedAt
        ? new Date(ws.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Live',
    },
    pinned: true,
    files: existingFiles,
  };
}

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
  isWorkspacePickerOpen: boolean;
  setIsWorkspacePickerOpen: (open: boolean) => void;

  // Device & Host PC State
  device: DeviceInfo;
  setDevice: React.Dispatch<React.SetStateAction<DeviceInfo>>;
  togglePcOnline: () => void;
  toggleBackendServer: () => void;

  // Projects, Dynamic Windows Workspaces & Files
  projects: Project[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  selectWorkspacePath: (folderPath: string) => Promise<Project>;
  browseHostFolders: (dirPath?: string) => Promise<WorkspaceBrowseResponse>;
  pickNativeHostFolder: () => Promise<Project | null>;
  activeProject: Project;
  activeFile: ProjectFile | null;
  setActiveFile: (file: ProjectFile | null) => void;
  saveFileContent: (path: string, newContent: string) => Promise<void>;
  createFile: (name: string, isTextOnly?: boolean, subDir?: string) => Promise<void>;
  createFolder: (name: string, subDir?: string) => Promise<void>;
  renameProjectFile: (oldPath: string, newName: string, subDir?: string) => Promise<void>;
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
  deleteProjectFile: (filePath: string, subDir?: string) => Promise<void>;
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
  refreshCliTools: () => Promise<void>;
  installCliTool: (id: string) => Promise<void>;
  devServers: DevServer[];
  refreshDevServers: () => Promise<void>;
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
    if (window.location.protocol === 'file:') {
      return 'mobile';
    }
  }
  return 'portal';
}

export function RelayProvider({ children }: { children: ReactNode }) {
  const isMockOnInit = getBackendAdapter().isMock;

  const [activeFrontend, setActiveFrontend] = useState<'portal' | 'mobile' | 'laptop'>(getInitialFrontend);
  const [currentUser, setCurrentUser] = useState<UserAccount>(DEFAULT_USER);
  const [connectionStep, setConnectionStep] = useState<MobileConnectionStep>('enter_key');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [generatedConnectionKey, setGeneratedConnectionKey] = useState<string>('');

  // Mobile drawer & navigation
  const [mobileNav, setMobileNav] = useState<MobileNavSection>('terminal');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isWorkspacePickerOpen, setIsWorkspacePickerOpen] = useState(false);

  // Host PC & backend
  const [device, setDevice] = useState<DeviceInfo>(() =>
    isMockOnInit
      ? {
          isOnline: true,
          deviceName: 'MOCK-HOST',
          os: 'Windows (Mock)',
          ip: '127.0.0.1',
          port: 9871,
          daemonVersion: 'mock',
          pingMs: 1,
          pairedAt: 'Mock Session',
          ed25519Fingerprint: 'mock',
          pairingToken: '',
          sqliteDbSizeKb: 0,
          backendServerStatus: 'running',
          tunnelStatus: 'idle',
          totalIntentsProcessed: 0,
          cpuUsagePercent: 0,
          memoryUsageMb: 0,
          activePortBindings: [9871],
        }
      : {
          isOnline: false,
          deviceName: 'Windows PC Host',
          os: 'Windows',
          ip: '127.0.0.1',
          port: 9871,
          daemonVersion: 'v1.0.0',
          pingMs: 0,
          pairedAt: 'Not paired',
          ed25519Fingerprint: '',
          pairingToken: '',
          sqliteDbSizeKb: 0,
          backendServerStatus: 'stopped',
          tunnelStatus: 'idle',
          totalIntentsProcessed: 0,
          cpuUsagePercent: 0,
          memoryUsageMb: 0,
          activePortBindings: [],
        },
  );

  const [projects, setProjects] = useState<Project[]>(() =>
    isMockOnInit ? INITIAL_PROJECTS : [REAL_PLACEHOLDER_PROJECT],
  );
  const [activeProjectId, setActiveProjectIdState] = useState<string>(() =>
    isMockOnInit ? 'hyper-relay' : REAL_PLACEHOLDER_PROJECT.id,
  );
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [unsavedFiles, setUnsavedFiles] = useState<Record<string, string>>({});
  const [fileModal, setFileModal] = useState<'none' | 'new_file' | 'new_folder' | 'open_with' | 'no_file_selected'>('none');

  const [sessions, setSessions] = useState<TerminalSession[]>(() =>
    isMockOnInit ? INITIAL_SESSIONS : REAL_INITIAL_SESSIONS,
  );
  const [activeSessionId, setActiveSessionId] = useState<string>('sess-pwsh');

  const [cliTools, setCliTools] = useState<AiCliTool[]>(REAL_INITIAL_CLI_TOOLS);
  const [devServers, setDevServers] = useState<DevServer[]>([]);
  const [intentQueue, setIntentQueue] = useState<CommandIntent[]>(() =>
    isMockOnInit ? INITIAL_INTENTS : [],
  );
  const [history, setHistory] = useState<string[]>([]);

  const [isScanningPc, setIsScanningPc] = useState(false);
  const [reconciliationPromptOpen, setReconciliationPromptOpen] = useState(false);
  const [fontSize, setFontSize] = useState<number>(13);
  const [scanlineEffect, setScanlineEffect] = useState(false);
  const [interceptedCli, setInterceptedCli] = useState<{
    toolName: string;
    cliName: string;
    installCommand: string;
  } | null>(null);

  // Live Filesystem & Git State
  const [fileLoading, setFileLoading] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatusResponse | null>(null);
  const fileHashesRef = useRef<Record<string, string>>({});
  const clearFileError = useCallback(() => setFileError(null), []);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || REAL_PLACEHOLDER_PROJECT;
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || REAL_INITIAL_SESSIONS[0];

  // Helper map for installed CLIs
  const installedCliMap = cliTools.reduce<Record<string, boolean>>((acc, tool) => {
    acc[tool.cliName] = tool.status === 'installed' || tool.status === 'running';
    return acc;
  }, {});

  const refreshCliTools = useCallback(async () => {
    const adapter = getBackendAdapter();
    if (adapter.isMock) return;
    try {
      const tools = await adapter.cli.listTools();
      if (Array.isArray(tools) && tools.length > 0) {
        setCliTools(tools);
      }
    } catch {
      // Keep honest fallback status when unauthenticated or offline
    }
  }, []);

  const refreshDevServers = useCallback(async () => {
    const adapter = getBackendAdapter();
    if (adapter.isMock) return;
    try {
      const servers = await adapter.preview.listDevServers();
      if (Array.isArray(servers)) {
        setDevServers(servers);
      }
    } catch {
      setDevServers([]);
    }
  }, []);

  // Hydrate workspaces, persistent terminal sessions, CLI tools, and dev servers once authenticated
  const syncConnectedHostState = useCallback(async () => {
    const adapter = getBackendAdapter();
    if (adapter.isMock) return;

    let resolvedWorkspacePath = '';
    if (adapter.workspace) {
      try {
        const wsState = await adapter.workspace.getState();
        const combined: WorkspaceInfo[] = [];
        if (wsState.activeWorkspace) {
          combined.push(wsState.activeWorkspace);
          resolvedWorkspacePath = wsState.activeWorkspace.path;
        }
        for (const rw of wsState.recentWorkspaces || []) {
          if (!combined.some((item) => item.path.toLowerCase() === rw.path.toLowerCase())) {
            combined.push(rw);
          }
        }
        if (combined.length > 0) {
          setProjects((prev) => {
            const existingByPath = new Map(prev.map((p) => [p.path.toLowerCase(), p.files]));
            return combined.map((ws) =>
              workspaceInfoToProject(ws, existingByPath.get(ws.path.toLowerCase()) || []),
            );
          });
          if (wsState.activeWorkspace) {
            setActiveProjectIdState(wsState.activeWorkspace.id);
          } else {
            setActiveProjectIdState(combined[0].id);
          }
        }
      } catch (err) {
        console.warn('[RelayContext] Failed to load workspace state from host:', err);
      }
    }

    try {
      const hostSessions = await adapter.terminal.listSessions();
      if (hostSessions.length > 0) {
        setSessions(hostSessions);
        setActiveSessionId((prev) =>
          hostSessions.some((s) => s.id === prev) ? prev : hostSessions[0].id,
        );
      } else {
        const created = await adapter.terminal.createSession({
          title: 'PowerShell',
          type: 'powershell',
          workingDir: resolvedWorkspacePath || undefined,
        });
        setSessions([created]);
        setActiveSessionId(created.id);
      }
    } catch (err) {
      console.warn('[RelayContext] Failed to initialize host terminal sessions:', err);
    }

    refreshCliTools().catch(() => {});
    refreshDevServers().catch(() => {});
  }, [refreshCliTools, refreshDevServers]);

  // Sync initial pairing key & restore valid session token on startup
  useEffect(() => {
    let cancelled = false;
    const initHostConnection = async () => {
      const adapter = getBackendAdapter();
      const conn = adapter.connection as {
        fetchActiveHostKey?: () => Promise<{ pairingKey: string; expiresInSeconds: number }>;
      };

      // 1. Fetch active pairing key if viewing from PC companion / local portal
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
          if (!cancelled && !adapter.isMock) {
            setDevice((prev) => ({
              ...prev,
              isOnline: false,
              backendServerStatus: 'stopped',
              tunnelStatus: 'idle',
            }));
          }
        }
      }

      // 2. If a session token exists in sessionStorage, verify it against the real host
      if (!adapter.isMock && getSessionToken()) {
        try {
          const hostInfo = await adapter.connection.getHostDeviceInfo();
          if (!cancelled) {
            setDevice((prev) => ({
              ...prev,
              ...hostInfo,
              isOnline: true,
              backendServerStatus: 'running',
              tunnelStatus: 'active',
            }));
            setConnectionStep('connected');
            await syncConnectedHostState();
          }
        } catch (err) {
          if (!cancelled) {
            if (err instanceof ApiError && err.status === 401) {
              setSessionToken(null);
              setConnectionStep('enter_key');
            } else {
              setDevice((prev) => ({
                ...prev,
                isOnline: false,
                backendServerStatus: 'stopped',
                tunnelStatus: 'idle',
              }));
            }
          }
        }
      }
    };
    initHostConnection();
    return () => {
      cancelled = true;
    };
  }, [syncConnectedHostState]);

  // Regenerate random connection key for Windows PC
  const regenerateConnectionKey = useCallback(() => {
    const adapter = getBackendAdapter();
    const conn = adapter.connection as {
      generateHostKey?: () => Promise<{ pairingKey: string }>;
    };
    if (conn && typeof conn.generateHostKey === 'function') {
      conn
        .generateHostKey()
        .then((res) => {
          if (res?.pairingKey) {
            setGeneratedConnectionKey(res.pairingKey);
            setDevice((prev) => ({ ...prev, pairingToken: res.pairingKey }));
          }
        })
        .catch((err: unknown) => {
          setConnectionError(
            err instanceof Error ? err.message : 'Failed to regenerate key on Windows host.',
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
    setCurrentUser((prev) => ({
      ...prev,
      email: email || prev.email,
      username: email ? email.split('@')[0] : prev.username,
      isLoggedIn: true,
    }));
    return true;
  }, []);

  // Connect with random key
  const connectWithKey = useCallback(
    async (key: string) => {
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
            await syncConnectedHostState();
            return true;
          }
          setConnectionStep('enter_key');
          setConnectionError(
            res.errorMessage ||
              `Incorrect token number "${key}". Please check the current 6-digit key displayed on your Windows PC.`,
          );
          return false;
        } catch (err) {
          setConnectionStep('enter_key');
          const rawMsg = err instanceof Error ? err.message : String(err);
          const cleanMsg =
            rawMsg.toLowerCase().includes('<!doctype') ||
            rawMsg.toLowerCase().includes('<html')
              ? 'Unable to connect to Windows PC companion. Ensure Lazy Terminal companion is running on your PC and both devices are on the same Wi-Fi.'
              : rawMsg;
          setConnectionError(cleanMsg);
          return false;
        }
      }

      const normalizedInput = key.replace(/[\s-]/g, '').toLowerCase();
      const normalizedTarget = generatedConnectionKey.replace(/[\s-]/g, '').toLowerCase();

      if (normalizedInput === normalizedTarget) {
        setConnectionStep('connected');
        setMobileNav('terminal');
        return true;
      } else {
        setConnectionStep('enter_key');
        setConnectionError(
          `Incorrect pairing code "${key}". Please enter the 6-digit code shown on your Windows companion app.`,
        );
        return false;
      }
    },
    [generatedConnectionKey, syncConnectedHostState],
  );

  // Disconnect mobile
  const disconnectMobile = useCallback(() => {
    const adapter = getBackendAdapter();
    if (!adapter.isMock) {
      adapter.connection.disconnectHost().catch(() => {});
    }
    setSessionToken(null);
    setConnectionStep('enter_key');
    setConnectionError(null);
    setDevice((prev) => ({
      ...prev,
      tunnelStatus: 'idle',
    }));
  }, []);

  // Select any real Windows folder path as the active workspace
  const selectWorkspacePath = useCallback(async (folderPath: string): Promise<Project> => {
    const trimmed = folderPath.trim();
    if (!trimmed) {
      throw new Error('Please enter or select a Windows folder path.');
    }

    const adapter = getBackendAdapter();
    if (!adapter.isMock && adapter.workspace) {
      const res = await adapter.workspace.selectWorkspace(trimmed);
      const selectedProj = workspaceInfoToProject(res.workspace, []);
      const combined: WorkspaceInfo[] = [res.workspace];
      for (const rw of res.recentWorkspaces || []) {
        if (!combined.some((w) => w.path.toLowerCase() === rw.path.toLowerCase())) {
          combined.push(rw);
        }
      }

      setProjects((prev) => {
        const existingByPath = new Map(prev.map((p) => [p.path.toLowerCase(), p.files]));
        return combined.map((ws) =>
          workspaceInfoToProject(
            ws,
            ws.path.toLowerCase() === res.workspace.path.toLowerCase()
              ? []
              : existingByPath.get(ws.path.toLowerCase()) || [],
          ),
        );
      });
      setActiveProjectIdState(selectedProj.id);
      setActiveFile(null);
      setFileError(null);
      setGitStatus(null);
      return selectedProj;
    }

    const found = projects.find(
      (p) => p.path.toLowerCase() === trimmed.toLowerCase() || p.id === trimmed,
    );
    if (found) {
      setActiveProjectIdState(found.id);
      setActiveFile(null);
      return found;
    }

    const customProj: Project = {
      id: `ws-${Date.now()}`,
      name: trimmed.split(/[\\/]/).filter(Boolean).pop() || trimmed,
      path: trimmed,
      isGitRepo: false,
      exists: true,
      accessible: true,
      branch: 'local',
      isDirty: false,
      dirtyCount: 0,
      ahead: 0,
      behind: 0,
      lastCommit: { hash: '—', message: 'Local folder', author: '', time: 'Now' },
      pinned: true,
      files: [],
    };
    setProjects((prev) => [customProj, ...prev]);
    setActiveProjectIdState(customProj.id);
    setActiveFile(null);
    return customProj;
  }, [projects]);

  const setActiveProjectId = useCallback(
    (id: string) => {
      const target = projects.find((p) => p.id === id);
      const adapter = getBackendAdapter();
      if (target && !adapter.isMock && adapter.workspace && device.isOnline && target.path) {
        selectWorkspacePath(target.path).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Selected workspace is inaccessible on host.';
          setFileError(msg);
          setProjects((prev) =>
            prev.map((p) => (p.id === id ? { ...p, exists: false, accessible: false } : p)),
          );
        });
        return;
      }
      setActiveProjectIdState(id);
      setActiveFile(null);
      setFileError(null);
    },
    [device.isOnline, projects, selectWorkspacePath],
  );

  const browseHostFolders = useCallback(async (dirPath?: string): Promise<WorkspaceBrowseResponse> => {
    const adapter = getBackendAdapter();
    if (!adapter.isMock && adapter.workspace) {
      return adapter.workspace.browse(dirPath);
    }
    return {
      currentPath: dirPath || null,
      parentPath: null,
      drives: ['C:\\'],
      entries: [],
    };
  }, []);

  const pickNativeHostFolder = useCallback(async (): Promise<Project | null> => {
    const adapter = getBackendAdapter();
    if (!adapter.isMock && adapter.workspace) {
      const res = await adapter.workspace.pickNativeFolder(activeProject.path || undefined);
      if (res.cancelled || !res.workspace) {
        return null;
      }
      return selectWorkspacePath(res.workspace.path);
    }
    return null;
  }, [activeProject.path, selectWorkspacePath]);

  // Toggle PC Online / Offline (client-side offline queue mode toggle)
  const togglePcOnline = useCallback(() => {
    const adapter = getBackendAdapter();
    if (!device.isOnline && !adapter.isMock) {
      adapter.connection
        .getHostDeviceInfo()
        .then((hostInfo) => {
          setDevice((prev) => ({
            ...prev,
            ...hostInfo,
            isOnline: true,
            backendServerStatus: 'running',
            tunnelStatus: 'active',
          }));
        })
        .catch(() => {
          setDevice((prev) => ({
            ...prev,
            isOnline: false,
            pingMs: 0,
            tunnelStatus: 'idle',
          }));
        });
      return;
    }

    setDevice((prev) => {
      const willBeOnline = !prev.isOnline;
      return {
        ...prev,
        isOnline: willBeOnline,
        pingMs: willBeOnline ? prev.pingMs || 4 : 0,
        tunnelStatus: willBeOnline ? 'active' : 'idle',
      };
    });
  }, [device.isOnline]);

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
            err instanceof Error ? err.message : 'Failed to toggle Windows host daemon.',
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

  // Load persisted offline queue from IndexedDB on startup (without fake demo seeds in real mode)
  useEffect(() => {
    let mounted = true;
    const isMock = getBackendAdapter().isMock;
    seedOrListIntents(isMock ? INITIAL_INTENTS : [])
      .then(async (stored) => {
        if (!mounted) return;
        if (!isMock) {
          const realStored: CommandIntent[] = [];
          for (const item of stored) {
            if (DEMO_SEED_INTENT_IDS.has(item.id)) {
              await deleteStoredIntent(item.id).catch(() => {});
            } else {
              realStored.push(item);
            }
          }
          setIntentQueue(realStored);
        } else if (stored.length > 0) {
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
      if (activeProject.path) {
        detectDivergedIntents(
          activeProject.branch,
          activeProject.lastCommit.hash,
          activeProject.name,
        )
          .then((updated) => {
            if (updated.length > 0) {
              const isMock = getBackendAdapter().isMock;
              setIntentQueue(
                isMock ? updated : updated.filter((i) => !DEMO_SEED_INTENT_IDS.has(i.id)),
              );
            }
          })
          .catch(() => {});
      }
    } else {
      markDisconnected('Host offline');
    }
  }, [device.isOnline, activeProject.branch, activeProject.lastCommit.hash, activeProject.name, activeProject.path]);

  // Prompt reconciliation when connected and PC comes online with genuinely queued intents
  useEffect(() => {
    if (
      connectionStep === 'connected' &&
      device.isOnline &&
      intentQueue.filter((i) => i.status === 'queued').length > 0
    ) {
      setReconciliationPromptOpen(true);
    }
  }, [connectionStep, device.isOnline, intentQueue]);

  // Query live Git status from host
  const refreshGitStatus = useCallback(async () => {
    if (!device.isOnline || !activeProject.path) return;
    const adapter = getBackendAdapter();
    if (!adapter.isMock && !getSessionToken()) return;

    try {
      const status = await adapter.git.getStatus(activeProject.path);
      setGitStatus(status);
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== activeProjectId) return p;
          return {
            ...p,
            isGitRepo: status.isGitRepo !== false,
            branch: status.isGitRepo === false ? 'local' : status.branch,
            isDirty: status.isDirty,
            dirtyCount: status.dirtyFilesCount,
            ahead: status.ahead,
            behind: status.behind,
            lastCommit: status.lastCommit,
          };
        }),
      );
    } catch {
      // Leave previous status intact on transient errors
    }
  }, [activeProject.path, activeProjectId, device.isOnline]);

  // Refresh directory files from host (including empty folders!)
  const refreshFiles = useCallback(
    async (subDir?: string) => {
      if (!device.isOnline || !activeProject.path) return;
      const adapter = getBackendAdapter();
      if (!adapter.isMock && !getSessionToken()) return;

      setFileLoading(true);
      setFileError(null);
      try {
        const rawItems = await adapter.fileSystem.listFiles({
          projectPath: activeProject.path,
          subDirectory: subDir,
        });
        const items: ProjectFile[] = Array.isArray(rawItems)
          ? rawItems
          : ((rawItems as { files?: ProjectFile[] })?.files || []);

        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== activeProjectId) return p;
            if (!subDir) {
              const existingChildren = new Map(
                p.files.filter((f) => f.isDir && f.children).map((f) => [f.name, f.children]),
              );
              const merged = items.map((item) =>
                item.isDir && existingChildren.has(item.name)
                  ? { ...item, children: existingChildren.get(item.name) }
                  : item,
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
          }),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to list directory from host';
        setFileError(msg);
      } finally {
        setFileLoading(false);
      }
    },
    [activeProject.path, activeProjectId, device.isOnline],
  );

  // Save file content with host persistence and conflict checks
  const saveFileContent = useCallback(
    async (filePath: string, newContent: string) => {
      const adapter = getBackendAdapter();
      if (!adapter.isMock && !device.isOnline) {
        const msg = 'Cannot save file while Windows PC host is disconnected.';
        setFileError(msg);
        throw new Error(msg);
      }

      if (device.isOnline) {
        setFileLoading(true);
        setFileError(null);
        try {
          const writeRes = await adapter.fileSystem.writeFile({
            filePath,
            projectPath: activeProject.path,
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

          const updateRecursive = (files: ProjectFile[]): ProjectFile[] =>
            files.map((f) => {
              if (f.path === filePath) {
                return { ...f, content: newContent, gitStatus: 'M', modified: 'Just now' };
              }
              if (f.children) {
                return { ...f, children: updateRecursive(f.children) };
              }
              return f;
            });

          return {
            ...p,
            files: updateRecursive(p.files),
          };
        }),
      );

      setUnsavedFiles((prev) => {
        if (!prev[filePath]) return prev;
        const copy = { ...prev };
        delete copy[filePath];
        return copy;
      });

      setActiveFile((prev) => (prev ? { ...prev, content: newContent, gitStatus: 'M' } : null));
      refreshGitStatus().catch(() => {});
    },
    [activeProject.path, activeProjectId, device.isOnline, refreshGitStatus],
  );

  // Load raw file content from host
  const loadFileContent = useCallback(
    async (filePath: string): Promise<string> => {
      const adapter = getBackendAdapter();
      if (!adapter.isMock && !device.isOnline) {
        const msg = 'Cannot read file while Windows PC host is disconnected.';
        setFileError(msg);
        throw new Error(msg);
      }

      if (device.isOnline) {
        setFileLoading(true);
        setFileError(null);
        try {
          const res = await adapter.fileSystem.readFile({
            filePath,
            projectPath: activeProject.path,
          });
          if (res.hash) {
            fileHashesRef.current[filePath] = res.hash;
          }
          const sizeBytes = res.sizeBytes ?? res.size ?? Buffer.byteLength?.(res.content || '') ?? 0;
          setProjects((prev) =>
            prev.map((p) => {
              if (p.id !== activeProjectId) return p;
              const updateRecursive = (files: ProjectFile[]): ProjectFile[] =>
                files.map((f) => {
                  if (f.path === filePath) {
                    return {
                      ...f,
                      content: res.content,
                      size:
                        sizeBytes < 1024
                          ? `${sizeBytes} B`
                          : `${(sizeBytes / 1024).toFixed(1)} KB`,
                    };
                  }
                  if (f.children) return { ...f, children: updateRecursive(f.children) };
                  return f;
                });
              return { ...p, files: updateRecursive(p.files) };
            }),
          );
          setActiveFile((prev) =>
            prev && prev.path === filePath ? { ...prev, content: res.content } : prev,
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
    [activeProject.path, activeProjectId, device.isOnline],
  );

  // Create new file in active project (or Explorer subdirectory)
  const createFile = useCallback(
    async (name: string, isTextOnly?: boolean, subDir?: string) => {
      const cleanName = isTextOnly && !name.includes('.') ? `${name}.txt` : name.trim();
      if (!cleanName) return;

      const adapter = getBackendAdapter();
      if (!adapter.isMock && !device.isOnline) {
        setFileError('Cannot create file while Windows PC host is disconnected.');
        return;
      }

      let createdFile: ProjectFile | null = null;
      const targetDir = subDir
        ? `${activeProject.path.replace(/[\\/]+$/, '')}\\${subDir.replace(/\//g, '\\')}`
        : activeProject.path;

      if (device.isOnline) {
        setFileLoading(true);
        setFileError(null);
        try {
          createdFile = await adapter.fileSystem.createFile({
            directoryPath: targetDir,
            projectPath: activeProject.path,
            fileName: cleanName,
            isTextOnly,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Create file failed on host';
          setFileError(msg);
          setFileLoading(false);
          return;
        } finally {
          setFileLoading(false);
        }
      }

      const relPath = createdFile?.path || (subDir ? `${subDir}/${cleanName}` : cleanName);
      const newFile: ProjectFile = {
        name: createdFile?.name || cleanName,
        path: relPath,
        isDir: false,
        size: createdFile?.size || '0 B',
        modified: createdFile?.modified || 'Just now',
        gitStatus: 'U',
        content: createdFile?.content ?? '',
      };

      if (device.isOnline && !adapter.isMock) {
        await refreshFiles(subDir);
        refreshGitStatus().catch(() => {});
      } else {
        setProjects((prev) =>
          prev.map((p) => (p.id === activeProjectId ? { ...p, files: [...p.files, newFile] } : p)),
        );
      }

      setActiveFile(newFile);
    },
    [activeProject.path, activeProjectId, device.isOnline, refreshFiles, refreshGitStatus],
  );

  // Create new folder in active project (or Explorer subdirectory)
  const createFolder = useCallback(
    async (folderName: string, subDir?: string) => {
      const cleanName = folderName.trim();
      if (!cleanName) return;

      const adapter = getBackendAdapter();
      if (!adapter.isMock && !device.isOnline) {
        setFileError('Cannot create folder while Windows PC host is disconnected.');
        return;
      }

      const targetDir = subDir
        ? `${activeProject.path.replace(/[\\/]+$/, '')}\\${subDir.replace(/\//g, '\\')}`
        : activeProject.path;

      if (device.isOnline) {
        setFileLoading(true);
        setFileError(null);
        try {
          await adapter.fileSystem.createFile({
            directoryPath: targetDir,
            projectPath: activeProject.path,
            fileName: cleanName,
            isFolder: true,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Create folder failed on host';
          setFileError(msg);
          setFileLoading(false);
          return;
        } finally {
          setFileLoading(false);
        }
      }

      if (device.isOnline && !adapter.isMock) {
        await refreshFiles(subDir);
      } else {
        const newFolder: ProjectFile = {
          name: cleanName,
          path: subDir ? `${subDir}/${cleanName}` : cleanName,
          isDir: true,
          modified: 'Just now',
          children: [],
        };
        setProjects((prev) =>
          prev.map((p) =>
            p.id === activeProjectId ? { ...p, files: [...p.files, newFolder] } : p,
          ),
        );
      }
    },
    [activeProject.path, activeProjectId, device.isOnline, refreshFiles],
  );

  // Rename file or folder on host
  const renameProjectFile = useCallback(
    async (oldPath: string, newName: string, subDir?: string) => {
      const cleanNewName = newName.trim();
      if (!cleanNewName) return;

      const adapter = getBackendAdapter();
      if (!adapter.isMock && !device.isOnline) {
        const msg = 'Cannot rename item while Windows PC host is disconnected.';
        setFileError(msg);
        throw new Error(msg);
      }

      let renamedNewPath = cleanNewName;
      if (device.isOnline && adapter.fileSystem.renameFile) {
        setFileLoading(true);
        setFileError(null);
        try {
          const res = await adapter.fileSystem.renameFile({
            projectPath: activeProject.path,
            oldPath,
            newName: cleanNewName,
          });
          renamedNewPath = res.newPath;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to rename on host';
          setFileError(msg);
          setFileLoading(false);
          throw err;
        } finally {
          setFileLoading(false);
        }
      }

      setUnsavedFiles((prev) => {
        if (prev[oldPath] === undefined) return prev;
        const copy = { ...prev, [renamedNewPath]: prev[oldPath] };
        delete copy[oldPath];
        return copy;
      });

      setActiveFile((prev) =>
        prev && prev.path === oldPath
          ? { ...prev, name: cleanNewName, path: renamedNewPath }
          : prev,
      );

      if (device.isOnline && !adapter.isMock) {
        await refreshFiles(subDir);
        refreshGitStatus().catch(() => {});
      }
    },
    [activeProject.path, device.isOnline, refreshFiles, refreshGitStatus],
  );

  // Delete file or folder on host
  const deleteProjectFile = useCallback(
    async (filePath: string, subDir?: string) => {
      const adapter = getBackendAdapter();
      if (!adapter.isMock && !device.isOnline) {
        const msg = 'Cannot delete item while Windows PC host is disconnected.';
        setFileError(msg);
        throw new Error(msg);
      }

      if (device.isOnline) {
        setFileLoading(true);
        setFileError(null);
        try {
          await adapter.fileSystem.deleteFile({
            filePath,
            projectPath: activeProject.path,
            recursive: true,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to delete item on host';
          setFileError(msg);
          throw err;
        } finally {
          setFileLoading(false);
        }
      }

      setActiveFile((prev) => (prev?.path === filePath ? null : prev));

      if (device.isOnline && !adapter.isMock) {
        await refreshFiles(subDir);
        refreshGitStatus().catch(() => {});
      } else {
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== activeProjectId) return p;
            const removeRecursive = (files: ProjectFile[]): ProjectFile[] =>
              files
                .filter((f) => f.path !== filePath && f.name !== filePath)
                .map((f) => (f.children ? { ...f, children: removeRecursive(f.children) } : f));
            return { ...p, files: removeRecursive(p.files) };
          }),
        );
      }
    },
    [activeProject.path, activeProjectId, device.isOnline, refreshFiles, refreshGitStatus],
  );

  // Track draft content per file
  const setUnsavedDraft = useCallback((filePath: string, draft: string, originalContent?: string) => {
    setUnsavedFiles((prev) => {
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

  // Sync live host filesystem and Git status on connection / workspace switch
  useEffect(() => {
    if (connectionStep === 'connected' && device.isOnline && activeProject.path) {
      refreshFiles().catch(() => {});
      refreshGitStatus().catch(() => {});
    }
  }, [connectionStep, device.isOnline, activeProjectId, activeProject.path, refreshFiles, refreshGitStatus]);

  // Execute terminal command
  const executeCommand = useCallback(
    async (cmd: string) => {
      if (!cmd.trim()) return;

      const trimmedCmd = cmd.trim();
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

      setHistory((prev) => {
        const filtered = prev.filter((h) => h !== trimmedCmd);
        return [trimmedCmd, ...filtered];
      });

      if (trimmedCmd.toLowerCase() === 'cls' || trimmedCmd.toLowerCase() === 'clear') {
        setSessions((prev) =>
          prev.map((s) => (s.id === activeSessionId ? { ...s, buffer: [] } : s)),
        );
        return;
      }

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
            : s,
        ),
      );

      // Honest offline buffering when PC is disconnected
      if (!device.isOnline) {
        const now = Date.now();
        const existingDup = intentQueue.find(
          (e) =>
            e.command === trimmedCmd &&
            e.projectName === activeProject.name &&
            e.status === 'queued' &&
            Math.abs(now - e.timestamp) < 5000,
        );
        const nextSeq = existingDup
          ? existingDup.seq
          : intentQueue.length > 0
          ? Math.max(...intentQueue.map((i) => i.seq)) + 1
          : 1;
        const newIntent: CommandIntent = existingDup ?? {
          id: `intent-${now}-${Math.random().toString(36).substring(2, 8)}`,
          seq: nextSeq,
          command: trimmedCmd,
          workingDir: activeSession.workingDir || activeProject.path,
          projectName: activeProject.name,
          timestamp: now,
          status: 'queued',
          causalDependencyHash: `sha256:${Math.random().toString(16).substring(2, 10)}`,
          expectedBaseBranch: activeProject.branch.replace('*', ''),
          expectedHeadCommit: activeProject.lastCommit.hash,
        };

        if (!existingDup) {
          enqueueIntent(newIntent).catch((err) =>
            console.warn('[RelayContext] Failed to persist offline intent:', err),
          );
          setIntentQueue((prev) => [...prev, newIntent]);
        }

        const bufferedLine: TerminalLine = {
          id: `buf-${Date.now()}`,
          type: 'intent_buffered',
          content: `\x1b[33m[OFFLINE INTENT #${String(nextSeq).padStart(2, '0')} BUFFERED]\x1b[0m PC is currently disconnected. Stored in local phone queue. Requires approval when Windows PC reconnects.`,
          timestamp,
          seq: nextSeq,
          intentId: newIntent.id,
        };

        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  buffer: [...s.buffer, bufferedLine],
                  isRunning: false,
                }
              : s,
          ),
        );
        return;
      }

      // Real Windows Host Companion execution
      const adapter = getBackendAdapter();
      if (!adapter.isMock) {
        try {
          const hostResult = await adapter.terminal.executeCommand({
            sessionId: activeSessionId,
            command: trimmedCmd,
            workingDir: activeSession.workingDir || activeProject.path,
          });

          if (hostResult.interceptCliPrompt) {
            setInterceptedCli(hostResult.interceptCliPrompt);
          }

          // Update ONLY this terminal session's workingDir (never mutate activeProject.path!)
          if (hostResult.workingDir) {
            const newDir = hostResult.workingDir;
            setSessions((prev) =>
              prev.map((s) =>
                s.id === activeSessionId ? { ...s, workingDir: newDir } : s,
              ),
            );
          }

          const outLines: TerminalLine[] = hostResult.lines.map((line, idx) => ({
            id: `out-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            type: line.type,
            content: line.content,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          }));

          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== activeSessionId) return s;
              // Deduplicate lines if live SSE already appended streamed lines for this command
              const recentStreamed = new Set(
                s.buffer
                  .filter((b) => b.isStreaming)
                  .map((b) => `${b.type}:${b.content}`),
              );
              const nonDupOutLines =
                recentStreamed.size > 0
                  ? outLines.filter((ol) => !recentStreamed.has(`${ol.type}:${ol.content}`))
                  : outLines;
              const cleanedBuffer = s.buffer.map((b) =>
                b.isStreaming ? { ...b, isStreaming: false } : b,
              );
              return {
                ...s,
                buffer: [...cleanedBuffer, ...nonDupOutLines],
                isRunning: false,
              };
            }),
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
                : s,
            ),
          );
          return;
        }
      }

      // Mock fallback (only when VITE_ADAPTER_MODE=mock)
      const result = executeCommandOnDaemon(trimmedCmd, activeProject, installedCliMap);
      if (result.interceptCliPrompt) {
        setInterceptedCli(result.interceptCliPrompt);
      }
      for (const line of result.lines) {
        const outLine: TerminalLine = {
          id: `out-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: line.type,
          content: line.content,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId ? { ...s, buffer: [...s.buffer, outLine] } : s,
          ),
        );
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, isRunning: false } : s)),
      );
    },
    [
      activeProject,
      activeSession.workingDir,
      activeSessionId,
      device.isOnline,
      installedCliMap,
      intentQueue,
    ],
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
          prev.map((s) => (s.id === activeSessionId ? { ...s, buffer: [] } : s)),
        );
        return;
      }

      if (signal === 'SIGINT' || signal === 'SIGTERM') {
        const sigLine: TerminalLine = {
          id: `sig-${Date.now()}`,
          type: 'system',
          content: `^C\n\x1b[31m[${signal}]\x1b[0m Interrupt signal sent to Windows host session.`,
          timestamp: now,
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, isRunning: false, buffer: [...s.buffer, sigLine] }
              : s,
          ),
        );
      }
    },
    [activeSessionId],
  );

  // Create session on Windows PC host
  const createSession = useCallback(
    (title: string, type: TerminalSession['type']) => {
      const adapter = getBackendAdapter();
      if (!adapter.isMock) {
        adapter.terminal
          .createSession({
            title,
            type,
            workingDir: activeProject.path || undefined,
          })
          .then((created) => {
            setSessions((prev) => {
              const filtered = prev.filter((s) => s.id !== created.id);
              return [...filtered, created];
            });
            setActiveSessionId(created.id);
          })
          .catch((err: unknown) => {
            const msg =
              err instanceof Error ? err.message : 'Failed to create session on Windows host.';
            const errorLine: TerminalLine = {
              id: `sess-err-${Date.now()}`,
              type: 'error',
              content: `[Session Launch Failed] ${msg}`,
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            };
            setSessions((prev) =>
              prev.map((s) =>
                s.id === activeSessionId ? { ...s, buffer: [...s.buffer, errorLine] } : s,
              ),
            );
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
    },
    [activeProject.path, activeSessionId],
  );

  // Close session
  const closeSession = useCallback(
    (id: string) => {
      const adapter = getBackendAdapter();
      if (!adapter.isMock) {
        adapter.terminal
          .closeSession(id)
          .then(async () => {
            const remaining = await adapter.terminal.listSessions();
            if (remaining.length > 0) {
              setSessions(remaining);
              if (activeSessionId === id) {
                setActiveSessionId(remaining[0].id);
              }
            } else {
              const replacement = await adapter.terminal.createSession({
                title: 'PowerShell',
                type: 'powershell',
                workingDir: activeProject.path || undefined,
              });
              setSessions([replacement]);
              setActiveSessionId(replacement.id);
            }
          })
          .catch(() => {});
        return;
      }

      setSessions((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((s) => s.id !== id);
        if (activeSessionId === id && next.length > 0) {
          setActiveSessionId(next[0].id);
        }
        return next;
      });
    },
    [activeProject.path, activeSessionId],
  );

  // Subscribe active session to live SSE output stream from host
  useEffect(() => {
    const adapter = getBackendAdapter();
    if (
      adapter.isMock ||
      connectionStep !== 'connected' ||
      !device.isOnline ||
      !activeSessionId ||
      !adapter.terminal.subscribeSessionStream
    ) {
      return;
    }

    const unsubscribe = adapter.terminal.subscribeSessionStream(activeSessionId, (streamLine) => {
      if (streamLine.workingDir) {
        const nextDir = streamLine.workingDir;
        setSessions((prev) =>
          prev.map((s) => (s.id === activeSessionId ? { ...s, workingDir: nextDir } : s)),
        );
      }

      if (!streamLine.content && streamLine.type === 'system') {
        return;
      }

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          if (s.buffer.some((b) => b.id === streamLine.id)) return s;
          return {
            ...s,
            buffer: [
              ...s.buffer,
              {
                id: streamLine.id || `sse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: streamLine.type || 'output',
                content: streamLine.content,
                timestamp:
                  streamLine.timestamp ||
                  new Date().toLocaleTimeString('en-US', { hour12: false }),
                isStreaming: true,
              },
            ],
          };
        }),
      );
    });

    return () => {
      unsubscribe();
    };
  }, [activeSessionId, connectionStep, device.isOnline]);

  // Add draft intent directly from offline screen
  const addDraftIntent = useCallback(
    (cmd: string) => {
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

      enqueueIntent(newIntent).catch((err) =>
        console.warn('[RelayContext] Failed to persist draft intent:', err),
      );

      setIntentQueue((prev) => [...prev, newIntent]);
    },
    [activeProject, intentQueue],
  );

  // Scan PC Repositories using real host endpoint
  const scanPcRepositories = useCallback(async () => {
    setIsScanningPc(true);
    try {
      const adapter = getBackendAdapter();
      if (!adapter.isMock && adapter.workspace) {
        const res = await adapter.workspace.scanRepositories();
        if (Array.isArray(res.repositories) && res.repositories.length > 0) {
          setProjects((prev) => {
            const merged = [...prev];
            for (const repo of res.repositories) {
              if (!merged.some((p) => p.path.toLowerCase() === repo.path.toLowerCase())) {
                merged.push(workspaceInfoToProject(repo));
              }
            }
            return merged;
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to scan Windows PC repositories';
      setFileError(msg);
    } finally {
      setIsScanningPc(false);
    }
  }, []);

  // Install / Re-check CLI Tool honestly (no fake setTimeout v1.1.0!)
  const installCliTool = useCallback(
    async (cliId: string) => {
      const adapter = getBackendAdapter();
      if (!adapter.isMock) {
        try {
          await adapter.cli.installTool(cliId);
        } catch {
          // Install may be disabled on host for security; re-probe real installation status
        }
        await refreshCliTools();
        return;
      }
      setCliTools((prev) =>
        prev.map((t) => (t.id === cliId ? { ...t, status: 'installed', version: 'mock' } : t)),
      );
    },
    [refreshCliTools],
  );

  // Reconcile single intent (explicit user approval required — executes on real host in real mode)
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
          prev.map((i) => (i.id === id ? { ...i, status: 'skipped' } : i)),
        );
        return;
      }

      updateIntentStatus(id, 'executing').catch(() => {});
      setIntentQueue((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: 'executing' } : i)),
      );

      const startedAt = Date.now();
      const adapter = getBackendAdapter();
      if (!adapter.isMock) {
        try {
          const execRes = await adapter.terminal.executeCommand({
            sessionId: activeSessionId,
            command: intent.command,
            workingDir: intent.workingDir || activeProject.path,
          });
          const outText = execRes.lines.map((l) => l.content).join('\n');
          const duration = Date.now() - startedAt;

          updateIntentStatus(id, 'reconciled', {
            resultOutput: outText,
            executionDurationMs: duration,
          }).catch(() => {});

          setIntentQueue((prev) =>
            prev.map((i) =>
              i.id === id
                ? {
                    ...i,
                    status: 'reconciled',
                    resultOutput: outText,
                    executionDurationMs: duration,
                  }
                : i,
            ),
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Host execution failed';
          const duration = Date.now() - startedAt;
          updateIntentStatus(id, 'failed', {
            resultOutput: errMsg,
            executionDurationMs: duration,
          }).catch(() => {});
          setIntentQueue((prev) =>
            prev.map((i) =>
              i.id === id
                ? {
                    ...i,
                    status: 'failed',
                    resultOutput: errMsg,
                    executionDurationMs: duration,
                  }
                : i,
            ),
          );
        }
        return;
      }

      const res = executeCommandOnDaemon(intent.command, activeProject, installedCliMap);
      const outText = res.lines.map((l) => l.content).join('\n');
      const duration = Date.now() - startedAt;

      updateIntentStatus(id, 'reconciled', {
        resultOutput: outText,
        executionDurationMs: duration,
      }).catch(() => {});

      setIntentQueue((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status: 'reconciled',
                resultOutput: outText,
                executionDurationMs: duration,
              }
            : i,
        ),
      );
    },
    [activeProject, activeSessionId, installedCliMap, intentQueue],
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
    [intentQueue, reconcileSingleIntent],
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
        isWorkspacePickerOpen,
        setIsWorkspacePickerOpen,
        device,
        setDevice,
        togglePcOnline,
        toggleBackendServer,
        projects,
        activeProjectId,
        setActiveProjectId,
        selectWorkspacePath,
        browseHostFolders,
        pickNativeHostFolder,
        activeProject,
        activeFile,
        setActiveFile,
        saveFileContent,
        createFile,
        createFolder,
        renameProjectFile,
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
        refreshCliTools,
        installCliTool,
        devServers,
        refreshDevServers,
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
