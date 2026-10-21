import React, { useState } from 'react';
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
  QrCode 
} from 'lucide-react';
import { DevServer } from '../types/relay';

type PreviewCategory = 'web' | 'python' | 'desktop' | 'unsupported';

interface PythonScriptItem {
  id: string;
  name: string;
  file: string;
  description: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  lastRunTime?: string;
  stdout: string;
}

interface DesktopAppItem {
  id: string;
  name: string;
  exe: string;
  windowTitle: string;
  status: 'running' | 'minimized' | 'closed';
  fps: number;
  resolution: string;
  streamUrl?: string;
}

export function PreviewScreen() {
  const { devServers, device } = useRelay();

  const [activeCategory, setActiveCategory] = useState<PreviewCategory>('web');
  const [selectedServer, setSelectedServer] = useState<DevServer>(devServers[0]);
  const [viewportMode, setViewportMode] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewCounter, setPreviewCounter] = useState(0);
  const [showQrModal, setShowQrModal] = useState(false);

  // Python Script Preview state
  const [pythonScripts, setPythonScripts] = useState<PythonScriptItem[]>([
    {
      id: 'py-analytics',
      name: 'Data Pipeline & ML Analytics',
      file: 'scripts/train_eval.py',
      description: 'Evaluation run with console metric logs',
      status: 'completed',
      lastRunTime: '2 min ago',
      stdout: `[PyTorch 2.3] Initializing pipeline on Windows host...
Epoch 1/5 [==========] Loss: 0.412 | Acc: 89.2%
Epoch 2/5 [==========] Loss: 0.284 | Acc: 93.7%
Epoch 3/5 [==========] Loss: 0.198 | Acc: 96.1%
--------------------------------------------------------
Metric AUC: 0.984 | F1-Score: 0.963 | Latency: 1.2ms
Artifact: saved model weights to ./dist/model_v2.pt
[SUCCESS] Pipeline executed in 4.82s with zero warnings.`,
    },
    {
      id: 'py-server',
      name: 'FastAPI Microservice',
      file: 'api/daemon_service.py',
      description: 'Async Uvicorn service serving inference endpoints',
      status: 'running',
      lastRunTime: 'Active now',
      stdout: `INFO:     Started server process [PID: 8840]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     127.0.0.1:54322 - "GET /health HTTP/1.1" 200 OK
INFO:     127.0.0.1:54324 - "POST /v1/intents HTTP/1.1" 200 OK`,
    },
  ]);
  const [selectedPythonId, setSelectedPythonId] = useState<string>('py-analytics');

  // Windows Desktop App Preview state
  const [desktopApps] = useState<DesktopAppItem[]>([
    {
      id: 'win-calculator',
      name: 'Windows GUI Tool (WPF / WinUI 3)',
      exe: 'bin/Release/HyperRelayHost.exe',
      windowTitle: 'Hyper-Relay Windows Controller v1.4',
      status: 'running',
      fps: 60,
      resolution: '1280x720 (H.264 WebRTC Stream)',
    },
  ]);

  // Unsupported preview simulator
  const [unsupportedFileName, setUnsupportedFileName] = useState('assets/firmware.bin');

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 450);
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

  const selectedPython = pythonScripts.find((p) => p.id === selectedPythonId) || pythonScripts[0];

  const handleRunPythonScript = (id: string) => {
    setPythonScripts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'running' } : s))
    );
    setTimeout(() => {
      setPythonScripts((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: 'completed',
                lastRunTime: 'Just now',
                stdout: `${s.stdout}\n[RE-EXECUTE ${new Date().toLocaleTimeString()}] Exit Code 0 (Success)`,
              }
            : s
        )
      );
    }, 800);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121419] text-zinc-100 font-sans w-full min-w-0 max-w-full">
      {/* 1. Page Heading & Subtitle: Normal, full-width layout */}
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

      {/* 2. Category Navigation Tabs: Below heading, full-width with horizontal scroll if needed */}
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
          {/* Server Cards: Below tabs with horizontal scrolling only within list */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-medium text-zinc-400">
                Development Servers ({devServers.length})
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                Port {selectedServer.port} active
              </span>
            </div>

            {/* Horizontal scroll container solely for server cards */}
            <div className="w-full overflow-x-auto no-scrollbar pb-1">
              <div className="flex items-center gap-2 min-w-max">
                {devServers.map((server) => {
                  const isSelected = server.id === selectedServer.id;
                  return (
                    <button
                      key={server.id}
                      type="button"
                      onClick={() => setSelectedServer(server)}
                      className={`px-3 py-2 rounded-lg text-left border transition-colors shrink-0 cursor-pointer w-[180px] ${
                        isSelected
                          ? 'bg-[#1e222b] border-[#384052] text-white ring-1 ring-blue-500/20'
                          : 'bg-[#16181e] border-[#252831] hover:border-[#313645] text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        {/* Redundant green status dot REMOVED per Requirement 2 */}
                        <span className="text-xs font-semibold text-zinc-100 truncate">
                          {server.name}
                        </span>
                        <span className="text-[10px] font-mono px-1 rounded bg-[#242833] text-zinc-300 shrink-0">
                          :{server.port}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-1 truncate">
                        {server.framework} · {server.tunnelLatencyMs}ms tunnel
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
                  viewportMode === 'mobile' ? 'bg-[#242833] text-blue-400' : 'text-zinc-400 hover:text-white'
                }`}
                title="Mobile (375px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('tablet')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewportMode === 'tablet' ? 'bg-[#242833] text-blue-400' : 'text-zinc-400 hover:text-white'
                }`}
                title="Tablet (640px)"
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('desktop')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewportMode === 'desktop' ? 'bg-[#242833] text-blue-400' : 'text-zinc-400 hover:text-white'
                }`}
                title="Desktop Full-Width"
              >
                <Laptop className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* In-App Browser Frame */}
          <div className="border border-[#252831] rounded-lg overflow-hidden bg-[#16181e] shadow-xl flex flex-col w-full">
            {/* Browser Top Navigation Bar */}
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

                {/* URL input pill */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-[#111318] border border-[#252831] rounded text-zinc-300 min-w-0 flex-1 truncate">
                  <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="truncate text-[11px] text-zinc-300">
                    https://tunnel-pc.relay.internal:{selectedServer.port}{selectedServer.route}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded cursor-pointer hover:bg-[#22252e]"
                  title="Open via QR Code on another device"
                >
                  <QrCode className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Browser Canvas Area */}
            <div className="bg-[#111318] p-3 min-h-[300px] flex items-center justify-center overflow-auto w-full">
              <div
                className={`w-full transition-all duration-200 mx-auto ${getViewportWidth()}`}
              >
                {/* Simulated Web Application Content */}
                <div className="bg-[#16181e] border border-[#252831] rounded-lg p-4 shadow-sm space-y-3 font-sans text-zinc-200 w-full">
                  <div className="flex items-center justify-between border-b border-[#242731] pb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-xs text-white truncate">{selectedServer.name}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#20232d] text-emerald-400 border border-[#2c3240] shrink-0">
                      200 OK
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-white">
                      Dev Server Tunneled to Phone
                    </h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Executing on Windows PC at <code className="text-zinc-300 font-mono">localhost:{selectedServer.port}</code>.
                    </p>
                  </div>

                  {/* Interactive Test Counter inside preview */}
                  <div className="p-2.5 bg-[#191c23] rounded-md border border-[#262a34] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-zinc-200">Interactive Component State</div>
                      <div className="text-[11px] text-zinc-500">Clicks preserved across refreshes</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewCounter((c) => c + 1)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors cursor-pointer shadow-xs active:scale-95 shrink-0"
                    >
                      Count: {previewCounter}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-zinc-300">
                    <div className="p-2 bg-[#191c23] rounded border border-[#262a34]">
                      <span className="text-zinc-500 text-[10px] block">Tunnel Latency</span>
                      <span className="text-emerald-400 font-semibold">{selectedServer.tunnelLatencyMs} ms</span>
                    </div>
                    <div className="p-2 bg-[#191c23] rounded border border-[#262a34]">
                      <span className="text-zinc-500 text-[10px] block">Transport</span>
                      <span className="text-zinc-200 font-semibold">WebRTC Loopback</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY 2: PYTHON SCRIPT PREVIEW */}
      {activeCategory === 'python' && (
        <div className="w-full space-y-3">
          {/* Script selector tabs: horizontal scroll container */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-medium text-zinc-400">
                Available Python Scripts ({pythonScripts.length})
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {selectedPython.file}
              </span>
            </div>

            <div className="w-full overflow-x-auto no-scrollbar pb-1">
              <div className="flex items-center gap-2 min-w-max">
                {pythonScripts.map((script) => {
                  const isSelected = script.id === selectedPythonId;
                  return (
                    <button
                      key={script.id}
                      type="button"
                      onClick={() => setSelectedPythonId(script.id)}
                      className={`px-3 py-2 rounded-lg text-left border transition-colors shrink-0 cursor-pointer w-[180px] ${
                        isSelected
                          ? 'bg-[#1e222b] border-[#384052] text-white ring-1 ring-blue-500/20'
                          : 'bg-[#16181e] border-[#252831] hover:border-[#313645] text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        {/* Redundant green status dot REMOVED per Requirement 2 */}
                        <span className="text-xs font-semibold text-zinc-100 truncate">{script.name}</span>
                        <span className="text-[10px] font-mono px-1 rounded bg-[#242833] text-zinc-300 shrink-0">
                          {script.file.split('/').pop()}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-1 truncate">
                        {script.status.toUpperCase()} · {script.lastRunTime}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Python Output Console Viewer */}
          <div className="border border-[#252831] rounded-lg overflow-hidden bg-[#16181e] shadow-xl flex flex-col w-full">
            <div className="bg-[#181b22] px-3 py-2 border-b border-[#252831] flex items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="font-semibold text-white truncate">{selectedPython.file}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#20232d] text-zinc-400 border border-[#2c3240] shrink-0 hidden sm:inline">
                  Python 3.11
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleRunPythonScript(selectedPython.id)}
                  className="px-2.5 py-1 bg-[#1c1f26] hover:bg-[#232731] text-zinc-200 border border-[#2b303b] font-medium rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Play className="w-3 h-3 text-zinc-400" />
                  <span>Re-run</span>
                </button>
              </div>
            </div>

            {/* Terminal Output stream */}
            <div className="bg-[#111318] p-3 min-h-[260px] overflow-auto font-mono text-xs text-zinc-300 space-y-2 w-full">
              <div className="text-[11px] text-zinc-500 border-b border-[#22252e] pb-1.5 flex items-center justify-between">
                <span>Stdout / Stderr execution buffer:</span>
                <span className="text-emerald-400">Exit Code: 0</span>
              </div>
              <pre className="whitespace-pre-wrap leading-relaxed text-zinc-300 font-mono text-[11.5px]">
                {selectedPython.stdout}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY 3: WINDOWS DESKTOP APP PREVIEW */}
      {activeCategory === 'desktop' && (
        <div className="w-full space-y-3">
          {desktopApps.map((app) => (
            <div
              key={app.id}
              className="border border-[#252831] rounded-lg overflow-hidden bg-[#16181e] shadow-xl flex flex-col w-full"
            >
              {/* Windows Application Header Bar */}
              <div className="bg-[#181b22] px-3.5 py-2.5 border-b border-[#252831] flex items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Monitor className="w-4 h-4 text-zinc-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-semibold text-white block truncate">{app.windowTitle}</span>
                    <span className="text-[11px] text-zinc-500 truncate block">{app.exe}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-zinc-400 text-xs shrink-0">
                  <span className="px-2 py-0.5 rounded bg-[#20232d] text-zinc-300 border border-[#2b303b] text-[11px] font-mono">
                    {app.fps} FPS
                  </span>
                </div>
              </div>

              {/* Simulated Desktop Window Canvas */}
              <div className="bg-[#111318] p-3 flex flex-col items-center justify-center min-h-[260px] w-full">
                <div className="w-full bg-[#16181e] border border-[#282b36] rounded-md shadow-xl overflow-hidden">
                  <div className="h-7 bg-[#1c1f27] px-3 flex items-center justify-between border-b border-[#262a34] text-[11px]">
                    <span className="text-zinc-300 font-medium truncate">{app.windowTitle}</span>
                    <div className="flex items-center gap-2 text-zinc-500 text-[10px]">
                      <span>—</span>
                      <span>□</span>
                      <span>✕</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 font-sans">
                    <div className="flex items-center justify-between border-b border-[#242732] pb-2.5">
                      <div>
                        <h4 className="text-xs font-semibold text-white">Relay Host Controller Dashboard</h4>
                        <p className="text-[11px] text-zinc-500 font-mono">Windows Desktop Session</p>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-[#20232d] text-zinc-300 border border-[#2b303b] rounded">
                        Active GUI Render
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                      <div className="p-2 bg-[#121419] border border-[#22252e] rounded">
                        <span className="text-[10px] text-zinc-500 block">Graphics</span>
                        <span className="text-emerald-400 font-semibold text-[11px]">DirectX 12</span>
                      </div>
                      <div className="p-2 bg-[#121419] border border-[#22252e] rounded">
                        <span className="text-[10px] text-zinc-500 block">Latency</span>
                        <span className="text-zinc-200 font-semibold text-[11px]">18.4 ms</span>
                      </div>
                      <div className="p-2 bg-[#121419] border border-[#22252e] rounded">
                        <span className="text-[10px] text-zinc-500 block">Input</span>
                        <span className="text-zinc-200 font-semibold text-[11px]">Mirror</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CATEGORY 4: UNSUPPORTED PREVIEW TYPES */}
      {activeCategory === 'unsupported' && (
        <div className="w-full space-y-3">
          <div className="p-3 bg-[#16181e] border border-[#252831] rounded-lg space-y-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-zinc-400">Simulate file preview lookup:</span>
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

          {/* Unsupported Error State Card */}
          <div className="border border-rose-900/40 rounded-lg bg-[#181517] p-5 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-md bg-rose-950/40 border border-rose-800/40 flex items-center justify-center text-rose-400">
              <Ban className="w-5 h-5" />
            </div>

            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-sm font-semibold text-white">Preview Not Available for This File Type</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                <span className="text-rose-300 font-medium">{unsupportedFileName}</span> is a compiled or binary asset that cannot be rendered as a Web preview, Python stdout console, or desktop GUI stream.
              </p>
            </div>

            <div className="p-3 bg-[#121113] border border-[#292225] rounded-md max-w-md mx-auto text-left text-xs font-mono text-zinc-300 space-y-1">
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">Suggested Actions</div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <span>·</span>
                <span>Inspect in Explorer using "Open With… Terminal" (hex dump)</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <span>·</span>
                <span>Run command-line inspection tool via Terminal</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Tunnel Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-sm w-full p-5 space-y-4 text-center shadow-xl">
            <h3 className="text-sm font-semibold text-white">Direct Phone Network Tunnel</h3>
            <p className="text-xs text-zinc-400">
              Scan from your physical smartphone camera to access localhost:{selectedServer.port}
            </p>

            <div className="p-3 bg-white rounded-lg inline-block mx-auto">
              <div className="w-32 h-32 border-2 border-slate-900 grid grid-cols-6 gap-0.5 p-1 bg-white">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-xs ${
                      (i * 7 + 3) % 2 === 0 || i < 6 || i % 6 === 0 ? 'bg-black' : 'bg-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="text-[11px] font-mono text-zinc-300 bg-[#111318] p-2 rounded border border-[#252831]">
              https://tun-{selectedServer.port}.relay.internal
            </div>

            <button
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
