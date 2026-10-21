import React from 'react';
import { useRelay } from '../context/RelayContext';
import { 
  Terminal as TerminalIcon, 
  Folder, 
  GitBranch, 
  Globe, 
  MoreHorizontal
} from 'lucide-react';
import { MobileNavSection } from '../types/relay';

export function BottomNavigation() {
  const { mobileNav, setMobileNav, intentQueue } = useRelay();

  const queuedCount = intentQueue.filter(
    (i) => i.status === 'queued' || i.status === 'diverged'
  ).length;

  const tabs: Array<{ id: MobileNavSection; label: string; icon: React.ReactNode; badge?: number | string }> = [
    {
      id: 'terminal',
      label: 'Terminal',
      icon: <TerminalIcon className="w-4 h-4" />,
    },
    {
      id: 'explorer',
      label: 'Explorer',
      icon: <Folder className="w-4 h-4" />,
    },
    {
      id: 'git',
      label: 'Git',
      icon: <GitBranch className="w-4 h-4" />,
    },
    {
      id: 'preview',
      label: 'Preview',
      icon: <Globe className="w-4 h-4" />,
    },
    {
      id: 'more',
      label: 'More',
      icon: <MoreHorizontal className="w-4 h-4" />,
      badge: queuedCount > 0 ? queuedCount : undefined,
    },
  ];

  return (
    <nav className="bg-[#16181e] border-t border-[#252831] px-2 py-1 z-30 shrink-0 select-none">
      <div className="grid grid-cols-5 items-center max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = mobileNav === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setMobileNav(tab.id)}
              className={`flex flex-col items-center justify-center min-h-[42px] py-0.5 rounded transition-colors cursor-pointer relative ${
                isActive
                  ? 'text-blue-400 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title={tab.label}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge && (
                  <span className="absolute -top-1 -right-2.5 min-w-[14px] h-[14px] px-1 bg-amber-500/20 text-amber-300 border border-amber-600/40 font-mono font-semibold text-[8.5px] rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-1">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
