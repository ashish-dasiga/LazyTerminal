import React, { useState } from 'react';
import { useRelay } from '../context/RelayContext';
import { 
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export function MobileConnectionFlow() {
  const { 
    connectionError, 
    setConnectionError, 
    connectWithKey 
  } = useRelay();

  const [tokenInput, setTokenInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = tokenInput.trim();

    if (!trimmed) {
      setValidationError('Please enter a pairing code.');
      return;
    }

    if (isVerifying) return;

    // Validate format (expected 6 alphanumeric characters or digits, optionally hyphenated)
    const normalized = trimmed.replace(/[\s-]/g, '');
    if (normalized.length < 6) {
      setValidationError('Pairing code must be at least 6 digits (e.g. 123-456).');
      return;
    }

    setValidationError(null);
    if (connectionError) setConnectionError(null);
    setIsVerifying(true);

    try {
      await connectWithKey(trimmed);
    } finally {
      setIsVerifying(false);
    }
  };

  const activeError = validationError || connectionError;

  return (
    <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 bg-[#0c0e14] text-zinc-100 font-sans select-none overflow-y-auto relative min-h-full">
      {/* Subtle translucent glass-like brand logo in the background */}
      <div 
        aria-hidden="true" 
        className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none z-0"
      >
        <img
          src="./icon.jpeg"
          alt=""
          className="w-80 h-80 sm:w-96 sm:h-96 rounded-full object-cover opacity-[0.035] blur-[1px] scale-125"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/icon.jpeg';
          }}
        />
      </div>

      {/* Spacer to balance vertical centering */}
      <div className="hidden sm:block h-2" />

      {/* Main Glassmorphic Pairing Card */}
      <main className="relative z-10 my-auto py-4 max-w-sm w-full mx-auto">
        <div className="bg-[#141722]/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl p-6 sm:p-7 space-y-6 transition-all duration-200">
          
          {/* Card Header with Real Brand Logo */}
          <div className="text-center space-y-3">
            <div className="relative inline-block mx-auto group">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-blue-600/20 to-sky-400/20 blur-sm opacity-70 group-hover:opacity-100 transition duration-300" />
              <img
                src="./icon.jpeg"
                alt="Lazy Terminal Logo"
                className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-2xl object-cover border border-[#2b3040] shadow-xl mx-auto transition-transform duration-200 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/icon.jpeg';
                }}
              />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Connect to Windows PC
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
              Enter the 6-digit pairing code shown on your Windows companion app to establish an encrypted local tunnel.
            </p>
          </div>

          {/* Error Message Box (if validation or connection fails) */}
          {activeError && (
            <div 
              role="alert"
              className="p-3.5 bg-rose-950/45 border border-rose-800/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-200 shadow-sm animate-in fade-in duration-150"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-snug flex-1">
                <span className="font-medium">{activeError}</span>
                {activeError.toLowerCase().includes('unreachable') && (
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-rose-300 hover:text-white underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry connection</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Single Input Pairing Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label 
                htmlFor="pairing-code-input"
                className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider block"
              >
                Pairing Code
              </label>

              <div className="relative">
                <input
                  id="pairing-code-input"
                  name="pairingCode"
                  aria-label="Pairing Code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    if (validationError) setValidationError(null);
                    if (connectionError) setConnectionError(null);
                  }}
                  placeholder="123-456"
                  disabled={isVerifying}
                  autoFocus
                  className="w-full h-12 sm:h-13 px-4 bg-[#0d1017]/90 border border-zinc-700/60 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-base sm:text-lg font-mono font-bold tracking-widest text-center text-white placeholder:text-zinc-600 outline-none transition-all duration-150 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Single Primary Action Button */}
            <button
              type="submit"
              disabled={!tokenInput.trim() || isVerifying}
              aria-label="Connect to PC"
              className={`w-full h-11 sm:h-12 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 shadow-md ${
                tokenInput.trim() && !isVerifying
                  ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 active:scale-[0.99] text-white shadow-blue-600/20'
                  : 'bg-[#1e222c] text-zinc-500 border border-[#2b303d] cursor-not-allowed opacity-60'
              }`}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Connecting to PC...</span>
                </>
              ) : (
                <span>Connect to PC</span>
              )}
            </button>
          </form>

        </div>
      </main>

      {/* Accessible Footer Security Badge */}
      <footer className="relative z-10 text-center py-2 text-[11px] text-zinc-500 font-mono flex items-center justify-center gap-1.5 shrink-0">
        <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
        <span>TLS 1.3 · Mutual Ed25519 Token Authentication</span>
      </footer>
    </div>
  );
}

export default MobileConnectionFlow;
