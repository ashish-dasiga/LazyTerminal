import React, { useState } from 'react';
import { useRelay } from '../context/RelayContext';
import {
  Server,
  Key,
  RefreshCw,
  Check,
  Copy,
  Smartphone,
  Play,
  Square,
  RefreshCw as SyncIcon,
  ChevronDown,
  CheckCircle2,
  ShieldCheck,
  Radio,
} from 'lucide-react';

interface SyncRequestRecord {
  id: string;
  timestamp: string;
  timeAgo: string;
  status: 'success' | 'pending' | 'conflict';
  itemsSynced: number;
  trigger: 'manual_desktop' | 'mobile_auto' | 'periodic';
  summary: string;
  headCommit: string;
}

export function LaptopApp() {
  const {
    device,
    activeProject,
    toggleBackendServer,
    generatedConnectionKey,
    regenerateConnectionKey,
    reconcileAllIntents,
    setActiveFrontend,
    intentQueue,
    connectionStep,
    connectWithKey,
    disconnectMobile,
  } = useRelay();

  // 1) Connection state
  const isConnected = connectionStep === 'connected';

  // 2) Token Window State
  const [tokenCopied, setTokenCopied] = useState(false);
  const tokenNumber = generatedConnectionKey;

  // 3) Server status
  const isServerRunning = device.backendServerStatus === 'running';

  // 4) Sync Request & Dropdown State (real runtime records only; never pre-populated with demo logs)
  const [syncRequests, setSyncRequests] = useState<SyncRequestRecord[]>([]);
  const [selectedSyncId, setSelectedSyncId] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessToast, setSyncSuccessToast] = useState<string | null>(null);

  const handleGenerateRandomToken = () => {
    regenerateConnectionKey();
  };

  const handleCopyToken = () => {
    navigator.clipboard?.writeText(generatedConnectionKey);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const handleSyncRequest = async () => {
    setIsSyncing(true);
    try {
      await reconcileAllIntents();

      const newSyncId = `SYNC-REQ-${101 + syncRequests.length}`;
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newRecord: SyncRequestRecord = {
        id: newSyncId,
        timestamp: `${now.toISOString().split('T')[0]} ${timeStr}`,
        timeAgo: 'Just now',
        status: 'success',
        itemsSynced: intentQueue.length,
        trigger: 'manual_desktop',
        summary:
          intentQueue.length > 0
            ? `Synchronized workspace state & ${intentQueue.length} queued intent(s)`
            : `Synchronized active workspace (${activeProject.path || activeProject.name})`,
        headCommit: activeProject.lastCommit?.hash || 'HEAD',
      };

      setSyncRequests((prev) => [newRecord, ...prev]);
      setSelectedSyncId(newSyncId);
      setSyncSuccessToast(`Sync request ${newSyncId} completed!`);
      setTimeout(() => setSyncSuccessToast(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const selectedSync = syncRequests.find((s) => s.id === selectedSyncId) || syncRequests[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181a1f] text-zinc-100 select-text overflow-hidden font-sans">
      {/* 1. Desktop Window Frame Header */}
      <div className="h-9 bg-[#14161b] border-b border-[#252830] px-3.5 flex items-center justify-between text-xs select-none shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#1f232b] text-zinc-300 flex items-center justify-center font-bold text-[10px] font-mono border border-[#2b313d]">
            W
          </div>
          <span className="font-semibold text-zinc-200">Relay Desktop Host — Windows</span>
          <span className="text-[11px] text-zinc-500 font-mono">({device.deviceName})</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveFrontend('mobile')}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1e222b] hover:bg-[#272c37] border border-[#2e3442] rounded text-xs text-zinc-200 cursor-pointer transition-colors"
            title="Switch view to Mobile Android App"
          >
            <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
            <span>Switch to Mobile App</span>
          </button>

          <div className="flex items-center gap-2 text-zinc-500">
            <span className="w-3 h-0.5 bg-zinc-500 rounded inline-block" />
            <span className="w-2.5 h-2.5 border border-zinc-500 rounded-xs inline-block" />
            <span className="text-sm leading-none">✕</span>
          </div>
        </div>
      </div>

      {/* Main Single-Screen Content */}
      <div className="flex-1 p-5 md:p-6 flex flex-col justify-between gap-5 overflow-hidden bg-[#14161c]">
        {syncSuccessToast && (
          <div className="py-1.5 px-3 bg-emerald-950/40 border border-emerald-800/60 rounded-md flex items-center justify-between text-xs text-emerald-200 shrink-0 shadow-sm animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-medium">{syncSuccessToast}</span>
            </div>
            <button
              onClick={() => setSyncSuccessToast(null)}
              className="text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {isConnected && (
          <div className="py-2 px-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-lg flex items-center justify-between text-xs text-emerald-200 shrink-0 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="flex items-center gap-2">
                <span className="font-semibold text-emerald-300">Device Connected:</span>
                <span className="text-zinc-300 font-mono">
                  Android Mobile Client (Authenticated Host Session)
                </span>
              </div>
            </div>
            <button
              onClick={disconnectMobile}
              className="px-2.5 py-1 bg-[#1a1d24] hover:bg-[#252833] border border-[#2e3442] rounded text-[11px] text-zinc-300 hover:text-white cursor-pointer transition-colors"
              title="Disconnect active mobile session"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* 1) Token Window */}
        <div
          className={`bg-[#1a1d24] border border-[#282d38] rounded-lg shadow-sm flex flex-col overflow-hidden transition-all ${
            !isConnected ? 'py-4 px-2 sm:px-4' : ''
          }`}
        >
          <div className="h-7.5 bg-[#15181f] border-b border-[#242833] px-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-200">Token Window</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              {isConnected ? 'Paired Session Active' : 'Backend Bound'}
            </span>
          </div>

          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block">
                Random Token Number
              </span>
              <div className="text-2xl font-mono font-bold text-white tracking-widest leading-none py-0.5">
                {tokenNumber || '---'}
              </div>
              <p className="text-[11px] text-zinc-500">
                {isConnected
                  ? 'Active session paired with this cryptographic token.'
                  : 'Dynamic pairing token. Enter this 6-digit code on mobile to connect.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleCopyToken}
                disabled={!tokenNumber}
                className="px-3 py-1.5 bg-[#1e222b] hover:bg-[#292f3b] disabled:opacity-50 text-zinc-200 hover:text-white rounded-md border border-[#2e3442] cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="Copy token to clipboard"
              >
                {tokenCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Copy Token</span>
                  </>
                )}
              </button>

              <button
                onClick={handleGenerateRandomToken}
                className="p-1.5 bg-[#1e222b] hover:bg-[#292f3b] text-zinc-300 hover:text-white rounded-md border border-[#2e3442] cursor-pointer transition-colors"
                title="Generate new random token"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-200" />
              </button>

              {!isConnected && tokenNumber && (
                <button
                  onClick={() => connectWithKey(generatedConnectionKey)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-medium shadow-sm"
                  title="Pair directly from loopback host view"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Pair Local Session</span>
                </button>
              )}
            </div>
          </div>

          {!isConnected && (
            <div className="mx-3.5 mb-3.5 p-3 bg-[#121418] border border-[#222630] rounded-md flex items-center justify-between text-xs text-zinc-400">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span>
                  Waiting for Android client to connect with this token on the local network...
                </span>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
                Port: 9871 / 3000
              </span>
            </div>
          )}
        </div>

        {/* 2) Server Control & 3) Sync Manager */}
        {isConnected ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 animate-in fade-in duration-300">
            <div className="md:col-span-5 bg-[#1a1d24] border border-[#282d38] rounded-lg shadow-sm flex flex-col justify-between p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-zinc-400" /> Server Control
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1.5 bg-zinc-800/80 text-zinc-400 border-zinc-700/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                  {isServerRunning ? 'RUNNING' : 'STOPPED'}
                </span>
              </div>

              <div className="space-y-1 text-xs font-mono text-zinc-400 bg-[#121418] p-2.5 rounded border border-[#222630]">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Local Port:</span>
                  <span className="text-zinc-200 font-semibold">9871 (HTTP/SSE)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Host IP:</span>
                  <span className="text-zinc-300">{device.ip || '127.0.0.1'}</span>
                </div>
              </div>

              <button
                onClick={toggleBackendServer}
                className={`w-full py-2.5 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors flex items-center justify-center gap-2 text-white shadow-sm ${
                  isServerRunning
                    ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'
                }`}
              >
                {isServerRunning ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-white text-white" />
                    <span>Stop Server</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white text-white" />
                    <span>Start Server</span>
                  </>
                )}
              </button>
            </div>

            <div className="md:col-span-7 bg-[#1a1d24] border border-[#282d38] rounded-lg shadow-sm flex flex-col justify-between p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <SyncIcon className="w-3.5 h-3.5 text-blue-400" /> Sync Manager
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {syncRequests.length} sync requests recorded
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  onClick={handleSyncRequest}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-md text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                >
                  <SyncIcon className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Request'}</span>
                </button>

                {syncRequests.length > 0 && (
                  <div className="flex-1 relative min-w-0">
                    <select
                      value={selectedSyncId}
                      onChange={(e) => setSelectedSyncId(e.target.value)}
                      className="w-full h-8 bg-[#121419] border border-[#2a2f3c] hover:border-[#384052] rounded-md px-2.5 pr-8 text-xs text-zinc-200 font-mono appearance-none cursor-pointer focus:outline-none focus:border-blue-500 transition-colors truncate"
                    >
                      {syncRequests.map((req) => (
                        <option key={req.id} value={req.id} className="bg-[#14161c] text-zinc-200">
                          {req.id} · {req.timeAgo}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 pointer-events-none absolute right-2.5 top-2.5" />
                  </div>
                )}
              </div>

              {selectedSync ? (
                <div className="p-2.5 bg-[#121418] border border-[#222630] rounded-md space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-200 font-semibold">{selectedSync.id}</span>
                    <span className="text-zinc-500">{selectedSync.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">{selectedSync.summary}</p>
                </div>
              ) : (
                <div className="p-2.5 bg-[#121418] border border-[#222630] rounded-md text-[11px] font-mono text-zinc-500">
                  No manual sync events recorded in this session yet.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#282d38] rounded-lg bg-[#16181f]/40 my-auto">
            <Radio className="w-8 h-8 text-zinc-600 mb-2 animate-pulse" />
            <h3 className="text-sm font-semibold text-zinc-300 mb-1">
              Host Standby — Ready to Pair
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              Connect your mobile device with the random token number above. Once paired, live synchronization and host management will unlock.
            </p>
          </div>
        )}

        {/* Host Status & Telemetry Footer Strip */}
        <div className="p-2.5 bg-[#16181f] border border-[#242833] rounded-lg flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 shrink-0">
          <div className="flex items-center gap-2 text-zinc-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Authenticated Local Session Policy Active</span>
          </div>

          <div className="flex items-center gap-3 text-zinc-500 text-[10px]">
            <span>
              Daemon: <span className="text-zinc-300">{device.daemonVersion || 'Host Companion'}</span>
            </span>
            <span>
              Tunnel:{' '}
              <span className={isConnected ? 'text-emerald-400' : 'text-zinc-400'}>
                {isConnected ? `Connected (${device.pingMs}ms)` : 'Standby'}
              </span>
            </span>
            <span>
              OS: <span className="text-zinc-300">{device.os || 'Windows x64'}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LaptopApp;
