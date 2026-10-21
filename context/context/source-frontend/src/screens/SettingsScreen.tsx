import React, { useState } from 'react';
import { useRelay } from '../context/RelayContext';
import { 
  Settings, 
  Laptop, 
  LogOut, 
  Check 
} from 'lucide-react';

export function SettingsScreen() {
  const { 
    currentUser, 
    device, 
    togglePcOnline, 
    fontSize, 
    setFontSize, 
    disconnectMobile,
    regenerateConnectionKey,
    generatedConnectionKey
  } = useRelay();

  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopyKey = () => {
    navigator.clipboard?.writeText(generatedConnectionKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121419] text-zinc-100 font-sans">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">System & Account Settings</h2>
        </div>
        <p className="text-xs text-zinc-400 mt-0.5">
          Account credentials, connection security, and terminal preferences.
        </p>
      </div>

      {/* 1. Account Section */}
      <div className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#242833] border border-[#323746] flex items-center justify-center font-semibold text-zinc-200 text-xs">
              {currentUser.username[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-100">{currentUser.username}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#20232d] text-zinc-400 border border-[#2c3240]">
                  {currentUser.accountTier}
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">{currentUser.email}</span>
            </div>
          </div>

          <button
            onClick={disconnectMobile}
            className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/20 border border-rose-900/40 rounded-md cursor-pointer transition-colors"
          >
            Sign Out
          </button>
        </div>

        <div className="text-[11px] font-mono text-zinc-500 pt-1.5 border-t border-[#22252e] flex items-center justify-between">
          <span>Session Token: Valid</span>
          <span className="text-emerald-400">Authenticated</span>
        </div>
      </div>

      {/* 2. Windows PC Connection & Key Management */}
      <div className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-zinc-400" />
            <h3 className="text-xs font-semibold text-zinc-100">Paired Windows PC</h3>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
            device.isOnline ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' : 'bg-amber-950/40 text-amber-300 border border-amber-800/40'
          }`}>
            {device.isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="p-2.5 bg-[#121419] rounded border border-[#242732] space-y-1.5 font-mono text-xs">
          <div className="flex justify-between text-zinc-400">
            <span>Host Device:</span>
            <span className="text-zinc-200">{device.deviceName}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Operating System:</span>
            <span className="text-zinc-300">{device.os}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>IP Address & Port:</span>
            <span className="text-zinc-200">{device.ip}:{device.port}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Connection Key:</span>
            <span className="text-zinc-100 font-bold">{generatedConnectionKey}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={togglePcOnline}
            className={`flex-1 py-1.5 rounded-md text-xs cursor-pointer border transition-colors ${
              device.isOnline
                ? 'bg-[#1c1f26] text-amber-300 border-amber-900/50 hover:bg-[#242731]'
                : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40 hover:bg-emerald-900/40'
            }`}
          >
            {device.isOnline ? 'Simulate Disconnect' : 'Reconnect PC'}
          </button>

          <button
            onClick={handleCopyKey}
            className="px-3 py-1.5 bg-[#1c1f26] hover:bg-[#232731] text-zinc-300 border border-[#2b303b] rounded-md text-xs font-mono cursor-pointer transition-colors"
          >
            {copiedKey ? 'Copied' : 'Copy Key'}
          </button>

          <button
            onClick={() => regenerateConnectionKey()}
            className="px-3 py-1.5 bg-[#1c1f26] hover:bg-[#232731] text-zinc-300 border border-[#2b303b] rounded-md text-xs font-mono cursor-pointer transition-colors"
            title="Generate new connection key"
          >
            New Key
          </button>
        </div>
      </div>

      {/* 3. Terminal Preferences */}
      <div className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg space-y-2.5">
        <h3 className="text-xs font-semibold text-zinc-100">Terminal Appearance</h3>

        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">Font Size</span>
          <div className="flex items-center gap-2 bg-[#121419] px-2 py-1 rounded border border-[#242732]">
            <button
              onClick={() => setFontSize((s) => Math.max(10, s - 1))}
              className="text-zinc-400 hover:text-white px-1 font-mono cursor-pointer"
            >
              -
            </button>
            <span className="text-xs font-mono text-zinc-200">{fontSize}px</span>
            <button
              onClick={() => setFontSize((s) => Math.min(18, s + 1))}
              className="text-zinc-400 hover:text-white px-1 font-mono cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
