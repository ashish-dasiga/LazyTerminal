import React, { useState } from 'react';
import { useRelay } from '../context/RelayContext';
import { Project } from '../types/relay';
import { 
  FolderGit2, 
  GitBranch, 
  GitCommit, 
  Search, 
  Radar, 
  HardDrive, 
  Folder, 
  FileCode, 
  Terminal, 
  ArrowUpRight, 
  Loader2 
} from 'lucide-react';

interface ProjectsScreenProps {
  onSwitchToTerminal: () => void;
}

export function ProjectsScreen({ onSwitchToTerminal }: ProjectsScreenProps) {
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    scanPcRepositories,
    isScanningPc,
  } = useRelay();

  const [selectedProjectForExplorer, setSelectedProjectForExplorer] = useState<Project | null>(
    projects.find((p) => p.id === activeProjectId) || projects[0]
  );
  const [filterQuery, setFilterQuery] = useState('');

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      p.path.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleSelectWorkspace = (id: string) => {
    setActiveProjectId(id);
    const p = projects.find((proj) => proj.id === id);
    if (p) setSelectedProjectForExplorer(p);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121419] text-zinc-100 font-sans">
      {/* Header Info & Scan PC Action */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">
              Workspaces & PC File System
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cached directories & Git states synced with Windows host.
          </p>
        </div>

        {/* Scan PC Button */}
        <button
          onClick={scanPcRepositories}
          disabled={isScanningPc}
          className="px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 border border-[#2b303b] bg-[#1c1f26] hover:bg-[#232731] text-zinc-200 transition-colors cursor-pointer"
          title="Scan Windows drives for Git repositories and workspaces"
        >
          {isScanningPc ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Scanning PC...
            </>
          ) : (
            <>
              <Radar className="w-3.5 h-3.5" />
              Scan PC
            </>
          )}
        </button>
      </div>

      {/* Filter input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter repositories by name or path..."
          className="w-full pl-8 pr-3 py-2 bg-[#16181e] border border-[#252831] rounded-md text-xs font-mono text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-blue-500"
        />
      </div>

      {/* Projects Grid / List */}
      <div className="space-y-2">
        {filteredProjects.map((p) => {
          const isActive = p.id === activeProjectId;

          return (
            <div
              key={p.id}
              onClick={() => handleSelectWorkspace(p.id)}
              className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#1a1d26] border-[#313747]'
                  : 'bg-[#16181e] border-[#252831] hover:border-[#2f3442]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded bg-[#1c1f26] text-zinc-400">
                    <FolderGit2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                      {isActive && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#232733] text-zinc-200 rounded border border-[#313747]">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">{p.path}</div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <GitBranch className="w-3 h-3 text-zinc-400" />
                    <span className="text-zinc-300 font-medium">{p.branch}</span>
                    {p.isDirty && (
                      <span
                        className="text-[10px] px-1 py-0.2 bg-amber-950/40 text-amber-300 border border-amber-800/40 rounded"
                        title={`${p.dirtyCount} dirty files`}
                      >
                        {p.dirtyCount} modified
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    {p.ahead > 0 && <span className="text-emerald-400">↑{p.ahead} </span>}
                    {p.behind > 0 && <span className="text-rose-400">↓{p.behind} </span>}
                    {p.lastCommit.time}
                  </div>
                </div>
              </div>

              {/* Commit info summary */}
              <div className="mt-2 pt-2 border-t border-[#22252e] flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <div className="flex items-center gap-1.5 truncate mr-2">
                  <GitCommit className="w-3 h-3 text-zinc-500 shrink-0" />
                  <span className="text-zinc-500">{p.lastCommit.hash}</span>
                  <span className="truncate text-zinc-300">{p.lastCommit.message}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectWorkspace(p.id);
                    onSwitchToTerminal();
                  }}
                  className="hover:text-white flex items-center gap-1 shrink-0 font-medium cursor-pointer"
                  title="Open in Terminal Console"
                >
                  <Terminal className="w-3 h-3" /> Console
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Directory Browser Sheet */}
      {selectedProjectForExplorer && (
        <div className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-zinc-400" />
              <h3 className="text-xs font-semibold text-white">
                Directory Explorer (Cached)
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">
              {selectedProjectForExplorer.files.length} items cached in SQLite
            </span>
          </div>

          <div className="space-y-1 divide-y divide-[#20232d] text-xs font-mono">
            {selectedProjectForExplorer.files.map((file) => (
              <div
                key={file.name}
                className="py-1.5 flex items-center justify-between text-zinc-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  {file.isDir ? (
                    <Folder className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  ) : (
                    <FileCode className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  )}
                  <span className="truncate">{file.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 shrink-0">
                  {file.gitStatus === 'M' && (
                    <span className="text-amber-400 font-semibold">[M]</span>
                  )}
                  {file.gitStatus === 'U' && (
                    <span className="text-zinc-500 font-semibold">[?]</span>
                  )}
                  {file.size && <span>{file.size}</span>}
                  <span>{file.modified}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 text-xs text-zinc-400 flex items-center justify-between">
            <span>Navigation available offline.</span>
            <button
              onClick={() => onSwitchToTerminal()}
              className="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Open Terminal Here <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
