import React, { useState, useEffect } from 'react';
import { useRelay } from '../context/RelayContext';
import { getBackendAdapter } from '../services';
import { 
  GitBranch, 
  GitCommit, 
  Check, 
  ArrowUp, 
  ArrowDown, 
  FileCode,
  Terminal,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileDiff
} from 'lucide-react';

export function SourceControlScreen() {
  const { 
    activeProject, 
    executeCommand, 
    setMobileNav,
    gitStatus,
    refreshGitStatus
  } = useRelay();

  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(activeProject.branch);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchInput, setNewBranchInput] = useState('');
  const [gitError, setGitError] = useState<string | null>(null);
  const [activeDiff, setActiveDiff] = useState<{ file: string; content: string } | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);

  const [branches, setBranches] = useState<string[]>([
    'main',
    'ashritha',
    'deeksha',
    'ashish',
    'shreya'
  ]);

  // Sync git status on screen load
  useEffect(() => {
    refreshGitStatus().catch(() => {});
    // Try fetching branches from host
    const fetchBranches = async () => {
      try {
        const httpGit = getBackendAdapter().git as { getBranches?: (p: string) => Promise<{ branches: string[]; currentBranch: string }> };
        if (httpGit.getBranches) {
          const res = await httpGit.getBranches(activeProject.path);
          if (res.branches && res.branches.length > 0) {
            setBranches(res.branches);
            if (res.currentBranch) setSelectedBranch(res.currentBranch);
          }
        }
      } catch {
        // Fallback to initial branches
      }
    };
    fetchBranches();
  }, [activeProject.path, refreshGitStatus]);

  const handleStageAllAndCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim()) return;
    setIsCommitting(true);
    setGitError(null);
    try {
      const httpGit = getBackendAdapter().git as {
        stageFiles: (files: string[], projectPath?: string) => Promise<void>;
        commit: (req: { projectPath: string; message: string }) => Promise<unknown>;
      };
      await httpGit.stageFiles(['.'], activeProject.path);
      await httpGit.commit({
        projectPath: activeProject.path,
        message: commitMessage.trim(),
      });
      setCommitMessage('');
      await refreshGitStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Commit failed';
      setGitError(msg);
      // Fallback through terminal
      await executeCommand(`git add -A`);
      await executeCommand(`git commit -m "${commitMessage.trim()}"`);
    } finally {
      setIsCommitting(false);
    }
  };

  const handlePush = async () => {
    setIsPushing(true);
    setGitError(null);
    try {
      const httpGit = getBackendAdapter().git as { push: (b?: string, p?: string) => Promise<unknown> };
      await httpGit.push(undefined, activeProject.path);
      await refreshGitStatus();
    } catch (err: unknown) {
      setGitError(err instanceof Error ? err.message : 'Push failed');
      await executeCommand('git push');
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    setGitError(null);
    try {
      const httpGit = getBackendAdapter().git as { pull: (b?: string, p?: string) => Promise<unknown> };
      await httpGit.pull(undefined, activeProject.path);
      await refreshGitStatus();
    } catch (err: unknown) {
      setGitError(err instanceof Error ? err.message : 'Pull failed');
      await executeCommand('git pull');
    } finally {
      setIsPulling(false);
    }
  };

  const handleSwitchBranch = async (branch: string) => {
    setGitError(null);
    try {
      const httpGit = getBackendAdapter().git as { switchBranch: (b: string, p?: string, createNew?: boolean) => Promise<void> };
      await httpGit.switchBranch(branch, activeProject.path, false);
      setSelectedBranch(branch);
      setShowBranchModal(false);
      await refreshGitStatus();
    } catch (err: unknown) {
      setGitError(err instanceof Error ? err.message : 'Failed to switch branch');
      await executeCommand(`git checkout ${branch}`);
      setSelectedBranch(branch);
      setShowBranchModal(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetBranch = newBranchInput.trim();
    if (!targetBranch) return;
    setGitError(null);
    try {
      const httpGit = getBackendAdapter().git as { switchBranch: (b: string, p?: string, createNew?: boolean) => Promise<void> };
      await httpGit.switchBranch(targetBranch, activeProject.path, true);
      setBranches((prev) => (prev.includes(targetBranch) ? prev : [...prev, targetBranch]));
      setSelectedBranch(targetBranch);
      setNewBranchInput('');
      setShowBranchModal(false);
      await refreshGitStatus();
    } catch (err: unknown) {
      setGitError(err instanceof Error ? err.message : 'Failed to create branch');
    }
  };

  const handleInspectDiff = async (fileName: string) => {
    setIsLoadingDiff(true);
    try {
      const httpGit = getBackendAdapter().git as { getDiff?: (p: string, f?: string) => Promise<string> };
      if (httpGit.getDiff) {
        const diff = await httpGit.getDiff(activeProject.path, fileName);
        setActiveDiff({ file: fileName, content: diff || 'No working directory changes for this file.' });
      } else {
        await executeCommand(`git diff ${fileName}`);
        setMobileNav('terminal');
      }
    } catch {
      await executeCommand(`git diff ${fileName}`);
      setMobileNav('terminal');
    } finally {
      setIsLoadingDiff(false);
    }
  };

  // Files to display: prefer real gitStatus.changedFiles, fallback to activeProject.files
  const dirtyFiles = gitStatus
    ? gitStatus.changedFiles.map((cf) => ({
        name: cf.path,
        path: cf.path,
        gitStatus: cf.status,
        staged: cf.staged,
      }))
    : activeProject.files
        .filter((f) => f.gitStatus === 'M' || f.gitStatus === 'U')
        .map((f) => ({
          name: f.name,
          path: f.path,
          gitStatus: f.gitStatus || 'M',
          staged: false,
        }));

  const currentBranchName = gitStatus?.branch || activeProject.branch;
  const aheadCount = gitStatus?.ahead ?? activeProject.ahead;
  const behindCount = gitStatus?.behind ?? activeProject.behind;
  const lastCommitInfo = gitStatus?.lastCommit || activeProject.lastCommit;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121419] text-zinc-100 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">Source Control</h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Git repository status, commit drafting, and branch synchronization.
          </p>
        </div>

        {/* Branch Selector */}
        <button
          onClick={() => setShowBranchModal(true)}
          className="px-2.5 py-1 bg-[#1c1f26] hover:bg-[#232731] border border-[#2b303b] rounded-md text-xs font-mono text-zinc-200 flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <GitBranch className="w-3.5 h-3.5 text-zinc-400" />
          <span>{currentBranchName.replace('*', '')}</span>
        </button>
      </div>

      {/* Git Error Banner */}
      {gitError && (
        <div className="p-3 bg-red-950/80 border border-red-800/60 rounded-lg flex items-center justify-between text-xs font-mono text-red-200">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{gitError}</span>
          </div>
          <button onClick={() => setGitError(null)} className="p-1 text-red-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sync Status Bar */}
      <div className="p-3 bg-[#16181e] border border-[#252831] rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-zinc-400">Sync:</span>
          <span className="text-emerald-400 flex items-center gap-0.5">
            <ArrowUp className="w-3 h-3" /> {aheadCount} ahead
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400 flex items-center gap-0.5">
            <ArrowDown className="w-3 h-3" /> {behindCount} behind
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePull}
            disabled={isPulling}
            className="px-2.5 py-1 bg-[#1c1f26] hover:bg-[#232731] text-xs font-mono text-zinc-200 rounded border border-[#2b303b] cursor-pointer transition-colors flex items-center gap-1"
            title="Git pull latest from origin"
          >
            {isPulling ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDown className="w-3 h-3 text-zinc-400" />}
            <span>Pull</span>
          </button>
          <button
            onClick={handlePush}
            disabled={isPushing}
            className="px-2.5 py-1 bg-[#1c1f26] hover:bg-[#232731] text-xs font-mono text-zinc-200 rounded border border-[#2b303b] cursor-pointer transition-colors flex items-center gap-1"
            title="Git push to origin"
          >
            {isPushing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUp className="w-3 h-3 text-emerald-400" />}
            <span>Push</span>
          </button>
        </div>
      </div>

      {/* Commit Box */}
      <form onSubmit={handleStageAllAndCommit} className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg space-y-2.5">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-zinc-300">Commit Changes</span>
          <span className="text-zinc-500 font-mono text-[11px]">{dirtyFiles.length} modified file(s)</span>
        </div>

        <input
          type="text"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message (e.g. fix: update daemon endpoint)"
          className="w-full h-9 px-3 bg-[#111318] border border-[#2b303b] focus:border-blue-500 rounded-md text-xs font-mono text-zinc-100 placeholder:text-zinc-500 outline-none"
        />

        <button
          type="submit"
          disabled={isCommitting || !commitMessage.trim()}
          className={`w-full h-9 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            commitMessage.trim()
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-[#1c1f26] text-zinc-600 border border-[#262a33] cursor-not-allowed'
          }`}
        >
          {isCommitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          <span>Stage All & Commit</span>
        </button>
      </form>

      {/* Staged & Modified Files List */}
      <div className="space-y-2">
        <div className="text-xs text-zinc-400 font-medium px-1 flex items-center justify-between">
          <span>Changes ({dirtyFiles.length})</span>
          <button
            onClick={() => {
              executeCommand('git diff');
              setMobileNav('terminal');
            }}
            className="text-blue-400 hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
          >
            <span>view diff in terminal</span>
            <Terminal className="w-3 h-3" />
          </button>
        </div>

        {dirtyFiles.length === 0 ? (
          <div className="p-5 bg-[#16181e] border border-[#252831] rounded-lg text-center text-xs text-zinc-500 space-y-1">
            <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
            <p className="text-zinc-300 font-medium">Working tree clean</p>
            <p className="text-[11px]">No staged or unstaged changes found.</p>
          </div>
        ) : (
          dirtyFiles.map((file) => (
            <div
              key={`${file.path}-${file.staged ? 'staged' : 'unstaged'}`}
              className="p-2.5 bg-[#16181e] border border-[#252831] rounded-lg flex items-center justify-between text-xs font-mono"
            >
              <div className="flex items-center gap-2.5 truncate">
                <FileCode className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-zinc-200 truncate">{file.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  file.gitStatus === 'M' ? 'text-amber-400' : 'text-zinc-400'
                }`}>
                  {file.gitStatus === 'M' ? 'Modified' : 'Untracked'}
                </span>
                <button
                  onClick={() => handleInspectDiff(file.name)}
                  disabled={isLoadingDiff}
                  className="text-blue-400 hover:text-blue-300 cursor-pointer p-1"
                  title="Inspect diff"
                >
                  Diff
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Inline Diff Viewer Modal */}
      {activeDiff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-xl w-full p-4 space-y-3 shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#242730] pb-2 shrink-0">
              <div className="flex items-center gap-2 text-zinc-200">
                <FileDiff className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Diff: {activeDiff.file}</h3>
              </div>
              <button
                onClick={() => setActiveDiff(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-3 bg-[#111318] rounded border border-[#242730] text-xs font-mono text-zinc-300 whitespace-pre leading-relaxed selection:bg-blue-600/30">
              {activeDiff.content}
            </pre>
            <div className="flex justify-end pt-2 border-t border-[#242730] shrink-0">
              <button
                onClick={() => setActiveDiff(null)}
                className="px-3 py-1.5 text-xs bg-[#1c1f26] hover:bg-[#232731] text-zinc-200 border border-[#2b303b] rounded-md cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last Commit Summary */}
      <div className="p-3 bg-[#16181e] border border-[#252831] rounded-lg space-y-1 text-xs">
        <div className="text-[11px] text-zinc-400 flex items-center gap-1">
          <GitCommit className="w-3.5 h-3.5 text-zinc-500" />
          <span>Latest Commit on {currentBranchName.replace('*', '')}</span>
        </div>
        <div className="text-zinc-200 font-medium">{lastCommitInfo.message || 'No commit message'}</div>
        <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-2 pt-0.5">
          <span>{lastCommitInfo.hash || 'HEAD'}</span>
          <span>·</span>
          <span>{lastCommitInfo.author || 'Lazy Terminal'}</span>
          <span>·</span>
          <span>{lastCommitInfo.time || 'just now'}</span>
        </div>
      </div>

      {/* Branch Switch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-sm w-full p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-zinc-400" /> Switch Branch
              </h3>
              <button onClick={() => setShowBranchModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-zinc-400">Available Branches:</span>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {branches.map((b) => (
                  <button
                    key={b}
                    onClick={() => handleSwitchBranch(b)}
                    className={`w-full p-2 rounded-md text-left text-xs font-mono flex items-center justify-between cursor-pointer ${
                      selectedBranch.includes(b)
                        ? 'bg-[#222631] text-white border border-[#313645]'
                        : 'bg-[#14161c] text-zinc-300 hover:bg-[#1f222b]'
                    }`}
                  >
                    <span>{b}</span>
                    {selectedBranch.includes(b) && <Check className="w-3 h-3 text-blue-400" />}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-2 pt-2 border-t border-[#252831]">
              <label className="text-xs text-zinc-400">Create New Branch</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBranchInput}
                  onChange={(e) => setNewBranchInput(e.target.value)}
                  placeholder="feature/new-branch"
                  className="flex-1 h-9 px-2.5 bg-[#111318] border border-[#2b303b] rounded-md text-xs font-mono text-zinc-100 outline-none"
                />
                <button
                  type="submit"
                  className="px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
