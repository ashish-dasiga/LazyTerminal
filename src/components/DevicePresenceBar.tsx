import React from 'react';
import { useRelay } from '../context/RelayContext';
import { Menu, GitBranch, ChevronDown, ArrowLeft } from 'lucide-react';

interface DevicePresenceBarProps {
  onOpenProjectDrawer?: () => void;
  onOpenReconciliation?: () => void;
  onOpenDrawer?: () => void;
}

export function DevicePresenceBar({
  onOpenProjectDrawer,
  onOpenDrawer,
}: DevicePresenceBarProps) {
  const { device, activeProject, mobileNav, setMobileNav } = useRelay();

  const isSubScreen = mobileNav !== 'terminal';

  const screenTitles: Record<string, string> = {
    terminal: 'Terminal',
    explorer: 'Explorer',
    git: 'Source Control',
    run: 'Run / Debug',
    preview: 'Preview',
    settings: 'Settings',
    more: 'More Options',
  };

  const currentTitle = screenTitles[mobileNav] || 'Terminal';

  return (
    <header className="bg-[#15171d] border-b border-[#252831] px-3 flex items-center justify-between z-30 shrink-0 select-none h-11 text-zinc-100 font-sans">
      {/* Left cluster: Hamburger Menu, Back Navigation (if subscreen), and Screen Title */}
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
        <button
          onClick={onOpenDrawer}
          className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded hover:bg-[#20232c] transition-colors cursor-pointer shrink-0"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {isSubScreen && (
          <button
            onClick={() => setMobileNav('terminal')}
            className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-[#20232c] transition-colors cursor-pointer shrink-0"
            title="Back to Terminal"
            aria-label="Back to Terminal"
          >
            <ArrowLeft className="w-4 h-4 text-blue-400" />
          </button>
        )}

        <h1 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate tracking-tight">
          {currentTitle}
        </h1>
      </div>

      {/* Right cluster: PC Connection Status Badge & Active Git Branch Button */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Host PC Status Badge */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1c1f26] border border-[#272b35] text-[11px] font-mono text-zinc-300 shrink-0 cursor-default"
          title={`Host PC: ${device.deviceName} (${device.isOnline ? `Online (${device.pingMs}ms)` : 'Offline'})`}
        >
          <span className="truncate max-w-[70px] sm:max-w-[110px]">
            {device.deviceName}
          </span>
        </div>

        {/* Git Branch / Workspace Button */}
        <button
          onClick={onOpenProjectDrawer}
          className="flex items-center gap-1 px-2 py-1 bg-[#1c1f26] hover:bg-[#232731] border border-[#272b35] rounded transition-colors text-[11px] font-mono text-zinc-300 shrink-0 cursor-pointer"
          title={`Workspace: ${activeProject.name} (Branch: ${activeProject.branch})`}
        >
          <GitBranch className="w-3 h-3 text-zinc-400 shrink-0" />
          <span className="truncate max-w-[60px] sm:max-w-[90px]">
            {activeProject.branch.replace('*', '')}
          </span>
          <ChevronDown className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
        </button>
      </div>
    </header>
  );
}
