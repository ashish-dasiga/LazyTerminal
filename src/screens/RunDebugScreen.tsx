import React, { useState, useEffect } from 'react';
import { useRelay } from '../context/RelayContext';
import { Play, Terminal, Sparkles, Cpu, Loader2 } from 'lucide-react';
import { AiCliTool } from '../types/relay';
import { getBackendAdapter } from '../services';
import { apiRequest } from '../services/apiClient';

interface DetectedTaskItem {
  id: string;
  name: string;
  description: string;
  cmd: string;
}

export function RunDebugScreen() {
  const {
    cliTools,
    installCliTool,
    executeCommand,
    setMobileNav,
    createSession,
    sessions,
    setActiveSessionId,
    activeProject,
    device,
  } = useRelay();

  const [activeTab, setActiveTab] = useState<'scripts' | 'ai_tools'>('scripts');
  const [customCommand, setCustomCommand] = useState('');
  const [isExecutingScript, setIsExecutingScript] = useState<string | null>(null);
  const [detectedTasks, setDetectedTasks] = useState<DetectedTaskItem[]>([]);
  const [detectedProjectType, setDetectedProjectType] = useState<string>('');
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    const adapter = getBackendAdapter();
    if (adapter.isMock) {
      setDetectedProjectType('Mock Workspace');
      setDetectedTasks([
        {
          id: 'dev-server',
          name: 'npm run dev',
          description: 'Start local Vite dev server',
          cmd: 'npm run dev',
        },
      ]);
      return;
    }

    if (!device.isOnline || !activeProject.path) {
      setDetectedTasks([]);
      setDetectedProjectType('');
      return;
    }

    let cancelled = false;
    setLoadingTasks(true);
    apiRequest<{
      projectPath: string;
      projectType: string;
      availableTasks: Array<{
        id: string;
        name: string;
        description: string;
        cmd: string;
        args?: string[];
      }>;
    }>(`/api/v1/run-debug/detect?path=${encodeURIComponent(activeProject.path)}`)
      .then((res) => {
        if (cancelled) return;
        setDetectedProjectType(res.projectType || 'Workspace');
        const mapped = (res.availableTasks || []).map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          cmd: Array.isArray(t.args) && t.args.length > 0 ? `${t.cmd} ${t.args.join(' ')}` : t.cmd,
        }));
        setDetectedTasks(mapped);
      })
      .catch(() => {
        if (!cancelled) {
          setDetectedTasks([]);
          setDetectedProjectType('');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTasks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProject.path, device.isOnline]);

  const handleRunScript = async (cmd: string, scriptId: string) => {
    setIsExecutingScript(scriptId);
    setMobileNav('terminal');
    try {
      await executeCommand(cmd);
    } finally {
      setIsExecutingScript(null);
    }
  };

  const handleLaunchCli = async (tool: AiCliTool) => {
    const sessionType =
      tool.id === 'claude'
        ? 'claude'
        : tool.id === 'codex'
        ? 'codex'
        : tool.id === 'gemini'
        ? 'gemini'
        : tool.id === 'antigravity'
        ? 'antigravity'
        : 'powershell';

    const existing = sessions.find((s) => s.type === sessionType);
    if (existing) {
      setActiveSessionId(existing.id);
    } else {
      await createSession(`${tool.name}`, sessionType);
    }
    setMobileNav('terminal');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121419] text-zinc-100 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">Run & Debug</h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Launch build tasks, test runners, scripts, and developer tools.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center p-0.5 bg-[#181a21] border border-[#262a33] rounded-md text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('scripts')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              activeTab === 'scripts'
                ? 'bg-[#242833] text-white font-medium'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Scripts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai_tools')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              activeTab === 'ai_tools'
                ? 'bg-[#242833] text-white font-medium'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            CLI Tools
          </button>
        </div>
      </div>

      {activeTab === 'scripts' ? (
        <div className="space-y-4 animate-in fade-in duration-100">
          {/* Quick Runner Form */}
          <div className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg space-y-2">
            <label className="text-xs font-medium text-zinc-300">Custom Command</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                placeholder="e.g. npm test or python main.py"
                className="flex-1 h-9 px-3 bg-[#111318] border border-[#2b303b] focus:border-blue-500 rounded-md text-xs font-mono text-zinc-100 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (customCommand.trim()) {
                    void executeCommand(customCommand.trim());
                    setMobileNav('terminal');
                  }
                }}
                disabled={!customCommand.trim()}
                className="px-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" /> Launch
              </button>
            </div>
          </div>

          {/* Detected Workspace Scripts List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-zinc-400">
                Workspace Tasks ({detectedTasks.length})
              </span>
              {detectedProjectType && (
                <span className="text-[10px] font-mono text-zinc-500">{detectedProjectType}</span>
              )}
            </div>

            {loadingTasks ? (
              <div className="p-4 bg-[#16181e] border border-[#252831] rounded-lg flex items-center gap-2 text-xs text-zinc-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span>Inspecting workspace manifests on Windows PC...</span>
              </div>
            ) : detectedTasks.length === 0 ? (
              <div className="p-4 bg-[#16181e] border border-[#252831] rounded-lg text-xs text-zinc-400 leading-relaxed">
                No <code className="font-mono text-zinc-300">package.json</code>,{' '}
                <code className="font-mono text-zinc-300">Cargo.toml</code>, or Python task manifests
                detected in <code className="font-mono text-zinc-300">{activeProject.path || 'current workspace'}</code>.
                Use Custom Command above to run any Windows executable or script.
              </div>
            ) : (
              detectedTasks.map((s) => (
                <div
                  key={s.id}
                  className="p-3 bg-[#16181e] border border-[#252831] hover:border-[#313645] rounded-lg flex items-center justify-between transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-100 font-mono">{s.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#20232c] text-zinc-400">
                        Windows Host
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate font-mono">{s.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRunScript(s.cmd, s.id)}
                    disabled={isExecutingScript === s.id}
                    className="px-3 py-1 bg-[#1c1f26] hover:bg-[#232731] text-zinc-200 border border-[#2b303b] rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                  >
                    {isExecutingScript === s.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3 text-zinc-400" />
                    )}
                    <span>Run</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* CLI TOOLS TAB */
        <div className="space-y-3 animate-in fade-in duration-100">
          <div className="p-3 bg-[#16181e] border border-[#252831] rounded-lg text-xs text-zinc-300 leading-relaxed">
            Command-line development tools detected on your Windows PC. Launch opens a live session bound to{' '}
            <code className="font-mono text-zinc-200">{activeProject.path || 'your workspace'}</code>.
          </div>

          <div className="space-y-2.5">
            {cliTools.map((tool) => {
              const isInstalled =
                tool.status === 'installed' ||
                tool.status === 'needs_setup' ||
                tool.status === 'running' ||
                Boolean(tool.executablePath);
              return (
                <div
                  key={tool.id}
                  className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded bg-[#1c1f26] border border-[#2b303b] text-zinc-400 shrink-0">
                        {tool.id === 'claude' ? (
                          <Sparkles className="w-4 h-4" />
                        ) : tool.id === 'codex' ? (
                          <Cpu className="w-4 h-4" />
                        ) : (
                          <Terminal className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs font-semibold text-zinc-100">{tool.name}</h3>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                              isInstalled
                                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {isInstalled ? tool.version : 'Not Installed'}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono block truncate">
                          {tool.executablePath || tool.vendor}
                        </span>
                      </div>
                    </div>

                    {isInstalled ? (
                      <button
                        type="button"
                        onClick={() => handleLaunchCli(tool)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                      >
                        <Play className="w-3 h-3 text-white" /> Launch
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => installCliTool(tool.id)}
                        className="px-3 py-1 bg-[#1c1f26] hover:bg-[#232731] text-zinc-300 border border-[#2b303b] rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                      >
                        Install on PC
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">{tool.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
