import React, { useState } from 'react';
import { useRelay } from '../context/RelayContext';
import { 
  Sparkles, 
  Database, 
  Laptop, 
  ChevronRight, 
  Sliders, 
  Trash2, 
  Plus, 
  Play,
  ArrowLeft 
} from 'lucide-react';
import { OfflineQueueScreen } from './OfflineQueueScreen';
import { CliManagerScreen } from './CliManagerScreen';

interface MoreScreenProps {
  onNavigateSubScreen?: (screen: 'cli_manager' | 'queue' | 'pairing') => void;
  onSwitchToTerminal: () => void;
}

export function MoreScreen({ onSwitchToTerminal }: MoreScreenProps) {
  const { 
    device, 
    togglePcOnline, 
    intentQueue, 
    setMobileNav,
    addDraftIntent,
    reconcileAllIntents,
    clearIntentQueue
  } = useRelay();

  const [activeSubView, setActiveSubView] = useState<'main' | 'queue_detail' | 'cli_catalog'>('main');
  const [draftCmd, setDraftCmd] = useState('');

  const queuedCount = intentQueue.filter(
    (i) => i.status === 'queued' || i.status === 'diverged'
  ).length;

  const handleAddDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftCmd.trim()) return;
    addDraftIntent(draftCmd.trim());
    setDraftCmd('');
  };

  if (activeSubView === 'queue_detail') {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#121419]">
        <div className="p-3 bg-[#16181e] border-b border-[#252831] flex items-center justify-between shrink-0">
          <button
            onClick={() => setActiveSubView('main')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white bg-[#1c1f26] hover:bg-[#232731] border border-[#2b303b] rounded-md transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-zinc-400" />
            <span>Back to More Options</span>
          </button>
          <span className="text-xs text-zinc-400 font-medium">Offline Queue</span>
        </div>
        <OfflineQueueScreen onSwitchToTerminal={() => {
          setActiveSubView('main');
          setMobileNav('terminal');
        }} />
      </div>
    );
  }

  if (activeSubView === 'cli_catalog') {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#121419]">
        <div className="p-3 bg-[#16181e] border-b border-[#252831] flex items-center justify-between shrink-0">
          <button
            onClick={() => setActiveSubView('main')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white bg-[#1c1f26] hover:bg-[#232731] border border-[#2b303b] rounded-md transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-zinc-400" />
            <span>Back to More Options</span>
          </button>
          <span className="text-xs text-zinc-400 font-medium">CLI Tools & Permissions</span>
        </div>
        <CliManagerScreen onSwitchToTerminal={() => {
          setActiveSubView('main');
          setMobileNav('terminal');
        }} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121419] text-zinc-100 font-sans">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">More Options & Offline Engine</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Local SQLite queue, offline drafting, cloud fallback, and diagnostics
        </p>
      </div>

      {/* PC Disconnect / Reconnect Simulation Card */}
      <div className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-[#1c1f26] border border-[#2b303b] text-zinc-400">
            <Laptop className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-100">{device.deviceName}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                device.isOnline ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' : 'bg-amber-950/40 text-amber-300 border border-amber-800/40'
              }`}>
                {device.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
              {device.isOnline ? `${device.ip} · ${device.pingMs}ms latency` : 'Commands buffered to local queue'}
            </div>
          </div>
        </div>

        <button
          onClick={togglePcOnline}
          className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
            device.isOnline
              ? 'bg-[#1c1f26] hover:bg-[#232731] text-amber-300 border-amber-900/50'
              : 'bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-200 border-emerald-800/50'
          }`}
          title="Toggle PC network state to demonstrate offline queueing"
        >
          {device.isOnline ? 'Go Offline' : 'Reconnect PC'}
        </button>
      </div>

      {/* Offline Mode Quick Drafting Box */}
      <div className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-zinc-400" />
            <h3 className="text-xs font-semibold text-zinc-100">Draft Offline Commands & Prompts</h3>
          </div>
          <button
            onClick={() => setActiveSubView('queue_detail')}
            className="text-[11px] text-blue-400 hover:underline cursor-pointer"
          >
            View Full Queue ({queuedCount})
          </button>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Draft commands and agent prompts locally while your PC is off. They are queued and stored until connection is restored.
        </p>

        <form onSubmit={handleAddDraft} className="flex gap-2">
          <input
            type="text"
            value={draftCmd}
            onChange={(e) => setDraftCmd(e.target.value)}
            placeholder="e.g. npm test or git rebase main"
            className="flex-1 h-9 px-3 bg-[#111318] border border-[#2b303b] focus:border-blue-500 rounded-md text-xs font-mono text-zinc-100 outline-none"
          />
          <button
            type="submit"
            disabled={!draftCmd.trim()}
            className="px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs rounded-md flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Queue
          </button>
        </form>

        {queuedCount > 0 && device.isOnline && (
          <div className="pt-2 border-t border-[#242732] flex items-center justify-between">
            <span className="text-[11px] text-emerald-400 font-mono">PC is back online!</span>
            <button
              onClick={() => reconcileAllIntents(true)}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md cursor-pointer flex items-center gap-1"
            >
              <Play className="w-3 h-3 text-white" /> Execute Queue Now
            </button>
          </div>
        )}
      </div>

      {/* Navigation to Detailed Cockpits */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-zinc-400 px-1">
          Extended Options
        </span>

        {/* 1. Open Detailed Offline Queue Screen */}
        <button
          onClick={() => setActiveSubView('queue_detail')}
          className="w-full p-3 bg-[#16181e] hover:bg-[#1e2129] border border-[#252831] rounded-lg flex items-center justify-between transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1c1f26] text-zinc-400 rounded-md border border-[#2b303b]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-100">Offline Queue & Cloud Mode</span>
                {queuedCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                    {queuedCount} pending
                  </span>
                )}
              </div>
              <div className="text-[11px] text-zinc-400">Durable SQLite WAL ledger and cloud relay configuration</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>

        {/* 2. CLI Manager & Catalog */}
        <button
          onClick={() => setActiveSubView('cli_catalog')}
          className="w-full p-3 bg-[#16181e] hover:bg-[#1e2129] border border-[#252831] rounded-lg flex items-center justify-between transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1c1f26] text-zinc-400 rounded-md border border-[#2b303b]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-100">CLI Tools & Permissions</div>
              <div className="text-[11px] text-zinc-400">Claude Code, Codex, and Gemini CLI discovery</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>

        {/* 3. Navigate to Settings */}
        <button
          onClick={() => setMobileNav('settings')}
          className="w-full p-3 bg-[#16181e] hover:bg-[#1e2129] border border-[#252831] rounded-lg flex items-center justify-between transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1c1f26] text-zinc-400 rounded-md border border-[#2b303b]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-100">App & Terminal Settings</div>
              <div className="text-[11px] text-zinc-400">Account info, font size, and preferences</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>

        {/* 4. Clear Queue option */}
        {queuedCount > 0 && (
          <button
            onClick={clearIntentQueue}
            className="w-full p-3 bg-[#16181e] hover:bg-rose-950/20 border border-[#252831] rounded-lg flex items-center justify-between transition-colors text-left cursor-pointer text-rose-400"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-950/40 text-rose-400 rounded-md">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-rose-300">Clear Offline Queue</div>
                <div className="text-[11px] text-zinc-400">Discard all {queuedCount} buffered intent(s)</div>
              </div>
            </div>
            <span className="text-xs font-mono">Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
