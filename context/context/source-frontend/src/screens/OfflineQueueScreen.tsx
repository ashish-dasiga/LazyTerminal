import React, { useState } from 'react';
import { useRelay } from '../context/RelayContext';
import { 
  Database, 
  Clock, 
  Play, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Wifi, 
  WifiOff, 
  Layers, 
  Loader2, 
  Cloud, 
  Sparkles, 
  Send 
} from 'lucide-react';

interface OfflineQueueScreenProps {
  onSwitchToTerminal: () => void;
}

export function OfflineQueueScreen({ onSwitchToTerminal: _onSwitchToTerminal }: OfflineQueueScreenProps) {
  const {
    intentQueue,
    device,
    togglePcOnline,
    reconcileSingleIntent,
    reconcileAllIntents,
    clearIntentQueue,
    executeCommand,
  } = useRelay();

  const [activeTab, setActiveTab] = useState<'queue' | 'draft' | 'cloud' | 'sqlite_inspector'>('queue');
  const [draftCommand, setDraftCommand] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [cloudModeEnabled, setCloudModeEnabled] = useState(false);
  const [cloudEndpoint, setCloudEndpoint] = useState('https://cloud-relay.enterprise.internal/v1');
  const [cloudAuthStatus, setCloudAuthStatus] = useState<'not_configured' | 'verifying' | 'connected'>('not_configured');

  const pendingIntents = intentQueue.filter((i) => i.status === 'queued' || i.status === 'diverged');
  const reconciledIntents = intentQueue.filter((i) => i.status === 'reconciled' || i.status === 'skipped');

  const handleQueueDraft = (cmd: string) => {
    if (!cmd.trim()) return;
    executeCommand(cmd.trim());
    setDraftCommand('');
    setDraftPrompt('');
    setActiveTab('queue');
  };

  const handleTestCloudConnection = () => {
    setCloudAuthStatus('verifying');
    setTimeout(() => {
      setCloudAuthStatus('connected');
    }, 900);
  };

  return (
    <div className="flex-1 w-full overflow-y-auto p-4 space-y-4 bg-[#121419] text-zinc-100 font-sans">
      {/* 1. Header Info (Full Width) */}
      <div className="w-full">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-zinc-400 shrink-0" />
          <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">
            Offline Queue
          </h2>
        </div>
        <p className="text-xs text-zinc-400 mt-1 leading-normal">
          View commands saved while your PC is offline and check their sync status.
        </p>
      </div>

      {/* 2. Tab switcher (Horizontal scroll confined to tab bar) */}
      <div className="w-full overflow-x-auto no-scrollbar pb-0.5">
        <div className="inline-flex items-center p-0.5 bg-[#181a21] rounded-md border border-[#262a33] text-xs font-medium">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 rounded transition-colors cursor-pointer shrink-0 ${
              activeTab === 'queue'
                ? 'bg-[#242833] text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Queue ({pendingIntents.length})
          </button>
          <button
            onClick={() => setActiveTab('draft')}
            className={`px-3 py-1.5 rounded transition-colors cursor-pointer shrink-0 ${
              activeTab === 'draft'
                ? 'bg-[#242833] text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Drafts
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
              activeTab === 'cloud'
                ? 'bg-[#242833] text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud</span>
          </button>
          <button
            onClick={() => setActiveTab('sqlite_inspector')}
            className={`px-3 py-1.5 rounded transition-colors cursor-pointer shrink-0 ${
              activeTab === 'sqlite_inspector'
                ? 'bg-[#242833] text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            SQLite WAL
          </button>
        </div>
      </div>

      {/* 3. State Presence Banner */}
      <div className="w-full p-3.5 rounded-lg border border-[#252831] bg-[#16181e] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-[#1c1f26] border border-[#2b303b] rounded-md text-zinc-400 shrink-0">
            {device.isOnline ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-amber-400" />}
          </div>
          <div className="text-xs min-w-0">
            <div className="font-semibold text-zinc-100">
              {device.isReconciling ? 'Syncing' : device.isOnline ? 'PC online' : 'PC offline'}
            </div>
            <div className="text-zinc-400 text-[11px] font-mono mt-0.5 truncate">
              {device.isReconciling
                ? 'Syncing queued commands with your PC...'
                : device.isOnline
                ? pendingIntents.length > 0
                  ? `${pendingIntents.length} command(s) waiting to sync.`
                  : 'All commands synced.'
                : 'Commands saved locally until PC reconnects.'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!device.isOnline && (
            <button
              onClick={togglePcOnline}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors cursor-pointer"
            >
              Reconnect PC
            </button>
          )}

          {device.isOnline && pendingIntents.length > 0 && (
            <button
              onClick={() => reconcileAllIntents(false)}
              disabled={device.isReconciling}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {device.isReconciling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Syncing</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Sync All ({pendingIntents.length})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: QUEUE LIST */}
      {activeTab === 'queue' && (
        <div className="w-full space-y-3 animate-in fade-in duration-100">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Waiting to sync ({pendingIntents.length})</span>
            {pendingIntents.length > 0 && (
              <button
                onClick={clearIntentQueue}
                className="hover:text-rose-400 text-[11px] cursor-pointer"
              >
                Discard All
              </button>
            )}
          </div>

          {pendingIntents.length === 0 ? (
            <div className="p-8 text-center bg-[#16181e] border border-[#252831] rounded-lg space-y-2">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
              <h4 className="text-xs font-semibold text-white">Queue Empty</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                No commands waiting to sync. Commands drafted while your PC is offline will appear here.
              </p>
              <div className="pt-1">
                <button
                  onClick={() => setActiveTab('draft')}
                  className="px-3 py-1.5 bg-[#1c1f26] hover:bg-[#232731] text-zinc-200 border border-[#2b303b] rounded-md text-xs cursor-pointer transition-colors"
                >
                  Draft an Offline Command
                </button>
              </div>
            </div>
          ) : (
            pendingIntents.map((intent) => (
              <div
                key={intent.id}
                className="p-3 bg-[#16181e] border border-[#252831] rounded-lg space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-[#20232d] text-zinc-300 font-mono text-xs border border-[#2c3240] shrink-0">
                      #{String(intent.seq).padStart(2, '0')}
                    </span>
                    <span className="text-xs font-semibold text-white truncate">{intent.projectName}</span>
                    <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                      ({intent.expectedBaseBranch})
                    </span>
                  </div>

                  {device.isReconciling ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/40 text-blue-300 border border-blue-800/40 flex items-center gap-1 shrink-0">
                      <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                      <span>Syncing</span>
                    </span>
                  ) : intent.status === 'diverged' ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-800/40 flex items-center gap-1 shrink-0">
                      <AlertCircle className="w-3 h-3 text-rose-400" />
                      <span>Sync failed</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>Waiting to sync</span>
                    </span>
                  )}
                </div>

                <div className="p-2 bg-[#111318] rounded border border-[#242732] font-mono text-xs text-zinc-200 break-all">
                  <span className="text-zinc-500 mr-2">$</span>
                  {intent.command}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1 border-t border-[#22252e]">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Hash: <span className="text-zinc-400">{intent.causalDependencyHash}</span></span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => reconcileSingleIntent(intent.id, 'cancel')}
                      className="p-1 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Discard command"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => reconcileSingleIntent(intent.id, 'skip')}
                      className="px-2 py-0.5 bg-[#1c1f26] hover:bg-[#232731] text-zinc-300 rounded text-[11px] transition-colors cursor-pointer border border-[#2b303b]"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => reconcileSingleIntent(intent.id, 'run')}
                      disabled={!device.isOnline || device.isReconciling}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                        device.isOnline && !device.isReconciling
                          ? 'bg-blue-600 hover:bg-blue-500 text-white'
                          : 'bg-[#1c1f26] text-zinc-600 border border-[#252831] cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-3 h-3" />
                      <span>Sync Now</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Historical intents */}
          {reconciledIntents.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <div className="text-xs text-zinc-400 px-1 font-medium">
                Synced ({reconciledIntents.length})
              </div>
              {reconciledIntents.map((intent) => (
                <div
                  key={intent.id}
                  className="p-2.5 bg-[#16181e] border border-[#242732] rounded-lg flex items-center justify-between text-xs font-mono text-zinc-400"
                >
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-zinc-300 truncate">{intent.command}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 shrink-0 font-medium">
                    Synced
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DRAFTS */}
      {activeTab === 'draft' && (
        <div className="w-full space-y-3 animate-in fade-in duration-100">
          <div className="p-4 bg-[#16181e] border border-[#252831] rounded-lg space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-white">Draft Offline Commands & Prompts</h3>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                Save commands locally while your PC is offline. They will wait in the queue to sync once connected.
              </p>
            </div>

            {/* Quick Shell Command Draft */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-medium text-zinc-300">Shell Command</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draftCommand}
                  onChange={(e) => setDraftCommand(e.target.value)}
                  placeholder="e.g. cargo test --release"
                  className="flex-1 h-9 px-3 bg-[#111318] border border-[#2b303b] focus:border-blue-500 rounded-md text-xs font-mono text-zinc-100 outline-none"
                />
                <button
                  onClick={() => handleQueueDraft(draftCommand)}
                  disabled={!draftCommand.trim()}
                  className="px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  <span>Queue</span>
                </button>
              </div>
            </div>

            {/* AI Agent Prompt Draft */}
            <div className="space-y-1.5 pt-2 border-t border-[#22252e]">
              <label className="text-xs font-medium text-zinc-300">Agent Prompt (Claude Code / Codex / Gemini CLI)</label>
              <textarea
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                placeholder="e.g. claude 'Refactor WebSocket reconnect retry loop to use exponential backoff with jitter'"
                className="w-full h-20 p-2.5 bg-[#111318] border border-[#2b303b] focus:border-blue-500 rounded-md text-xs font-mono text-zinc-100 outline-none resize-none"
              />
              <button
                onClick={() => handleQueueDraft(draftPrompt)}
                disabled={!draftPrompt.trim()}
                className="w-full h-9 bg-[#1c1f26] hover:bg-[#232731] text-zinc-200 border border-[#2b303b] text-xs font-medium rounded-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                <span>Save to Offline Queue</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLOUD */}
      {activeTab === 'cloud' && (
        <div className="w-full space-y-3 animate-in fade-in duration-100">
          <div className="p-4 bg-[#16181e] border border-[#252831] rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-zinc-400" />
                  <h3 className="text-xs font-semibold text-white">Optional Cloud Mode Relay</h3>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Execute queued tasks via Cloud runner when PC is offline.
                </p>
              </div>

              {/* Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-mono text-zinc-400">
                  {cloudModeEnabled ? 'CONFIGURED' : 'DISABLED'}
                </span>
                <input
                  type="checkbox"
                  checked={cloudModeEnabled}
                  onChange={(e) => setCloudModeEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 text-blue-600 focus:ring-0 cursor-pointer"
                />
              </label>
            </div>

            {cloudModeEnabled ? (
              <div className="space-y-3 pt-2 border-t border-[#22252e]">
                <div className="p-3 bg-[#111318] border border-[#262a34] rounded-md text-xs text-zinc-300">
                  Cloud mode active: When Windows PC is unreachable, designated cloud VM executes non-host-dependent tasks.
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-300">Cloud Relay Endpoint</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cloudEndpoint}
                      onChange={(e) => setCloudEndpoint(e.target.value)}
                      className="flex-1 h-9 px-3 bg-[#111318] border border-[#2b303b] rounded-md text-xs font-mono text-zinc-100 outline-none"
                    />
                    <button
                      onClick={handleTestCloudConnection}
                      className="px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium cursor-pointer"
                    >
                      Verify
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono pt-1 text-zinc-400">
                  <span>Cloud Fallback Status:</span>
                  <span className={cloudAuthStatus === 'connected' ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                    {cloudAuthStatus === 'connected' ? 'Active & Ready' : cloudAuthStatus === 'verifying' ? 'Verifying...' : 'Ready for Auth'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#111318] border border-[#22252e] rounded-md text-xs text-zinc-500 text-center font-mono">
                Cloud Mode is currently unconfigured. All execution is strictly routed to your local Windows PC when online.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SQLITE WAL */}
      {activeTab === 'sqlite_inspector' && (
        <div className="w-full p-4 bg-[#16181e] border border-[#252831] rounded-lg space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#22252e] pb-2">
            <span className="text-white font-semibold flex items-center gap-1.5">
              <Database className="w-4 h-4 text-zinc-400" /> Local SQLite Schema: `intents_wal.db`
            </span>
            <span className="text-zinc-500 text-[10px]">WAL mode: PRAGMA journal_mode=WAL;</span>
          </div>

          <div className="p-3 bg-[#111318] rounded-md border border-[#22252e] space-y-2 text-[11px] text-zinc-300">
            <div className="text-zinc-500">-- Schema DDL definition</div>
            <pre className="text-zinc-300 overflow-x-auto text-[10px] leading-relaxed font-mono">
{`CREATE TABLE durable_intents (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  intent_id TEXT NOT NULL UNIQUE,
  command TEXT NOT NULL,
  working_dir TEXT NOT NULL,
  base_branch TEXT NOT NULL,
  causal_hash TEXT NOT NULL,
  status TEXT CHECK(status IN ('queued','reconciled','skipped')) DEFAULT 'queued',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`}
            </pre>
          </div>

          <div className="text-xs text-zinc-400 leading-relaxed font-sans">
            Every command or prompt typed while the Windows host is disconnected is stored with local durability on the phone until reconnected.
          </div>
        </div>
      )}
    </div>
  );
}
