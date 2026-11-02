import React, { useState, useEffect, useMemo } from 'react';
import { useRelay } from '../context/RelayContext';
import {
  Globe,
  RotateCw,
  Smartphone,
  Tablet,
  Laptop,
  ShieldCheck,
  FileCode,
  Play,
  Monitor,
  Ban,
  QrCode,
  Loader2,
  Square,
} from 'lucide-react';
import { DevServer, ProjectFile } from '../types/relay';
import { getBackendAdapter } from '../services';
import { DesktopAppStreamInfo } from '../services/contracts';

type PreviewCategory = 'web' | 'python' | 'desktop' | 'unsupported';

function collectPythonFiles(files: ProjectFile[]): string[] {
  const results: string[] = [];
  for (const item of files) {
    if (!item.isDir && item.name.toLowerCase().endsWith('.py')) {
      results.push(item.path);
    }
    if (item.children && item.children.length > 0) {
      results.push(...collectPythonFiles(item.children));
    }
  }
  return results;
}

export function PreviewScreen() {
  const { devServers, refreshDevServers, activeProject, device } = useRelay();

  const [activeCategory, setActiveCategory] = useState<PreviewCategory>('web');
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [viewportMode, setViewportMode] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [showQrModal, setShowQrModal] = useState(false);

  // Start Web Dev Server form state
  const [serverCmd, setServerCmd] = useState('npm run dev');
  const [serverPort, setServerPort] = useState('5173');
  const [serverActionError, setServerActionError] = useState<string | null>(null);
  const [serverActionBusy, setServerActionBusy] = useState(false);

  // Real Python Script execution state
  const workspacePythonFiles = useMemo(
    () => collectPythonFiles(activeProject.files || []),
    [activeProject.files],
  );
  const [pythonScriptPath, setPythonScriptPath] = useState<string>('');
  const [pythonRunning, setPythonRunning] = useState(false);
  const [pythonResult, setPythonResult] = useState<{
    exitCode: number;
    stdout: string;
    stderr: string;
    executionTimeMs: number;
  } | null>(null);
  const [pythonError, setPythonError] = useState<string | null>(null);

  // Real Desktop Stream capability check state
  const [desktopStreamInfo, setDesktopStreamInfo] = useState<DesktopAppStreamInfo | null>(null);

  // Unsupported preview file check
  const [unsupportedFileName, setUnsupportedFileName] = useState('assets/firmware.bin');

  useEffect(() => {
    if (workspacePythonFiles.length > 0 && !pythonScriptPath) {
      setPythonScriptPath(workspacePythonFiles[0]);
    }
  }, [workspacePythonFiles, pythonScriptPath]);

  useEffect(() => {
    if (activeCategory === 'desktop' && device.isOnline) {
      const adapter = getBackendAdapter();
      adapter.preview
        .getDesktopAppStream('host-desktop')
        .then((info) => setDesktopStreamInfo(info))
        .catch(() => setDesktopStreamInfo(null));
    }
  }, [activeCategory, device.isOnline]);

  const selectedServer: DevServer | undefined =
    devServers.find((s) => s.id === selectedServerId) || devServers[0];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshDevServers();
      setIframeKey((k) => k + 1);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStartServer = async () => {
    const portNum = Number(serverPort);
    if (!serverCmd.trim() || !Number.isInteger(portNum) || portNum < 1024 || portNum > 65535) {
      setServerActionError('Enter a valid command and port (1024–65535).');
      return;
    }
    setServerActionBusy(true);
    setServerActionError(null);
    try {
      const adapter = getBackendAdapter();
      const created = await adapter.preview.startDevServer(
        serverCmd.trim(),
        portNum,
        activeProject.path || undefined,
      );
      await refreshDevServers();
      setSelectedServerId(created.id);
    } catch (err) {
      setServerActionError(err instanceof Error ? err.message : 'Failed to start server');
    } finally {
      setServerActionBusy(false);
    }
  };

  const handleStopServer = async (serverId: string) => {
    setServerActionBusy(true);
    setServerActionError(null);
    try {
      const adapter = getBackendAdapter();
      await adapter.preview.stopDevServer(serverId);
      await refreshDevServers();
    } catch (err) {
      setServerActionError(err instanceof Error ? err.message : 'Failed to stop server');
    } finally {
      setServerActionBusy(false);
    }
  };

  const handleRunPythonScript = async () => {
    const target = pythonScriptPath.trim();
    if (!target) {
      setPythonError('Enter or select a Python (.py) file path relative to the workspace.');
      return;
    }
    setPythonRunning(true);
    setPythonError(null);
    try {
      const adapter = getBackendAdapter();
      const resolvedTarget =
        activeProject.path && !/^[A-Za-z]:[\\/]/.test(target) && !target.startsWith('/')
          ? `${activeProject.path.replace(/[\\/]+$/, '')}\\${target.replace(/\//g, '\\')}`
          : target;
      const res = await adapter.preview.runPythonPreview(resolvedTarget);
      setPythonResult({
        exitCode: res.exitCode,
        stdout: res.stdout,
        stderr: res.stderr,
        executionTimeMs: res.executionTimeMs,
      });
    } catch (err) {
      setPythonError(err instanceof Error ? err.message : 'Failed to execute Python script on host.');
    } finally {
      setPythonRunning(false);
    }
  };

  const getViewportWidth = () => {
    switch (viewportMode) {
      case 'mobile':
        return 'max-w-[375px]';
      case 'tablet':
        return 'max-w-[640px]';
      case 'desktop':
        return 'max-w-full';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121419] text-zinc-100 font-sans w-full min-w-0 max-w-full">
      {/* 1. Page Heading & Subtitle */}
      <div className="w-full space-y-1">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-zinc-400 shrink-0" />
          <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">
            Project Output & Preview
          </h2>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Output targets: Web servers, Python scripts, and Windows desktop apps.
        </p>
      </div>

      {/* 2. Category Navigation Tabs */}
      <div className="w-full overflow-x-auto no-scrollbar">
        <div className="flex items-center p-0.5 bg-[#181a21] rounded-lg border border-[#262a33] text-xs font-medium w-full min-w-[320px]">
          <button
            type="button"
            onClick={() => setActiveCategory('web')}
            className={`flex-1 py-1.5 px-2 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs ${
              activeCategory === 'web'
                ? 'bg-[#242833] text-white font-medium shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span>Web</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('python')}
            className={`flex-1 py-1.5 px-2 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs ${
              activeCategory === 'python'
                ? 'bg-[#242833] text-white font-medium shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 shrink-0" />
            <span>Python</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('desktop')}
            className={`flex-1 py-1.5 px-2 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs ${
              activeCategory === 'desktop'
                ? 'bg-[#242833] text-white font-medium shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 shrink-0" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('unsupported')}
            className={`flex-1 py-1.5 px-2 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs ${
              activeCategory === 'unsupported'
                ? 'bg-[#242833] text-white font-medium shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Ban className="w-3.5 h-3.5 shrink-0" />
            <span>Unsupported</span>
          </button>
        </div>
      </div>

      {/* CATEGORY 1: WEB DEV SERVER PREVIEW */}
      {activeCategory === 'web' && (
        <div className="w-full space-y-3">
          {/* Launch / Register Local Dev Server */}
          <div className="p-3 bg-[#16181e] border border-[#252831] rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">Start or Attach Local Server</span>
              <button
                type="button"
                onClick={handleRefresh}
                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RotateCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={serverCmd}
                onChange={(e) => setServerCmd(e.target.value)}
                placeholder="npm run dev"
                className="flex-1 h-8 px-2.5 bg-[#111318] border border-[#2b303b] rounded text-xs font-mono text-zinc-100 outline-none"
              />
              <input
                type="number"
                value={serverPort}
                onChange={(e) => setServerPort(e.target.value)}
                placeholder="5173"
                className="w-20 h-8 px-2 bg-[#111318] border border-[#2b303b] rounded text-xs font-mono text-zinc-100 outline-none"
              />
              <button
                type="button"
                disabled={serverActionBusy || !device.isOnline}
                onClick={handleStartServer}
                className="px-3 h-8 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-xs font-medium flex items-center gap-1 cursor-pointer shrink-0"
              >
                {serverActionBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                <span>Start</span>
              </button>
            </div>
            {serverActionError && (
              <p className="text-[11px] text-rose-400 font-mono">{serverActionError}</p>
            )}
          </div>

          {!selectedServer ? (
            <div className="p-6 bg-[#16181e] border border-[#252831] rounded-lg text-center space-y-1.5">
              <div className="text-xs font-semibold text-zinc-200">
                No Active Web Preview Servers ({devServers.length})
              </div>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Start a development server above or from the PowerShell terminal to preview real LAN HTTP output from your Windows PC.
              </p>
            </div>
          ) : (
            <>
              <div className="w-full space-y-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-medium text-zinc-400">
                    Development Servers ({devServers.length})
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Port {selectedServer.port} {selectedServer.status}
                  </span>
                </div>

                <div className="w-full overflow-x-auto no-scrollbar pb-1">
                  <div className="flex items-center gap-2 min-w-max">
                    {devServers.map((server) => {
                      const isSelected = server.id === selectedServer.id;
                      return (
                        <button
                          key={server.id}
                          type="button"
                          onClick={() => setSelectedServerId(server.id)}
                          className={`px-3 py-2 rounded-lg text-left border transition-colors shrink-0 cursor-pointer w-[190px] ${
                            isSelected
                              ? 'bg-[#1e222b] border-[#384052] text-white ring-1 ring-blue-500/20'
                              : 'bg-[#16181e] border-[#252831] hover:border-[#313645] text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-semibold text-zinc-100 truncate">
                              {server.name}
                            </span>
                            <span className="text-[10px] font-mono px-1 rounded bg-[#242833] text-zinc-300 shrink-0">
                              :{server.port}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono mt-1 truncate">
                            {server.framework}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Viewport switch controls toolbar */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-xs font-medium text-zinc-400">Viewport Simulation</span>
                <div className="flex items-center p-0.5 bg-[#181a21] rounded-md border border-[#262a33]">
                  <button
                    type="button"
                    onClick={() => setViewportMode('mobile')}
                    className={`p-1.5 rounded transition-colors cursor-pointer ${
                      viewportMode === 'mobile'
                        ? 'bg-[#242833] text-blue-400'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Mobile (375px)"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewportMode('tablet')}
                    className={`p-1.5 rounded transition-colors cursor-pointer ${
                      viewportMode === 'tablet'
                        ? 'bg-[#242833] text-blue-400'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Tablet (640px)"
                  >
                    <Tablet className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewportMode('desktop')}
                    className={`p-1.5 rounded transition-colors cursor-pointer ${
                      viewportMode === 'desktop'
                        ? 'bg-[#242833] text-blue-400'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Desktop Full-Width"
                  >
                    <Laptop className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* In-App Browser Frame */}
              <div className="border border-[#252831] rounded-lg overflow-hidden bg-[#16181e] shadow-xl flex flex-col w-full">
                <div className="bg-[#181b22] px-3 py-2 border-b border-[#252831] flex items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className={`p-1 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer shrink-0 ${
                        isRefreshing ? 'animate-spin text-blue-400' : ''
                      }`}
                      title="Reload Preview"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#111318] border border-[#252831] rounded text-zinc-300 min-w-0 flex-1 truncate">
                      <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="truncate text-[11px] text-zinc-300">
                        {selectedServer.url}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStopServer(selectedServer.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 rounded cursor-pointer hover:bg-[#22252e]"
                      title="Stop server"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQrModal(true)}
                      className="p-1.5 text-zinc-400 hover:text-white rounded cursor-pointer hover:bg-[#22252e]"
                      title="Show LAN URL"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="bg-[#111318] p-3 min-h-[320px] flex items-center justify-center overflow-auto w-full">
                  <div className={`w-full transition-all duration-200 mx-auto ${getViewportWidth()}`}>
                    <iframe
                      key={`${selectedServer.id}-${iframeKey}`}
                      src={selectedServer.url}
                      title={selectedServer.name}
                      className="w-full h-[320px] bg-white rounded border border-[#252831]"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* CATEGORY 2: REAL PYTHON SCRIPT EXECUTION */}
      {activeCategory === 'python' && (
        <div className="w-full space-y-3">
          <div className="p-3 bg-[#16181e] border border-[#252831] rounded-lg space-y-2">
            <span className="text-xs font-medium text-zinc-300 block">
              Execute Python Script on Windows Host
            </span>

            {workspacePythonFiles.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {workspacePythonFiles.map((pyFile) => (
                  <button
                    key={pyFile}
                    type="button"
                    onClick={() => setPythonScriptPath(pyFile)}
                    className={`px-2 py-1 rounded text-[11px] font-mono border cursor-pointer ${
                      pythonScriptPath === pyFile
                        ? 'bg-[#242833] border-[#384052] text-white'
                        : 'bg-[#111318] border-[#252831] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {pyFile}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={pythonScriptPath}
                onChange={(e) => setPythonScriptPath(e.target.value)}
                placeholder="e.g. main.py or scripts/analyze.py"
                className="flex-1 h-8 px-2.5 bg-[#111318] border border-[#2b303b] rounded text-xs font-mono text-zinc-100 outline-none"
              />
              <button
                type="button"
                disabled={pythonRunning || !device.isOnline}
                onClick={handleRunPythonScript}
                className="px-3 h-8 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {pythonRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                <span>Run</span>
              </button>
            </div>
            {pythonError && <p className="text-[11px] text-rose-400 font-mono">{pythonError}</p>}
          </div>

          <div className="border border-[#252831] rounded-lg overflow-hidden bg-[#16181e] shadow-xl flex flex-col w-full">
            <div className="bg-[#181b22] px-3 py-2 border-b border-[#252831] flex items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="font-semibold text-white truncate">
                  {pythonScriptPath || 'No script selected'}
                </span>
              </div>
              {pythonResult && (
                <span
                  className={`text-[10px] font-mono ${
                    pythonResult.exitCode === 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  Exit Code: {pythonResult.exitCode} ({pythonResult.executionTimeMs}ms)
                </span>
              )}
            </div>

            <div className="bg-[#111318] p-3 min-h-[220px] overflow-auto font-mono text-xs text-zinc-300 space-y-2 w-full">
              {!pythonResult ? (
                <p className="text-zinc-500 text-xs">
                  Select or enter a real <code className="text-zinc-300">.py</code> file in your workspace and press Run to capture live Windows Python stdout/stderr.
                </p>
              ) : (
                <>
                  {pythonResult.stdout && (
                    <pre className="whitespace-pre-wrap leading-relaxed text-zinc-200 font-mono text-[11.5px]">
                      {pythonResult.stdout}
                    </pre>
                  )}
                  {pythonResult.stderr && (
                    <pre className="whitespace-pre-wrap leading-relaxed text-rose-300 font-mono text-[11.5px]">
                      {pythonResult.stderr}
                    </pre>
                  )}
                  {!pythonResult.stdout && !pythonResult.stderr && (
                    <span className="text-zinc-500">(Script completed with no console output)</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY 3: WINDOWS DESKTOP APP PREVIEW (HONEST CAPABILITY STATE) */}
      {activeCategory === 'desktop' && (
        <div className="w-full space-y-3">
          <div className="border border-[#252831] rounded-lg bg-[#16181e] p-5 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-md bg-[#1c1f26] border border-[#2b303b] flex items-center justify-center text-zinc-400">
              <Monitor className="w-5 h-5" />
            </div>

            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-sm font-semibold text-white">
                Desktop Window Stream Not Enabled in Local MVP
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {desktopStreamInfo?.reason
                  ? desktopStreamInfo.reason
                  : 'Real-time Windows desktop GUI capture (DXGI/WebRTC) is not active in this local-first companion.'}{' '}
                Launch native Windows executables directly via the PowerShell Terminal or Run & Debug tab.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY 4: UNSUPPORTED PREVIEW TYPES */}
      {activeCategory === 'unsupported' && (
        <div className="w-full space-y-3">
          <div className="p-3 bg-[#16181e] border border-[#252831] rounded-lg space-y-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-zinc-400">Check binary/asset preview support:</span>
              <select
                value={unsupportedFileName}
                onChange={(e) => setUnsupportedFileName(e.target.value)}
                className="bg-[#111318] border border-[#2b303b] text-xs font-mono text-zinc-200 px-2 py-1.5 rounded outline-none w-full min-w-0 max-w-full truncate"
              >
                <option value="assets/firmware.bin">assets/firmware.bin (Raw Binary Executable)</option>
                <option value="models/weights.onnx">models/weights.onnx (Compiled Neural Net)</option>
                <option value="dump.vhd">dump.vhd (Virtual Hard Disk Image)</option>
                <option value="database.db-wal">database.db-wal (SQLite Write-Ahead Lock)</option>
              </select>
            </div>
          </div>

          <div className="border border-rose-900/40 rounded-lg bg-[#181517] p-5 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-md bg-rose-950/40 border border-rose-800/40 flex items-center justify-center text-rose-400">
              <Ban className="w-5 h-5" />
            </div>

            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-sm font-semibold text-white">
                Preview Not Available for This File Type
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                <span className="text-rose-300 font-medium">{unsupportedFileName}</span> is a compiled or binary asset that cannot be rendered as a Web preview or Python stdout console.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* LAN URL Modal */}
      {showQrModal && selectedServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-sm w-full p-5 space-y-4 text-center shadow-xl">
            <h3 className="text-sm font-semibold text-white">Local Network Preview URL</h3>
            <p className="text-xs text-zinc-400">
              Open this LAN address from your phone while connected to the same Wi-Fi network:
            </p>

            <div className="text-[11px] font-mono text-zinc-200 bg-[#111318] p-2.5 rounded border border-[#252831] select-all break-all">
              {selectedServer.url}
            </div>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-1.5 bg-[#22252e] hover:bg-[#2b2f3b] text-zinc-200 rounded-md text-xs font-medium cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
