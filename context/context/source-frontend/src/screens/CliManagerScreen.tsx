import React, { useState } from 'react';
import { useRelay } from '../context/RelayContext';
import { AiCliTool } from '../types/relay';
import { 
  Sparkles, 
  Cpu, 
  Terminal, 
  ShieldCheck, 
  ShieldAlert, 
  Check, 
  Play, 
  Download, 
  Lock, 
  Loader2, 
  X 
} from 'lucide-react';

interface CliManagerScreenProps {
  onSwitchToTerminal: () => void;
}

export function CliManagerScreen({ onSwitchToTerminal }: CliManagerScreenProps) {
  const { cliTools, installCliTool, createSession, sessions, setActiveSessionId } = useRelay();

  const [selectedToolForAuth, setSelectedToolForAuth] = useState<AiCliTool | null>(null);
  const [userConfirmedTrust, setUserConfirmedTrust] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleLaunch = (tool: AiCliTool) => {
    const existing = sessions.find((s) => s.type === tool.id as any);
    if (existing) {
      setActiveSessionId(existing.id);
    } else {
      const sessionType = 
        tool.id === 'claude' ? 'claude' : 
        tool.id === 'codex' ? 'codex' : 
        tool.id === 'gemini' ? 'gemini' : 
        tool.id === 'antigravity' ? 'antigravity' : 'powershell';
      createSession(`${tool.name}`, sessionType);
    }
    onSwitchToTerminal();
  };

  const handleAuthorizeInstall = async () => {
    if (!selectedToolForAuth) return;
    setIsInstalling(true);
    await installCliTool(selectedToolForAuth.id);
    setIsInstalling(false);
    setSelectedToolForAuth(null);
    setUserConfirmedTrust(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121419] text-zinc-100 font-sans">
      {/* Header Info */}
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">AI CLI Manager & Catalog</h2>
        </div>
        <p className="text-xs text-zinc-400">
          Supervise, authorize, and steer AI coding agents executing natively on your Windows PC.
        </p>
      </div>

      {/* Security Callout */}
      <div className="p-3 bg-[#16181e] border border-[#252831] rounded-lg flex items-start gap-3">
        <div className="p-2 bg-[#1c1f26] border border-[#2b303b] text-zinc-300 rounded-md shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="space-y-0.5 text-xs">
          <div className="font-semibold text-zinc-200">Security & Authorization Protocol</div>
          <p className="text-zinc-400 text-[11px] leading-relaxed">
            No agent installs or code updates execute without an explicit, human-readable preview and signed user confirmation.
          </p>
        </div>
      </div>

      {/* Agents Catalog List */}
      <div className="space-y-2.5">
        {cliTools.map((tool) => {
          const isInstalled = tool.status === 'installed' || tool.status === 'running';

          return (
            <div
              key={tool.id}
              className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg space-y-2.5"
            >
              {/* Top Row: Title + Status + Vendor */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-2 rounded bg-[#1c1f26] border border-[#2b303b] text-zinc-400 shrink-0">
                    {tool.id === 'claude' ? (
                      <Sparkles className="w-4 h-4" />
                    ) : tool.id === 'codex' ? (
                      <Cpu className="w-4 h-4" />
                    ) : (
                      <Terminal className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-white">{tool.name}</h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#20232d] text-zinc-400 border border-[#2c3240]">
                        {tool.cliName}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 flex items-center gap-2 mt-0.5">
                      <span>{tool.vendor}</span>
                      <span>·</span>
                      <span className="font-mono">{tool.version}</span>
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="shrink-0">
                  {isInstalled ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                      <Check className="w-3 h-3 text-emerald-400" /> Installed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-400">
                      Available
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-zinc-400 leading-relaxed">{tool.description}</p>

              {/* Capabilities & Permissions */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-zinc-500 font-mono text-[11px]">Capabilities:</span>
                  {tool.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-1.5 py-0.2 bg-[#1c1f26] text-zinc-300 rounded text-[10px] font-mono border border-[#282b35]"
                    >
                      {cap}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono">
                  <Lock className="w-3 h-3 text-zinc-500" />
                  <span>Sandbox: {tool.permissionsRequired.join(', ')}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[#22252e] flex items-center justify-between">
                <span className="text-[11px] font-mono text-zinc-500">
                  Target: <span className="text-zinc-300">{tool.installScope}</span>
                </span>

                <div className="flex items-center gap-2">
                  {isInstalled ? (
                    <button
                      onClick={() => handleLaunch(tool)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3" /> Launch in Terminal
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedToolForAuth(tool);
                        setUserConfirmedTrust(false);
                      }}
                      className="px-3 py-1 bg-[#1c1f26] hover:bg-[#232731] text-zinc-200 border border-[#2b303b] rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> Install on PC
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Authorization Modal */}
      {selectedToolForAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#1c1f26] border border-[#2b303b] rounded-md">
                  <ShieldAlert className="w-5 h-5 text-zinc-300" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Security Authorization</h3>
                  <p className="text-xs text-zinc-400">
                    Authorize installation of {selectedToolForAuth.name} on Windows PC
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedToolForAuth(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-[#111318] border border-[#252831] rounded-md space-y-1">
                <div className="text-zinc-500 text-[10px] font-mono uppercase">
                  Execution Command
                </div>
                <div className="font-mono text-zinc-100 text-xs bg-[#16181e] p-2 rounded border border-[#242732] select-all">
                  {selectedToolForAuth.installCommand}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-300">
                <div className="p-2 bg-[#111318] rounded border border-[#252831]">
                  <span className="text-zinc-500 block text-[10px]">Vendor</span>
                  <span className="text-white">{selectedToolForAuth.vendor}</span>
                </div>
                <div className="p-2 bg-[#111318] rounded border border-[#252831]">
                  <span className="text-zinc-500 block text-[10px]">Version</span>
                  <span className="text-zinc-200">{selectedToolForAuth.version}</span>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 font-sans">
              <input
                type="checkbox"
                checked={userConfirmedTrust}
                onChange={(e) => setUserConfirmedTrust(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span>I confirm authorization of this native CLI installation</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242732]">
              <button
                onClick={() => setSelectedToolForAuth(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!userConfirmedTrust || isInstalling}
                onClick={handleAuthorizeInstall}
                className={`px-4 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  userConfirmedTrust && !isInstalling
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-[#22252e] text-zinc-600 cursor-not-allowed'
                }`}
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Installing...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Authorize & Install
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
