import React, { useState } from 'react';
import { useRelay } from '../context/RelayContext';
import { 
  Settings, 
  Laptop, 
  Key, 
  RefreshCw, 
  Shield, 
  Type, 
  Copy, 
  Check,
  UserCheck
} from 'lucide-react';

export function SettingsScreen() {
  const { 
    currentUser, 
    loginUser,
    device, 
    togglePcOnline, 
    fontSize, 
    setFontSize, 
    disconnectMobile,
    regenerateConnectionKey,
    generatedConnectionKey
  } = useRelay();

  const [copiedKey, setCopiedKey] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [signInSuccess, setSignInSuccess] = useState<string | null>(null);

  const handleCopyKey = () => {
    navigator.clipboard?.writeText(generatedConnectionKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setIsLoggingIn(true);
    await loginUser(emailInput.trim(), passInput.trim());
    setIsLoggingIn(false);
    setIsSignInOpen(false);
    setSignInSuccess(`Successfully signed in as ${emailInput.trim()}`);
    setTimeout(() => setSignInSuccess(null), 3000);
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

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsSignInOpen(!isSignInOpen)}
              className="px-2.5 py-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/20 border border-blue-900/40 rounded-md cursor-pointer transition-colors"
            >
              Sign In
            </button>

            <button
              onClick={disconnectMobile}
              className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/20 border border-rose-900/40 rounded-md cursor-pointer transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Sign In Form Modal / Collapse */}
        {isSignInOpen && (
          <form onSubmit={handleSignIn} className="p-3 bg-[#121419] border border-[#282d3c] rounded-md space-y-2.5 mt-2">
            <div className="text-[11px] font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Sign In with Your Account</span>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400">Account Email</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="developer@lazyterminal.io"
                required
                autoFocus
                className="w-full px-2.5 py-1.5 text-xs bg-[#181a22] border border-[#2c3140] rounded text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400">Password / Access Key</label>
              <input
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-2.5 py-1.5 text-xs bg-[#181a22] border border-[#2c3140] rounded text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsSignInOpen(false)}
                className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoggingIn || !emailInput.trim()}
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors cursor-pointer"
              >
                {isLoggingIn ? 'Signing In...' : 'Sign In'}
              </button>
            </div>
          </form>
        )}

        {signInSuccess && (
          <div className="p-2 bg-emerald-950/40 border border-emerald-800/40 rounded text-xs text-emerald-300 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>{signInSuccess}</span>
          </div>
        )}

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
            <span>ConPTY Terminal Shell:</span>
            <span className="text-zinc-300">PowerShell 7.4 (ConPTY)</span>
          </div>
        </div>

        {/* Pairing Token Regenerator */}
        <div className="pt-1 border-t border-[#22252e] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-zinc-400" />
              Windows Companion Token
            </span>
            <button
              onClick={() => regenerateConnectionKey()}
              className="text-[11px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
              title="Generate new token"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Regenerate Key</span>
            </button>
          </div>

          <div className="flex items-center justify-between p-2 bg-[#121419] border border-[#242732] rounded font-mono text-xs">
            <span className="text-zinc-300 font-bold tracking-widest">{generatedConnectionKey}</span>
            <button
              onClick={handleCopyKey}
              className="p-1 hover:bg-[#20232c] text-zinc-400 hover:text-zinc-200 rounded cursor-pointer transition-colors"
              title="Copy token to clipboard"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Local PC Simulator Toggle */}
        <div className="pt-2 border-t border-[#22252e] flex items-center justify-between text-xs">
          <div>
            <span className="text-zinc-300 font-medium block">Simulate PC Online/Offline</span>
            <span className="text-[11px] text-zinc-500">Test offline intent queue and reconnection modal</span>
          </div>
          <button
            onClick={togglePcOnline}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
              device.isOnline 
                ? 'bg-[#21242d] hover:bg-[#2a2e3a] text-zinc-300 border border-[#2f3442]' 
                : 'bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-800/40'
            }`}
          >
            {device.isOnline ? 'Set Offline' : 'Set Online'}
          </button>
        </div>
      </div>

      {/* 3. Terminal & Editor Preferences */}
      <div className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-zinc-400" />
          <h3 className="text-xs font-semibold text-zinc-100">Editor & Terminal Typography</h3>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">Terminal Font Size</span>
          <div className="flex items-center gap-1 font-mono">
            {[11, 13, 15].map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`px-2.5 py-1 rounded text-xs cursor-pointer transition-colors ${
                  fontSize === size
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-[#1b1e26] text-zinc-400 hover:text-zinc-200 border border-[#272a34]'
                }`}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Security Policy */}
      <div className="p-3 bg-[#13151a] border border-[#20232c] rounded-lg flex items-center gap-3 text-xs text-zinc-400 font-mono">
        <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>End-to-End Encrypted over LAN · Zero mandatory cloud relay</span>
      </div>
    </div>
  );
}

export default SettingsScreen;
