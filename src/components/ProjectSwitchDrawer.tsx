import React from 'react';
import { useRelay } from '../context/RelayContext';
import { FolderGit2, GitBranch, Check, X } from 'lucide-react';

interface ProjectSwitchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onManageWorkspaces: () => void;
}

export function ProjectSwitchDrawer({
  isOpen,
  onClose,
}: ProjectSwitchDrawerProps) {
  const { projects, activeProjectId, setActiveProjectId } = useRelay();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#181a21] border border-[#2b303b] rounded-t-xl sm:rounded-xl max-w-md w-full p-4 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto font-sans">
        {/* Grab Handle for mobile */}
        <div className="w-10 h-1 bg-[#2b303b] rounded-full mx-auto sm:hidden" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-white">Select Active Workspace</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {projects.map((p) => {
            const isSelected = p.id === activeProjectId;
            return (
              <div
                key={p.id}
                onClick={() => {
                  setActiveProjectId(p.id);
                  onClose();
                }}
                className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#222631] border-[#343a49]'
                    : 'bg-[#14161c] border-[#22252e] hover:border-[#2f3442]'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                    <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-0.5">
                      <GitBranch className="w-2.5 h-2.5" /> {p.branch.replace('*', '')}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">
                    {p.path}
                  </div>
                </div>

                {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
