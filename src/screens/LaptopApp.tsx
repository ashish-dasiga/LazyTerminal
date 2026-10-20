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
  Cpu,
  Activity
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

const INITIAL_SYNC_REQUESTS: SyncRequestRecord[] = [
  {
    id: 'SYNC-REQ-104',
    timestamp: '2026-10-14 14:01:15',
    timeAgo: '2 mins ago',
    status: 'success',
    itemsSynced: 3,
    trigger: 'manual_desktop',
    summary: 'Offline intent queue flushed & causal graph synced with host',
    headCommit: '3f7a8b1',
  },
  {
    id: 'SYNC-REQ-103',
    timestamp: '2026-10-14 13:45:22',
    timeAgo: '18 mins ago',
    status: 'success',
    itemsSynced: 2,
    trigger: 'mobile_auto',
    summary: 'Workspace file tree & dirty state synced across tunnel',
    headCommit: '3f7a8b1',
  },
  {
    id: 'SYNC-REQ-102',
    timestamp: '2026-10-14 12:58:04',
    timeAgo: '1 hour ago',
    status: 'success',
    itemsSynced: 5,
    trigger: 'periodic',
    summary: 'Branch checkout and remote ref synchronization',
    headCommit: 'a9c210d',
  },
  {
    id: 'SYNC-REQ-101',
    timestamp: '2026-10-14 11:15:30',
    timeAgo: '3 hours ago',
    status: 'success',
    itemsSynced: 1,
    trigger: 'manual_desktop',
    summary: 'Initial connection handshake & token authentication',
    headCommit: '5e4b219',
  },
];

export function LaptopApp() {
  const { 
    device, 
    toggleBackendServer, 
    generatedConnectionKey, 
    regenerateConnectionKey,
    reconcileAllIntents,
    setActiveFrontend,
    intentQueue
  } = useRelay();

  // 1) Token Window State
  const [tokenCopied, setTokenCopied] = useState(false);
  const tokenNumber = generatedConnectionKey;

  // 2) Server status
  const isServerRunning = device.backendServerStatus === 'running';

  // 3) Sync Request & Dropdown State
  const [syncRequests, setSyncRequests] = useState<SyncRequestRecord[]>(INITIAL_SYNC_REQUESTS);
  const [selectedSyncId, setSelectedSyncId] = useState<string>(INITIAL_SYNC_REQUESTS[0].id);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessToast, setSyncSuccessToast] = useState<string | null>(null);

  // Generate a new random token number
  const handleGenerateRandomToken = () => {
    regenerateConnectionKey();
  };

  const handleCopyToken = () => {
    navigator.clipboard?.writeText(generatedConnectionKey);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  // Trigger Sync Request
  const handleSyncRequest = async () => {
    setIsSyncing(true);
    try {
      await reconcileAllIntents();
      
      const newSyncId = `SYNC-REQ-${105 + syncRequests.length - 4}`;
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const newRecord: SyncRequestRecord = {
        id: newSyncId,
        timestamp: `${now.toISOString().split('T')[0]} ${timeStr}`,
        timeAgo: 'Just now',
        status: 'success',
        itemsSynced: intentQueue.length > 0 ? intentQueue.length : 1,
        trigger: 'manual_desktop',
        summary: `Synchronized workspace state & ${intentQueue.length > 0 ? intentQueue.length + ' intents' : 'working tree commits'}`,
        headCommit: '3f7a8b1',
      };

      setSyncRequests([newRecord, ...syncRequests]);
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
          <span className="font-semibold text-zinc-200">
            Relay Desktop Host — Windows
          </span>
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

      {/* Main Single-Screen Content (Clean, Focused, Uncluttered) */}
      <div className="flex-1 p-5 md:p-6 flex flex-col justify-between gap-5 overflow-hidden bg-[#14161c]">
        {/* Optional Toast Notification */}
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

        {/* 1) Token Window (Small Window with Random Token Number) */}
        <div className="bg-[#1a1d24] border border-[#282d38] rounded-lg shadow-sm flex flex-col overflow-hidden">
          <div className="h-7.5 bg-[#15181f] border-b border-[#242833] px-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-200">Token Window</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Backend Bound</span>
          </div>

          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block">
                Random Token Number
              </span>
              <div className="text-2xl font-mono font-bold text-white tracking-widest leading-none py-0.5">
                {tokenNumber}
              </div>
              <p className="text-[11px] text-zinc-500">
                Dynamic pairing token (will later be updated according to the backend).
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyToken}
                className="px-3 py-1.5 bg-[#1e222b] hover:bg-[#292f3b] text-zinc-200 hover:text-white rounded-md border border-[#2e3442] cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-medium"
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
            </div>
          </div>
        </div>

        {/* 2) Server Control & 3) Sync Manager (Side by Side Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* 2) Server Control Window */}
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
                <span className="text-zinc-200 font-semibold">9871 (TCP TLS)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Host IP:</span>
                <span className="text-zinc-300">{device.ip}</span>
              </div>
            </div>

            {/* Start / Stop Server Button */}
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

          {/* 3) Sync Manager Window */}
          <div className="md:col-span-7 bg-[#1a1d24] border border-[#282d38] rounded-lg shadow-sm flex flex-col justify-between p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <SyncIcon className="w-3.5 h-3.5 text-blue-400" /> Sync Manager
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {syncRequests.length} sync requests recorded
              </span>
            </div>

            {/* Sync Request Button + Previous Syncs Dropdown */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                onClick={handleSyncRequest}
                disabled={isSyncing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-md text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-sm shrink-0"
              >
                <SyncIcon className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Request'}</span>
              </button>

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
            </div>

            {/* Selected Sync Request Details */}
            {selectedSync && (
              <div className="p-2.5 bg-[#121418] border border-[#222630] rounded-md space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-200 font-semibold">{selectedSync.id}</span>
                  <span className="text-zinc-500">{selectedSync.timestamp}</span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate">
                  {selectedSync.summary}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Host Status & Telemetry Footer Strip */}
        <div className="p-2.5 bg-[#16181f] border border-[#242833] rounded-lg flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 shrink-0">
          <div className="flex items-center gap-2 text-zinc-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ed25519 Mutual TLS Verification Active</span>
          </div>

          <div className="flex items-center gap-3 text-zinc-500 text-[10px]">
            <span>Daemon: <span className="text-zinc-300">{device.daemonVersion.split(' ')[0]}</span></span>
            <span>Tunnel: <span className="text-emerald-400">Connected ({device.pingMs}ms)</span></span>
            <span>OS: <span className="text-zinc-300">Windows 11 x64</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LaptopApp;
