import React, { useState, useRef, KeyboardEvent } from 'react';
import { useRelay } from '../context/RelayContext';
import { Send, CornerDownLeft, ArrowUp, ArrowDown, X, MoreHorizontal } from 'lucide-react';

interface DeveloperAccessoryBarProps {
  onFocusInput?: () => void;
}

export function DeveloperAccessoryBar({ onFocusInput }: DeveloperAccessoryBarProps) {
  const {
    executeCommand,
    sendSignal,
    history,
    device,
    activeProject,
    activeSession,
  } = useRelay();

  const [inputVal, setInputVal] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [showMoreKeys, setShowMoreKeys] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick suggestions for the secondary drawer
  const getSuggestions = () => {
    if (activeSession.type === 'claude') {
      return ['claude "explain code"', 'claude "review diff"'];
    }
    if (activeSession.type === 'codex') {
      return ['codex "generate tests"', 'codex "explain function"'];
    }
    if (activeSession.type === 'gemini') {
      return ['gemini "analyze repo"', 'gemini auth login'];
    }
    if (activeSession.type === 'antigravity') {
      return ['antigravity status', 'antigravity connect'];
    }
    if (activeSession.type === 'build') {
      return ['npm run dev', 'npm run build', 'npm test'];
    }
    return ['git status', 'git diff', 'npm test', 'dir', 'cargo check'];
  };

  const suggestions = getSuggestions();

  const handleSend = () => {
    if (!inputVal.trim()) return;
    executeCommand(inputVal);
    setInputVal('');
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateHistory('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateHistory('down');
    }
  };

  const navigateHistory = (dir: 'up' | 'down') => {
    if (history.length === 0) return;
    if (dir === 'up') {
      const nextIdx = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(nextIdx);
      setInputVal(history[nextIdx] || '');
    } else {
      const nextIdx = Math.max(historyIndex - 1, -1);
      setHistoryIndex(nextIdx);
      setInputVal(nextIdx === -1 ? '' : history[nextIdx]);
    }
  };

  const insertText = (char: string) => {
    setInputVal((prev) => prev + char);
    inputRef.current?.focus();
  };

  return (
    <div className="bg-[#15171d] border-t border-[#252831] px-3 pt-1.5 pb-2 space-y-1.5 shrink-0 z-20 select-none">
      {/* 1. Main Keyboard Accessory Bar (Esc, Tab, Ctrl+C, Ctrl+D, ↑, ↓, and ···) */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            setInputVal('');
            inputRef.current?.blur();
          }}
          className="h-7 min-w-[34px] px-2 bg-[#1c1f26] hover:bg-[#232731] active:bg-[#282d38] text-zinc-300 hover:text-white border border-[#2b303b] rounded text-[11px] font-mono transition-colors cursor-pointer"
          title="Escape"
        >
          Esc
        </button>

        <button
          onClick={() => insertText('  ')}
          className="h-7 min-w-[34px] px-2 bg-[#1c1f26] hover:bg-[#232731] active:bg-[#282d38] text-zinc-300 hover:text-white border border-[#2b303b] rounded text-[11px] font-mono transition-colors cursor-pointer"
          title="Tab indent"
        >
          Tab
        </button>

        <button
          onClick={() => sendSignal('SIGINT')}
          className="h-7 px-2 bg-[#1c1f26] hover:bg-rose-950/30 text-zinc-300 hover:text-rose-200 border border-[#2b303b] rounded text-[11px] font-mono transition-colors cursor-pointer"
          title="Send SIGINT (Ctrl+C)"
        >
          Ctrl+C
        </button>

        <button
          onClick={() => sendSignal('SIGINT')}
          className="h-7 px-2 bg-[#1c1f26] hover:bg-[#232731] text-zinc-300 hover:text-white border border-[#2b303b] rounded text-[11px] font-mono transition-colors cursor-pointer"
          title="Send EOF (Ctrl+D)"
        >
          Ctrl+D
        </button>

        <button
          onClick={() => navigateHistory('up')}
          className="h-7 min-w-[32px] px-1.5 bg-[#1c1f26] hover:bg-[#232731] active:bg-[#282d38] text-zinc-300 hover:text-white border border-[#2b303b] rounded text-[11px] font-mono flex items-center justify-center transition-colors cursor-pointer"
          title="Previous command in history (↑)"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => navigateHistory('down')}
          className="h-7 min-w-[32px] px-1.5 bg-[#1c1f26] hover:bg-[#232731] active:bg-[#282d38] text-zinc-300 hover:text-white border border-[#2b303b] rounded text-[11px] font-mono flex items-center justify-center transition-colors cursor-pointer"
          title="Next command in history (↓)"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1" />

        {/* More Keys Toggle (···) */}
        <button
          onClick={() => setShowMoreKeys(!showMoreKeys)}
          className={`h-7 px-2 rounded border text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer ${
            showMoreKeys
              ? 'bg-[#242833] text-blue-400 border-blue-500/50'
              : 'bg-[#1c1f26] hover:bg-[#232731] text-zinc-400 hover:text-zinc-200 border-[#2b303b]'
          }`}
          title="Toggle more keyboard shortcuts and symbols"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Secondary Hidden Keys Row (Expands when ··· is tapped) */}
      {showMoreKeys && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 pb-1 animate-in fade-in duration-100">
          <button
            onClick={() => insertText('|')}
            className="h-6.5 px-2 bg-[#191c23] hover:bg-[#222630] text-zinc-300 rounded text-xs font-mono border border-[#272b35] cursor-pointer"
            title="Pipe symbol"
          >
            |
          </button>
          <button
            onClick={() => insertText('~')}
            className="h-6.5 px-2 bg-[#191c23] hover:bg-[#222630] text-zinc-300 rounded text-xs font-mono border border-[#272b35] cursor-pointer"
            title="Home directory ~"
          >
            ~
          </button>
          <button
            onClick={() => insertText('/')}
            className="h-6.5 px-2 bg-[#191c23] hover:bg-[#222630] text-zinc-300 rounded text-xs font-mono border border-[#272b35] cursor-pointer"
            title="Slash"
          >
            /
          </button>
          <button
            onClick={() => insertText('-')}
            className="h-6.5 px-2 bg-[#191c23] hover:bg-[#222630] text-zinc-300 rounded text-xs font-mono border border-[#272b35] cursor-pointer"
            title="Hyphen"
          >
            -
          </button>
          <button
            onClick={() => sendSignal('CLEAR')}
            className="h-6.5 px-2 bg-[#191c23] hover:bg-[#222630] text-zinc-400 hover:text-rose-300 rounded text-xs font-mono border border-[#272b35] cursor-pointer"
            title="Clear screen"
          >
            Clear
          </button>

          <span className="text-zinc-600 text-xs px-0.5">|</span>

          {suggestions.map((sug) => (
            <button
              key={sug}
              onClick={() => {
                setInputVal(sug);
                inputRef.current?.focus();
              }}
              className="h-6.5 px-2 bg-[#191c23] hover:bg-[#222630] text-zinc-400 hover:text-white rounded text-[11px] font-mono border border-[#272b35] shrink-0 cursor-pointer"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {/* 3. Restrained, Clean Terminal Command Input Bar */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1 flex items-center group">
          <span className="absolute left-3 text-zinc-400 font-mono text-xs pointer-events-none select-none">
            $
          </span>

          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              device.isOnline
                ? `Run command on ${activeProject.name}...`
                : `Draft command (queued locally)...`
            }
            className="w-full h-11 pl-7 pr-8 bg-[#181a20] border border-[#2b2f3b] hover:border-[#373c4a] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-md text-xs font-mono text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck="false"
          />

          {inputVal && (
            <button
              onClick={() => setInputVal('')}
              className="absolute right-2.5 p-1 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              title="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={!inputVal.trim()}
          className={`h-11 px-3.5 rounded-md font-medium text-xs flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
            inputVal.trim()
              ? device.isOnline
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs'
              : 'bg-[#1b1d24] text-zinc-600 border border-[#262933] cursor-not-allowed'
          }`}
          title={device.isOnline ? 'Execute on Windows PC' : 'Buffer locally while offline'}
        >
          {device.isOnline ? (
            <Send className="w-3.5 h-3.5" />
          ) : (
            <CornerDownLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
