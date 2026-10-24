import React, { useState, useRef } from 'react';
import { useRelay } from '../context/RelayContext';
import { 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export function MobileConnectionFlow() {
  const { 
    connectionStep, 
    connectionError, 
    setConnectionError, 
    connectWithKey 
  } = useRelay();

  const [tokenInput, setTokenInput] = useState('');
  const [localValidation, setLocalValidation] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isVerifying = connectionStep === 'connecting';

  // Format token cleanly as user types: digits only, insert hyphen after 3 digits
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d-]/g, '');
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    let formatted = digits;
    if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }

    setTokenInput(formatted);
    if (localValidation) setLocalValidation(null);
    if (connectionError) setConnectionError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying) return;

    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setLocalValidation('Please enter the 6-digit pairing code.');
      inputRef.current?.focus();
      return;
    }

    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length !== 6) {
      setLocalValidation('Pairing code must be 6 digits (e.g. 123-456).');
      inputRef.current?.focus();
      return;
    }

    setLocalValidation(null);
    await connectWithKey(trimmed);
  };

  const handleRetry = () => {
    setConnectionError(null);
    setLocalValidation(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const activeError = localValidation || connectionError;

  return (
    <div className="relative flex-1 flex flex-col justify-between p-4 sm:p-6 bg-[#0e1015] text-zinc-100 font-sans select-none overflow-hidden min-h-0">
      {/* Subtle translucent, low-contrast, non-interactive background logo */}
      <div 
        aria-hidden="true" 
        className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none opacity-[0.035] filter blur-[0.5px]"
      >
        <img 
          src="/icon.jpeg" 
          alt="" 
          className="w-[360px] h-[360px] max-w-none object-contain transform scale-110" 
        />
      </div>

      {/* Main card centered in viewport */}
      <div className="relative z-10 my-auto py-4 max-w-sm w-full mx-auto">
        <div className="bg-[#151821]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 p-6 space-y-6">
          {/* Brand header with real logo */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-[#1b1f2b]/90 border border-white/10 p-2 shadow-lg flex items-center justify-center overflow-hidden ring-1 ring-blue-500/20">
              <img
                src="/icon.jpeg"
                alt="Lazy Terminal logo"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                Pair with Windows PC
              </h1>
              <p className="text-xs text-zinc-400 max-w-[280px] leading-relaxed">
                Enter the 6-digit pairing code shown on your Windows host companion.
              </p>
            </div>
          </div>

          {/* Error Message Box with Retry button */}
          {activeError && (
            <div 
              role="alert" 
              className="p-3.5 bg-rose-950/40 border border-rose-800/50 rounded-xl flex items-start gap-3 text-xs text-rose-200 animate-in fade-in duration-150"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <div className="leading-snug">{activeError}</div>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="text-[11px] font-semibold text-rose-300 hover:text-white underline cursor-pointer inline-flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-rose-400 rounded"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          )}

          {/* Simplified Single Input & Single Action Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <label 
                htmlFor="pairing-code" 
                className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider block"
              >
                Pairing Code
              </label>

              <div className="relative">
                <input
                  ref={inputRef}
                  id="pairing-code"
                  name="pairingCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={tokenInput}
                  onChange={handleInputChange}
                  placeholder="e.g. 123-456"
                  disabled={isVerifying}
                  maxLength={7}
                  autoFocus
                  className="w-full h-12 px-4 bg-[#0d0f14] border border-[#2a2f3d] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 rounded-xl text-lg font-mono font-bold tracking-widest text-center text-white placeholder:text-zinc-600 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Primary Action Button: Connect to PC */}
            <button
              type="submit"
              disabled={!tokenInput.trim() || isVerifying}
              aria-label={isVerifying ? 'Connecting to PC' : 'Connect to PC'}
              className={`w-full h-12 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                tokenInput.trim() && !isVerifying
                  ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white cursor-pointer shadow-blue-600/20'
                  : 'bg-[#1a1d26] text-zinc-500 border border-[#282d3b] cursor-not-allowed'
              }`}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Connecting to PC...</span>
                </>
              ) : (
                <>
                  <span>Connect to PC</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Connection status indicator */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80 animate-pulse" />
            <span>Ready for local pairing</span>
          </div>
        </div>
      </div>

      {/* Refined Security Badge Footer */}
      <footer className="relative z-10 text-center py-2 text-[11px] text-zinc-500 font-mono flex items-center justify-center gap-1.5 shrink-0">
        <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
        <span>TLS 1.3 · Mutual Ed25519 Token Authentication</span>
      </footer>
    </div>
  );
}

export default MobileConnectionFlow;
