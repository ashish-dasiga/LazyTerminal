import React, { useState, useEffect } from 'react';
import { useRelay } from '../context/RelayContext';
import { WorkspaceBrowseResponse } from '../services/contracts';
import {
  FolderGit2,
  Folder,
  FolderOpen,
  GitBranch,
  HardDrive,
  ChevronUp,
  Check,
  X,
  AlertCircle,
  Loader2,
  Radar,
} from 'lucide-react';

interface ProjectSwitchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onManageWorkspaces: () => void;
}

export function ProjectSwitchDrawer({
  isOpen,
  onClose,
}: ProjectSwitchDrawerProps) {
  const {
    projects,
    activeProjectId,
    activeProject,
    selectWorkspacePath,
    browseHostFolders,
    pickNativeHostFolder,
    scanPcRepositories,
    isScanningPc,
  } = useRelay();

  const [customPathInput, setCustomPathInput] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const [browseData, setBrowseData] = useState<WorkspaceBrowseResponse | null>(null);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isPickingNative, setIsPickingNative] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setWorkspaceError(null);
      setCustomPathInput(activeProject.path || '');
    }
  }, [isOpen, activeProject.path]);

  const loadBrowseDirectory = async (dirPath?: string) => {
    setIsBrowsing(true);
    setWorkspaceError(null);
    try {
      const data = await browseHostFolders(dirPath);
      setBrowseData(data);
      if (data.currentPath) {
        setCustomPathInput(data.currentPath);
      }
    } catch (err: unknown) {
      setWorkspaceError(
        err instanceof Error ? err.message : 'Unable to browse Windows PC folder.',
      );
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleToggleBrowser = () => {
    const next = !showBrowser;
    setShowBrowser(next);
    if (next) {
      loadBrowseDirectory(activeProject.path || undefined);
    }
  };

  const handleOpenPath = async (targetPath: string) => {
    const trimmed = targetPath.trim();
    if (!trimmed) {
      setWorkspaceError('Please enter a Windows folder path.');
      return;
    }
    setIsSelecting(true);
    setWorkspaceError(null);
    try {
      await selectWorkspacePath(trimmed);
      onClose();
    } catch (err: unknown) {
      setWorkspaceError(
        err instanceof Error ? err.message : 'Selected Windows folder could not be opened.',
      );
    } finally {
      setIsSelecting(false);
    }
  };

  const handleSubmitPath = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleOpenPath(customPathInput);
  };

  const handlePickNative = async () => {
    setIsPickingNative(true);
    setWorkspaceError(null);
    try {
      const picked = await pickNativeHostFolder();
      if (picked) {
        onClose();
      }
    } catch (err: unknown) {
      setWorkspaceError(
        err instanceof Error ? err.message : 'Native Windows folder picker could not be opened.',
      );
    } finally {
      setIsPickingNative(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      data-testid="workspace-picker-modal"
    >
      <div className="bg-[#181a21] border border-[#2b303b] rounded-t-xl sm:rounded-xl max-w-md w-full p-4 space-y-3.5 shadow-xl max-h-[88vh] overflow-y-auto font-sans">
        {/* Grab Handle for mobile */}
        <div className="w-10 h-1 bg-[#2b303b] rounded-full mx-auto sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-white">Select Active Workspace</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white cursor-pointer p-1"
            aria-label="Close workspace selector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Banner */}
        {workspaceError && (
          <div
            className="p-2.5 bg-red-950/80 border border-red-800/60 rounded-lg flex items-start justify-between gap-2 text-xs font-mono text-red-200"
            data-testid="workspace-error-banner"
          >
            <div className="flex items-start gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="break-words">{workspaceError}</span>
            </div>
            <button
              type="button"
              onClick={() => setWorkspaceError(null)}
              className="text-red-400 hover:text-white shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Windows Folder Path Input + Quick Actions */}
        <form onSubmit={handleSubmitPath} className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-zinc-400">
              Windows PC Folder Path
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleBrowser}
                className="px-2 py-0.5 bg-[#1c1f26] hover:bg-[#232731] border border-[#2b303b] rounded text-[11px] text-zinc-200 flex items-center gap-1 cursor-pointer transition-colors"
                data-testid="workspace-browse-toggle"
              >
                <FolderOpen className="w-3 h-3 text-blue-400" />
                <span>{showBrowser ? 'Hide Browser' : 'Browse PC'}</span>
              </button>
              <button
                type="button"
                onClick={handlePickNative}
                disabled={isPickingNative}
                className="px-2 py-0.5 bg-[#1c1f26] hover:bg-[#232731] border border-[#2b303b] rounded text-[11px] text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                title="Open native Windows folder picker dialog on host PC"
              >
                {isPickingNative ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <HardDrive className="w-3 h-3 text-zinc-400" />
                )}
                <span>Pick on PC</span>
              </button>
            </div>
          </div>

          <div className="flex gap-1.5">
            <input
              type="text"
              value={customPathInput}
              onChange={(e) => setCustomPathInput(e.target.value)}
              placeholder="C:\Users\...\ProjectFolder"
              data-testid="workspace-path-input"
              className="flex-1 h-9 px-2.5 bg-[#111318] border border-[#2b303b] focus:border-blue-500 rounded-md text-xs font-mono text-zinc-100 placeholder:text-zinc-500 outline-none"
            />
            <button
              type="submit"
              disabled={isSelecting}
              data-testid="workspace-open-btn"
              className="px-3 h-9 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
            >
              {isSelecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Open</span>
            </button>
          </div>
        </form>

        {/* Live Windows Directory Browser */}
        {showBrowser && (
          <div
            className="p-2.5 bg-[#14161c] border border-[#252831] rounded-lg space-y-2"
            data-testid="workspace-folder-browser"
          >
            {/* Drive Pills & Parent Navigation */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                {(browseData?.drives || ['C:\\']).map((drive) => (
                  <button
                    key={drive}
                    type="button"
                    onClick={() => loadBrowseDirectory(drive)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border cursor-pointer transition-colors ${
                      browseData?.currentPath?.toUpperCase().startsWith(drive.toUpperCase())
                        ? 'bg-[#222631] border-[#343a49] text-white'
                        : 'bg-[#181b22] border-[#252831] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {drive}
                  </button>
                ))}
              </div>

              {browseData?.parentPath && (
                <button
                  type="button"
                  onClick={() => loadBrowseDirectory(browseData.parentPath || undefined)}
                  className="px-2 py-0.5 rounded bg-[#181b22] hover:bg-[#222631] border border-[#252831] text-[11px] font-mono text-zinc-300 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronUp className="w-3 h-3" />
                  <span>Up</span>
                </button>
              )}
            </div>

            {browseData?.currentPath && (
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-[#111318] border border-[#22252e] rounded text-[11px] font-mono text-zinc-300">
                <span className="truncate" title={browseData.currentPath}>
                  {browseData.currentPath}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenPath(browseData.currentPath!)}
                  disabled={isSelecting}
                  data-testid="workspace-select-current-btn"
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10.5px] font-sans font-medium shrink-0 cursor-pointer"
                >
                  Select Folder
                </button>
              </div>
            )}

            {/* Subfolders List */}
            <div className="max-h-44 overflow-y-auto divide-y divide-[#1e2129] rounded border border-[#20232d] bg-[#12141a]">
              {isBrowsing ? (
                <div className="py-6 flex items-center justify-center gap-2 text-xs text-zinc-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  <span>Reading Windows directory...</span>
                </div>
              ) : !browseData || browseData.entries.length === 0 ? (
                <div className="py-4 text-center text-[11px] font-mono text-zinc-500">
                  No subfolders in this directory
                </div>
              ) : (
                browseData.entries.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => loadBrowseDirectory(entry.path)}
                    className="w-full px-2.5 py-1.5 hover:bg-[#1a1d26] flex items-center justify-between text-left text-xs font-mono text-zinc-200 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.isGitRepo ? (
                        <FolderGit2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      ) : (
                        <Folder className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      )}
                      <span className="truncate">{entry.name}</span>
                    </div>
                    {entry.isGitRepo && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1e2433] text-blue-300 border border-blue-800/40 shrink-0">
                        git
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Recent & Discovered Workspaces */}
        <div className="space-y-2 pt-1 border-t border-[#242730]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400">
              Recent & Discovered Workspaces
            </span>
            <button
              type="button"
              onClick={() => scanPcRepositories()}
              disabled={isScanningPc}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
              title="Scan common Windows user folders for Git repositories"
            >
              {isScanningPc ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Radar className="w-3 h-3" />
              )}
              <span>{isScanningPc ? 'Scanning...' : 'Scan PC'}</span>
            </button>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {projects
              .filter((p) => Boolean(p.path))
              .map((p) => {
                const isSelected = p.id === activeProjectId;
                const isMissing = p.exists === false;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      handleOpenPath(p.path);
                    }}
                    className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#222631] border-[#343a49]'
                        : 'bg-[#14161c] border-[#22252e] hover:border-[#2f3442]'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                        {isMissing ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-950/60 text-red-300 border border-red-800/50">
                            Missing
                          </span>
                        ) : p.isGitRepo === false ? (
                          <span className="text-[10px] font-mono text-zinc-500">local</span>
                        ) : (
                          <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-0.5">
                            <GitBranch className="w-2.5 h-2.5" /> {p.branch.replace('*', '')}
                          </span>
                        )}
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
    </div>
  );
}
