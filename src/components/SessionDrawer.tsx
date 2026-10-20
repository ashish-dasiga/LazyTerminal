import React, { useState } from 'react';
import { useRelay } from '../context/RelayContext';
import { 
  Terminal, 
  Sparkles, 
  Cpu, 
  Flame, 
  ChevronDown, 
  X, 
  Check,
  Search,
  Lock,
  Unlock,
  SlidersHorizontal,
  Trash2,
  Bot,
  Boxes
} from 'lucide-react';
import { TerminalSession } from '../types/relay';

interface SessionHeaderProps {
  showSearch: boolean;
  setShowSearch: (show: boolean) => void;
  autoScrollLocked: boolean;
  setAutoScrollLocked: (locked: boolean) => void;
}

export function SessionDrawer({
  showSearch,
  setShowSearch,
  autoScrollLocked,
  setAutoScrollLocked,
}: SessionHeaderProps) {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    activeSession,
    createSession,
    closeSession,
    fontSize,
    setFontSize,
    sendSignal,
    cliTools,
    devServers,
  } = useRelay();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  const getSessionIcon = (type: TerminalSession['type']) => {
    switch (type) {
      case 'claude':
        return <Sparkles className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
      case 'codex':
        return <Cpu className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
      case 'gemini':
        return <Bot className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
      case 'antigravity':
        return <Boxes className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
      case 'build':
        return <Flame className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    }
  };

  // Resolve tool availability based on real state from cliTools context
  const claudeTool = cliTools.find((t) => t.id === 'claude');
  const codexTool = cliTools.find((t) => t.id === 'codex');
  const geminiTool = cliTools.find((t) => t.id === 'gemini');
  const antigravityTool = cliTools.find((t) => t.id === 'antigravity');

  const getToolStatusBadge = (tool?: typeof claudeTool) => {
    if (!tool) {
      return { status: 'Unavailable', badgeClass: 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50' };
    }
    if (tool.status === 'installed' || tool.status === 'running') {
      return { status: 'Installed', badgeClass: 'bg-zinc-800 text-zinc-300' };
    }
    if (tool.status === 'needs_setup') {
      return { status: 'Needs Setup', badgeClass: 'bg-amber-950/60 text-amber-300 border border-amber-800/40' };
    }
    return { status: 'Unavailable', badgeClass: 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50' };
  };

  const claudeStatus = getToolStatusBadge(claudeTool);
  const codexStatus = getToolStatusBadge(codexTool);
  const geminiStatus = getToolStatusBadge(geminiTool);
  const antigravityStatus = getToolStatusBadge(antigravityTool);

  const isDevServerRunning = devServers.some((s) => s.status === 'active');

  // Group 1: Shells (3 options)
  const shellOptions = [
    {
      id: 'powershell',
      title: 'PowerShell 7.4',
      type: 'powershell' as const,
      subtitle: 'Native Windows ConPTY host shell',
      status: 'Installed',
      badgeClass: 'bg-zinc-800 text-zinc-300',
      icon: <Terminal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
    },
    {
      id: 'cmd',
      title: 'Command Prompt (CMD)',
      type: 'cmd' as const,
      subtitle: 'Windows cmd.exe environment',
      status: 'Installed',
      badgeClass: 'bg-zinc-800 text-zinc-300',
      icon: <Terminal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
    },
    {
      id: 'bash',
      title: 'Bash (WSL)',
      type: 'bash' as const,
      subtitle: 'Git Bash / WSL environment',
      status: 'Installed',
      badgeClass: 'bg-zinc-800 text-zinc-300',
      icon: <Terminal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
    },
  ];

  // Group 2: AI Coding Tools (All 4 entries: Claude Code, Codex CLI, Gemini CLI, Antigravity)
  const aiCodingToolOptions = [
    {
      id: 'claude',
      title: 'Claude Code',
      type: 'claude' as const,
      subtitle: `Anthropic CLI agent · ${claudeTool?.version || 'v1.0.8'}`,
      status: claudeStatus.status,
      badgeClass: claudeStatus.badgeClass,
      icon: <Sparkles className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
    },
    {
      id: 'codex',
      title: 'Codex CLI',
      type: 'codex' as const,
      subtitle: `OpenAI code synthesizer · ${codexTool?.version || 'v0.9.4'}`,
      status: codexStatus.status,
      badgeClass: codexStatus.badgeClass,
      icon: <Cpu className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
    },
    {
      id: 'gemini',
      title: 'Gemini CLI',
      type: 'gemini' as const,
      subtitle: `Google developer CLI · ${geminiTool?.version || 'v2.5.0'}`,
      status: geminiStatus.status,
      badgeClass: geminiStatus.badgeClass,
      icon: <Bot className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
    },
    {
      id: 'antigravity',
      title: 'Antigravity',
      type: 'antigravity' as const,
      subtitle: 'Agent runtime · Host bridge active',
      status: antigravityStatus.status,
      badgeClass: antigravityStatus.badgeClass,
      icon: <Boxes className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
    },
  ];

  // Group 3: Development Sessions (1 option)
  const devSessionOptions = [
    {
      id: 'build',
      title: 'Dev Server Watcher',
      type: 'build' as const,
      subtitle: 'npm run dev · Vite 5.4 watcher',
      status: '',
      badgeClass: '',
      icon: <Flame className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
    },
  ];

  // Selection handler: Switches to existing session in context or creates it
  const handleSelectOption = (title: string, type: TerminalSession['type']) => {
    const existing = sessions.find((s) => s.type === type);
    if (existing) {
      setActiveSessionId(existing.id);
    } else {
      createSession(title, type);
    }
    setIsMenuOpen(false);
  };

  const renderOptionRow = (opt: {
    id: string;
    title: string;
    type: TerminalSession['type'];
    subtitle: string;
    status: string;
    badgeClass: string;
    icon: React.ReactNode;
  }) => {
    const existingSession = sessions.find((s) => s.type === opt.type);
    const isActive = existingSession ? existingSession.id === activeSessionId : activeSession.type === opt.type;

    return (
      <div
        key={opt.id}
        onClick={() => handleSelectOption(opt.title, opt.type)}
        className={`flex items-center justify-between px-2.5 py-1.5 rounded transition-colors cursor-pointer ${
          isActive
            ? 'bg-[#242833] text-white font-medium'
            : 'text-zinc-300 hover:bg-[#1f222b]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 mr-2">
          {opt.icon}
          <div className="truncate">
            <div className="flex items-center gap-1.5 truncate">
              <span className="truncate text-xs font-mono">{opt.title}</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-sans truncate">{opt.subtitle}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {opt.status ? (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${opt.badgeClass}`}>
              {opt.status}
            </span>
          ) : null}
          {isActive && <Check className="w-3.5 h-3.5 text-blue-400" />}
          {existingSession && sessions.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeSession(existingSession.id);
              }}
              className="p-1 text-zinc-500 hover:text-rose-400 rounded transition-colors"
              title="Close session"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-[#15171d] border-b border-[#252831] px-3 py-1.5 flex items-center justify-between text-xs font-mono select-none shrink-0 ${
      isMenuOpen ? 'z-50' : 'z-20'
    }`}>
      {/* Left: Compact Session Switcher */}
      <div className="relative flex items-center gap-1.5">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="group flex items-center gap-1.5 px-2 py-1 bg-[#1c1f26] hover:bg-[#232731] active:bg-[#282d38] border border-[#2b303b] hover:border-[#383d4a] rounded transition-colors text-zinc-300 hover:text-white cursor-pointer text-xs"
          title="Switch shell session"
        >
          <span className="text-[11px] text-zinc-500 font-sans">session:</span>
          {getSessionIcon(activeSession.type)}
          <span className="font-medium text-zinc-200 truncate max-w-[130px]">
            {activeSession.title}
          </span>
          <ChevronDown
            className={`w-3 h-3 text-zinc-400 transition-transform duration-150 ml-0.5 ${
              isMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu for Sessions: Properly constrained height, self-contained vertical scroll, no clipping */}
        {isMenuOpen && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]" 
              onClick={() => setIsMenuOpen(false)} 
            />
            <div 
              className="absolute top-9 left-0 z-50 w-[305px] max-w-[calc(100vw-24px)] max-h-[260px] sm:max-h-[290px] overflow-y-auto overscroll-contain bg-[#191c23] border border-[#2b303b] rounded-lg shadow-2xl p-1.5 text-xs font-mono space-y-2 animate-in fade-in duration-100"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#3f3f46 #18181b',
              }}
            >
              {/* Header */}
              <div className="px-2 py-1 text-[10px] text-zinc-400 uppercase tracking-wider font-semibold border-b border-[#242832] flex items-center justify-between sticky top-0 bg-[#191c23] z-10 -mt-1.5 -mx-1.5 p-1.5 rounded-t-lg">
                <span>Terminal Sessions</span>
                <span className="text-[10px] text-zinc-500 font-normal">{sessions.length} sessions</span>
              </div>

              {/* Group 1: Shells */}
              <div className="space-y-0.5">
                <div className="px-2 py-0.5 text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">
                  Shells
                </div>
                {shellOptions.map(renderOptionRow)}
              </div>

              {/* Group 2: AI Coding Tools (Claude Code, Codex CLI, Gemini CLI, Antigravity) */}
              <div className="pt-1.5 border-t border-[#242832] space-y-0.5">
                <div className="px-2 py-0.5 text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">
                  AI Coding Tools
                </div>
                {aiCodingToolOptions.map(renderOptionRow)}
              </div>

              {/* Group 3: Development Sessions */}
              <div className="pt-1.5 border-t border-[#242832] space-y-0.5">
                <div className="px-2 py-0.5 text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">
                  Development Sessions
                </div>
                {devSessionOptions.map(renderOptionRow)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right: Minimal Terminal Utilities */}
      <div className="flex items-center gap-1">
        {/* Search */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`p-1 rounded transition-colors cursor-pointer ${
            showSearch
              ? 'bg-[#222631] text-blue-400'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1c1f26]'
          }`}
          title="Search buffer"
        >
          <Search className="w-3.5 h-3.5" />
        </button>

        {/* Auto Scroll Lock */}
        <button
          onClick={() => setAutoScrollLocked(!autoScrollLocked)}
          className={`p-1 rounded transition-colors cursor-pointer ${
            autoScrollLocked
              ? 'text-emerald-400 hover:bg-[#1c1f26]'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#1c1f26]'
          }`}
          title={autoScrollLocked ? 'Auto-scroll is on' : 'Auto-scroll is paused'}
        >
          {autoScrollLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>

        {/* More Options Popover */}
        <div className="relative">
          <button
            onClick={() => setIsOptionsOpen(!isOptionsOpen)}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-[#1c1f26] rounded transition-colors cursor-pointer"
            title="Terminal view options"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          {isOptionsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOptionsOpen(false)} />
              <div className="absolute right-0 top-8 z-50 w-44 bg-[#191c23] border border-[#2b303b] rounded-lg shadow-xl p-2 space-y-2 text-xs font-mono animate-in fade-in duration-100">
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="text-[11px] text-zinc-400">Font Size</span>
                  <div className="flex items-center gap-1 bg-[#20242e] px-1.5 py-0.5 rounded border border-[#2b303b]">
                    <button
                      onClick={() => setFontSize((s) => Math.max(10, s - 1))}
                      className="px-1 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-[11px] text-zinc-200 font-semibold">{fontSize}px</span>
                    <button
                      onClick={() => setFontSize((s) => Math.min(18, s + 1))}
                      className="px-1 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    sendSignal('CLEAR');
                    setIsOptionsOpen(false);
                  }}
                  className="w-full pt-1.5 border-t border-[#242832] flex items-center gap-1.5 text-rose-400 hover:text-rose-300 text-[11px] cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Clear Buffer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
