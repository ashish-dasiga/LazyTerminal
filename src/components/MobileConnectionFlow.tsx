import React, { useState } from 'react';
import { useRelay } from '../context/RelayContext';
import { 
  Key, 
  Lock, 
  Laptop, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  Check,
  Wifi,
  BatteryMedium
} from 'lucide-react';

export function MobileConnectionFlow() {
  const { 
    connectionStep, 
    connectionError, 
    setConnectionError, 
    connectWithKey, 
    generatedConnectionKey,
    setActiveFrontend
  } = useRelay();

  const [tokenInput, setTokenInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setIsVerifying(true);
    await connectWithKey(tokenInput.trim());
    setIsVerifying(false);
  };

  const handleAutoFill = () => {
    setTokenInput(generatedConnectionKey);
    setConnectionError(null);
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-4 sm:p-5 bg-[#121419] text-zinc-100 font-sans select-none overflow-y-auto">
      {/* Android Phone Top Status Bar */}
      <div className="flex items-center justify-between text-xs text-zinc-400 font-mono pt-1 pb-3 px-1 border-b border-[#20232b]">
        <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
          <span>09:41</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
          <span>5G</span>
          <Wifi className="w-3.5 h-3.5 text-zinc-400" />
          <BatteryMedium className="w-4 h-4 text-zinc-400" />
        </div>
      </div>

      {/* Centered Token Entry Box */}
      <div className="my-auto py-6 max-w-sm w-full mx-auto">
        <div className="bg-[#181a22] border border-[#272b36] rounded-xl shadow-2xl p-5 sm:p-6 space-y-5">
          {/* Box Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/25 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
              <Key className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-bold text-white tracking-tight">
              Enter Token Number
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
              Please enter the random token number given in the laptop app to open the mobile control plane.
            </p>
          </div>

          {/* Reference Helper: Active Laptop Token */}
          <div className="p-3 bg-[#13151b] border border-[#242733] rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5 text-[11px]">
                <Laptop className="w-3.5 h-3.5 text-zinc-400" /> Laptop App Token
              </span>
              <button
                type="button"
                onClick={handleAutoFill}
                className="text-[11px] font-mono text-blue-400 hover:text-blue-300 cursor-pointer transition-colors flex items-center gap-1"
                title="Autofill token from laptop app"
              >
                <span>Fill Token</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-[#181b23] px-3 py-2 rounded border border-[#2b303d]">
              <span className="text-[11px] text-zinc-400 font-mono">Current Code:</span>
              <span className="text-sm font-mono font-bold tracking-widest text-emerald-400">
                {generatedConnectionKey}
              </span>
            </div>
          </div>

          {/* Error Message Box (if validation fails) */}
          {connectionError && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-lg flex items-start gap-2.5 text-xs text-rose-200 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-snug">{connectionError}</div>
            </div>
          )}

          {/* Token Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider block">
                Random Token Number
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    if (connectionError) setConnectionError(null);
                  }}
                  placeholder={generatedConnectionKey || '784-291'}
                  required
                  autoFocus
                  className="w-full h-12 px-4 bg-[#121419] border border-[#2e3342] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 rounded-lg text-base font-mono font-bold tracking-widest text-center text-white placeholder:text-zinc-600 outline-none transition-colors"
                />
                <Key className="w-4 h-4 text-zinc-500 absolute left-3.5 top-4 pointer-events-none" />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!tokenInput.trim() || isVerifying}
              className={`w-full h-11 rounded-lg font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm ${
                tokenInput.trim() && !isVerifying
                  ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white'
                  : 'bg-[#1e222c] text-zinc-500 border border-[#2b303d] cursor-not-allowed'
              }`}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Verifying Token...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Validate & Open Mobile UI</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Helper Button: Switch to Laptop App */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => setActiveFrontend('laptop')}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1"
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Need to check laptop app? Switch View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Security Note */}
      <div className="text-center py-2 text-[11px] text-zinc-500 font-mono flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
        <span>TLS 1.3 · Mutual Ed25519 Token Authentication</span>
      </div>
    </div>
  );
}

export default MobileConnectionFlow;
