import React, { useState } from 'react';
import { useRelay } from '../context/RelayContext';
import { AlertCircle, ShieldAlert, Check, X, ArrowRight, Loader2 } from 'lucide-react';

export function CliMissingInterceptor() {
  const { interceptedCli, dismissCliIntercept, installCliTool, cliTools } = useRelay();
  const [showSecurityPreview, setShowSecurityPreview] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [userConfirmedTrust, setUserConfirmedTrust] = useState(false);

  if (!interceptedCli) return null;

  const matchedTool = cliTools.find((t) => t.cliName === interceptedCli.cliName);

  const handleInstallConfirm = async () => {
    setIsAuthorizing(true);
    if (matchedTool) {
      await installCliTool(matchedTool.id);
    }
    setIsAuthorizing(false);
    setShowSecurityPreview(false);
  };

  return (
    <>
      {/* Interceptor Banner Above Input */}
      <div className="bg-[#191712] border-y border-amber-900/40 px-3 py-2 flex items-center justify-between gap-3 text-xs font-mono animate-in slide-in-from-top-1 duration-150">
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="truncate">
            <span className="font-semibold text-amber-200">
              {interceptedCli.toolName} not installed on PC
            </span>
            <span className="text-zinc-400 text-[11px] block sm:inline sm:ml-2">
              Command '{interceptedCli.cliName}' requires native package setup.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowSecurityPreview(true)}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium text-xs transition-colors cursor-pointer flex items-center gap-1"
          >
            Inspect & Install <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={dismissCliIntercept}
            className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Security Flow Modal */}
      {showSecurityPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#1c1f26] border border-[#2b303b] rounded-md">
                  <ShieldAlert className="w-5 h-5 text-zinc-300" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Authorize PC CLI Installation
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Preview command to execute on paired Windows PC
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSecurityPreview(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scope Details */}
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-[#111318] border border-[#252831] rounded-md space-y-1">
                <div className="text-zinc-500 text-[10px] font-mono uppercase">
                  Target Command
                </div>
                <div className="font-mono text-zinc-100 text-xs bg-[#16181e] p-2 rounded border border-[#242732] select-all">
                  {interceptedCli.installCommand}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-300">
                <div className="p-2 bg-[#111318] rounded border border-[#252831]">
                  <span className="text-zinc-500 block">Scope</span>
                  <span className="text-zinc-200">Global Windows PATH</span>
                </div>
                <div className="p-2 bg-[#111318] rounded border border-[#252831]">
                  <span className="text-zinc-500 block">Execution</span>
                  <span className="text-emerald-400">Subprocess on PC</span>
                </div>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 font-sans">
              <input
                type="checkbox"
                checked={userConfirmedTrust}
                onChange={(e) => setUserConfirmedTrust(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span>I authorize execution of this package installation on my PC</span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242732]">
              <button
                onClick={() => setShowSecurityPreview(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!userConfirmedTrust || isAuthorizing}
                onClick={handleInstallConfirm}
                className={`px-4 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  userConfirmedTrust && !isAuthorizing
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-[#22252e] text-zinc-600 cursor-not-allowed'
                }`}
              >
                {isAuthorizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Executing on PC...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Authorize & Run on PC
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
