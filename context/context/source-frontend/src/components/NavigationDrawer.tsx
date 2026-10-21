import React from 'react';
import { useRelay } from '../context/RelayContext';
import { 
  Folder, 
  Terminal, 
  GitBranch, 
  Play, 
  Globe, 
  Settings, 
  MoreHorizontal, 
  X, 
  ChevronRight,
  FilePlus,
  FileText,
  FolderOpen,
  FolderPlus,
  ExternalLink
} from 'lucide-react';
import { MobileNavSection } from '../types/relay';

export function NavigationDrawer() {
  const { 
    isDrawerOpen, 
    setIsDrawerOpen, 
    mobileNav, 
    setMobileNav, 
    activeProject, 
    activeFile,
    setActiveFile,
    setFileModal,
    device, 
    intentQueue,
    currentUser,
    disconnectMobile
  } = useRelay();

  if (!isDrawerOpen) return null;

  const queuedCount = intentQueue.filter((i) => i.status === 'queued' || i.status === 'diverged').length;

  const navItems: Array<{
    id: MobileNavSection;
    label: string;
    description: string;
    icon: React.ReactNode;
    badge?: string | number;
  }> = [
    {
      id: 'explorer',
      label: 'Explorer',
      description: 'Browse folders, create, open & edit files',
      icon: <Folder className="w-4 h-4 text-zinc-400" />,
      badge: `${activeProject.files.length} files`,
    },
    {
      id: 'terminal',
      label: 'Terminal',
      description: 'PowerShell, CMD & agent consoles',
      icon: <Terminal className="w-4 h-4 text-zinc-400" />,
      badge: 'Active',
    },
    {
      id: 'git',
      label: 'Source Control',
      description: 'Git status, diff, staging, commit & branch',
      icon: <GitBranch className="w-4 h-4 text-zinc-400" />,
      badge: activeProject.isDirty ? `${activeProject.dirtyCount} modified` : 'Clean',
    },
    {
      id: 'run',
      label: 'Run / Debug',
      description: 'Launch scripts, watch commands & AI CLI tools',
      icon: <Play className="w-4 h-4 text-zinc-400" />,
    },
    {
      id: 'preview',
      label: 'Preview',
      description: 'Web servers & tunnel output',
      icon: <Globe className="w-4 h-4 text-zinc-400" />,
      badge: 'Port 5173',
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Account, connection & theme settings',
      icon: <Settings className="w-4 h-4 text-zinc-400" />,
    },
    {
      id: 'more',
      label: 'More options',
      description: 'Offline queue, SQLite WAL & diagnostics',
      icon: <MoreHorizontal className="w-4 h-4 text-zinc-400" />,
      badge: queuedCount > 0 ? `${queuedCount} queued` : undefined,
    },
  ];

  const handleSelect = (id: MobileNavSection) => {
    setMobileNav(id);
    setIsDrawerOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex font-sans">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={() => setIsDrawerOpen(false)}
      />

      {/* Persistent Drawer Container */}
      <div className="relative w-80 max-w-[85vw] h-full bg-[#15171d] border-r border-[#252831] shadow-xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#242730] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#1e2129] border border-[#2d323e] flex items-center justify-center text-zinc-200 font-bold text-xs font-mono">
              RD
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">Remote Development</h2>
              <span className="text-[11px] text-zinc-400">Navigation</span>
            </div>
          </div>

          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded hover:bg-[#22252e] cursor-pointer transition-colors"
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Host PC Status Card */}
        <div className="px-4 py-2.5 bg-[#191c23] border-b border-[#242730] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <div className="text-xs font-medium text-zinc-200 truncate">{device.deviceName}</div>
              <div className="text-[11px] text-zinc-400">
                {device.isOnline ? `Online (${device.pingMs}ms)` : 'Offline (Queue active)'}
              </div>
            </div>
          </div>

          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#20242d] text-zinc-300 border border-[#2d323e] shrink-0">
            {activeProject.name}
          </span>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
          {/* 1. Standard Desktop-Style File Menu */}
          <div className="space-y-0.5 pb-2 border-b border-[#242730]">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center justify-between">
              <span>File</span>
              <span className="text-[9.5px] font-mono text-zinc-600">Workspace</span>
            </div>

            {/* Action: New File */}
            <button
              onClick={() => {
                setIsDrawerOpen(false);
                setMobileNav('explorer');
                setFileModal('new_file');
              }}
              className="w-full px-3 py-2 rounded-md flex items-center justify-between text-left hover:bg-[#1a1d24] text-zinc-300 hover:text-zinc-100 cursor-pointer text-xs transition-colors"
              title="Create a new code or text file in the active workspace"
            >
              <div className="flex items-center gap-2.5">
                <FilePlus className="w-4 h-4 text-zinc-400" />
                <span className="font-medium">New File</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Create file</span>
            </button>

            {/* Action: Open File */}
            <button
              onClick={() => {
                setIsDrawerOpen(false);
                setMobileNav('explorer');
              }}
              className="w-full px-3 py-2 rounded-md flex items-center justify-between text-left hover:bg-[#1a1d24] text-zinc-300 hover:text-zinc-100 cursor-pointer text-xs transition-colors"
              title={activeFile ? `Open ${activeFile.name}` : 'Browse files to open in editor'}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="font-medium truncate">Open File</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[120px]">
                {activeFile ? activeFile.name : 'Select file'}
              </span>
            </button>

            {/* Action: Open Folder */}
            <button
              onClick={() => {
                setIsDrawerOpen(false);
                setActiveFile(null);
                setMobileNav('explorer');
              }}
              className="w-full px-3 py-2 rounded-md flex items-center justify-between text-left hover:bg-[#1a1d24] text-zinc-300 hover:text-zinc-100 cursor-pointer text-xs transition-colors"
              title="Browse directory folders in Explorer"
            >
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-4 h-4 text-zinc-400" />
                <span className="font-medium">Open Folder</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Browse root</span>
            </button>

            {/* Action: New Folder */}
            <button
              onClick={() => {
                setIsDrawerOpen(false);
                setMobileNav('explorer');
                setFileModal('new_folder');
              }}
              className="w-full px-3 py-2 rounded-md flex items-center justify-between text-left hover:bg-[#1a1d24] text-zinc-300 hover:text-zinc-100 cursor-pointer text-xs transition-colors"
              title="Create a new folder in workspace"
            >
              <div className="flex items-center gap-2.5">
                <FolderPlus className="w-4 h-4 text-zinc-400" />
                <span className="font-medium">New Folder</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Create folder</span>
            </button>

            {/* Action: Open With */}
            <button
              onClick={() => {
                setIsDrawerOpen(false);
                if (activeFile) {
                  setMobileNav('explorer');
                  setFileModal('open_with');
                } else {
                  setFileModal('no_file_selected');
                }
              }}
              className="w-full px-3 py-2 rounded-md flex items-center justify-between text-left hover:bg-[#1a1d24] text-zinc-300 hover:text-zinc-100 cursor-pointer text-xs transition-colors"
              title="Choose application handler to open selected file with"
            >
              <div className="flex items-center gap-2.5">
                <ExternalLink className="w-4 h-4 text-zinc-400" />
                <span className="font-medium">Open With…</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[120px]">
                {activeFile ? activeFile.name : 'Select file first'}
              </span>
            </button>
          </div>

          {/* 2. Standard Navigation Sections */}
          <div className="space-y-0.5">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
              Workspaces & Tools
            </div>

            {navItems.map((item) => {
              const isActive = mobileNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full p-2.5 rounded-lg flex items-center gap-3 transition-colors text-left cursor-pointer group ${
                    isActive
                      ? 'bg-[#222631] text-zinc-100 border border-[#313645]'
                      : 'hover:bg-[#1a1d24] text-zinc-300 hover:text-zinc-100 border border-transparent'
                  }`}
                >
                  <div className={`p-1.5 rounded bg-[#1b1e26] border border-[#292d39] shrink-0 ${
                    isActive ? 'text-blue-400 border-blue-500/40' : 'text-zinc-400'
                  }`}>
                    {item.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium tracking-tight text-zinc-100">{item.label}</span>
                      {item.badge && (
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">{item.description}</p>
                  </div>

                  <ChevronRight className={`w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 shrink-0 ${
                    isActive ? 'text-zinc-400' : ''
                  }`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Drawer Footer with User & Disconnect */}
        <div className="p-3 border-t border-[#242730] bg-[#13151a] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#242833] border border-[#323746] flex items-center justify-center text-xs font-semibold text-zinc-200">
                {currentUser.username[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-zinc-200 truncate">{currentUser.username}</div>
                <div className="text-[11px] text-zinc-400 truncate">{currentUser.email}</div>
              </div>
            </div>

            <button
              onClick={() => {
                disconnectMobile();
                setIsDrawerOpen(false);
              }}
              className="text-xs text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
