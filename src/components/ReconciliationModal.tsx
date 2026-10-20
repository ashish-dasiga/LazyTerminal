import React, { useState } from 'react';
import { useRelay } from '../context/RelayContext';
import { 
  GitMerge, 
  AlertTriangle, 
  Check, 
  X, 
  Play, 
  Loader2 
} from 'lucide-react';

export function ReconciliationModal() {
  const {
    reconciliationPromptOpen,
    setReconciliationPromptOpen,
    intentQueue,
    reconcileAllIntents,
    device,
    activeProject,
  } = useRelay();

  const [isProcessing, setIsProcessing] = useState(false);

  const pending = intentQueue.filter((i) => i.status === 'queued' || i.status === 'diverged');

  if (!reconciliationPromptOpen || pending.length === 0) return null;

  const handleReconcile = async (force: boolean) => {
    setIsProcessing(true);
    await reconcileAllIntents(force);
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#1c1f26] border border-[#2b303b] text-zinc-300 rounded-md">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                PC Reconnected: State Synchronization
              </h3>
              <p className="text-xs text-zinc-400">
                {pending.length} buffered intent(s) awaiting execution on {device.deviceName}
              </p>
            </div>
          </div>
          <button
            onClick={() => setReconciliationPromptOpen(false)}
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* State Divergence Notice */}
        <div className="p-3 bg-[#13151b] border border-[#262a34] rounded-md space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Working Directory Status
          </div>
          <p className="text-zinc-400 text-[11px] leading-relaxed">
            Windows working directory is on <span className="text-zinc-200 font-mono">{activeProject.branch}</span>. Intents will be reconciled sequentially in FIFO order.
          </p>
        </div>

        {/* Queued Sequence List */}
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {pending.map((intent) => (
            <div
              key={intent.id}
              className="p-2 bg-[#121419] border border-[#22252e] rounded text-xs font-mono flex items-center justify-between text-zinc-200"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-zinc-500 text-[10px]">#{intent.seq}</span>
                <span className="truncate">{intent.command}</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-sans">Queued</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242732]">
          <button
            onClick={() => setReconciliationPromptOpen(false)}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
          >
            Review Later
          </button>
          <button
            disabled={isProcessing}
            onClick={() => handleReconcile(false)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-md text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Execute Intents Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
