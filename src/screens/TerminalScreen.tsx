import React, { useState, useEffect, useRef } from 'react';
import { useRelay } from '../context/RelayContext';
import { parseAnsiToHtml } from '../services/mockDaemon';
import { SessionDrawer } from '../components/SessionDrawer';
import { DeveloperAccessoryBar } from '../components/DeveloperAccessoryBar';
import { CliMissingInterceptor } from '../components/CliMissingInterceptor';
import { Clock, Search, X } from 'lucide-react';

export function TerminalScreen() {
  const {
    activeSession,
    activeProject,
    fontSize,
  } = useRelay();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [autoScrollLocked, setAutoScrollLocked] = useState(true);
  const bufferEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new lines if locked
  useEffect(() => {
    if (autoScrollLocked && bufferEndRef.current) {
      bufferEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession.buffer, autoScrollLocked]);

  // Requirement 1: Exclude automatic system banners, connection handshakes, and reconciliation logs
  const visibleBuffer = activeSession.buffer.filter((line) => {
    if (line.type === 'system') return false;
    if (line.type === 'reconciled_exec') return false;
    return true;
  });

  const filteredBuffer = searchQuery.trim()
    ? visibleBuffer.filter((line) =>
        line.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : visibleBuffer;

  return (
    <div className="flex flex-col h-full bg-[#111318] select-text">
      {/* 1. Compact Session Switcher Header & Toolbar */}
      <SessionDrawer
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        autoScrollLocked={autoScrollLocked}
        setAutoScrollLocked={setAutoScrollLocked}
      />

      {/* 2. Expandable Search Bar (when active) */}
      {showSearch && (
        <div className="bg-[#181a21] px-3 py-1.5 border-b border-[#262a33] flex items-center gap-2 shrink-0 animate-in slide-in-from-top-1 duration-100">
          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search terminal output..."
            className="w-full bg-transparent text-xs font-mono text-zinc-200 placeholder:text-zinc-500 outline-none"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-zinc-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setShowSearch(false)}
            className="text-[11px] text-zinc-400 hover:text-white font-mono cursor-pointer pl-1"
          >
            Done
          </button>
        </div>
      )}

      {/* 3. Authentic Monospace Terminal Buffer */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-3.5 font-mono leading-relaxed transition-all relative"
        style={{ fontSize: `${fontSize}px` }}
      >
        {filteredBuffer.map((line) => {
          // Command Input line
          if (line.type === 'input') {
            return (
              <div key={line.id} className="pt-2 pb-1 flex items-start gap-2 text-zinc-200">
                <span className="text-zinc-400 font-bold select-none shrink-0">$</span>
                <span className="font-semibold text-zinc-100 break-all">{line.content}</span>
                <span className="text-[10px] text-zinc-600 select-none ml-auto shrink-0 pt-0.5">
                  {line.timestamp}
                </span>
              </div>
            );
          }

          // Offline Intent Buffered line
          if (line.type === 'intent_buffered') {
            return (
              <div
                key={line.id}
                className="py-1 text-amber-300 font-mono text-xs flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-medium text-amber-300">
                  [queued #{String(line.seq || 0).padStart(2, '0')}]
                </span>
                <span className="text-zinc-400">Buffered locally (PC offline)</span>
              </div>
            );
          }

          // Reconciled output line
          if (line.type === 'reconciled_exec') {
            return (
              <div
                key={line.id}
                className="py-0.5 whitespace-pre-wrap break-all leading-relaxed text-zinc-200 font-mono text-xs"
                dangerouslySetInnerHTML={{ __html: parseAnsiToHtml(line.content) }}
              />
            );
          }

          // AI Thought output line
          if (line.type === 'ai_thought') {
            return (
              <div
                key={line.id}
                className="py-0.5 whitespace-pre-wrap break-all leading-relaxed text-zinc-400 font-mono text-xs italic"
                dangerouslySetInnerHTML={{ __html: parseAnsiToHtml(line.content) }}
              />
            );
          }

          // Standard output or error
          return (
            <div
              key={line.id}
              className={`py-0.5 whitespace-pre-wrap break-all leading-relaxed ${
                line.type === 'error' ? 'text-rose-400' : 'text-zinc-300'
              }`}
              dangerouslySetInnerHTML={{ __html: parseAnsiToHtml(line.content) }}
            />
          );
        })}

        {/* Running process indicator */}
        {activeSession.isRunning && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 py-2 font-mono">
            <span className="inline-block w-2 h-2 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
            <span>Process running on PC...</span>
          </div>
        )}

        {/* Authentic terminal prompt line with blinking cursor */}
        <div className="mt-3 pt-1 flex items-center gap-1.5 text-zinc-300 select-none text-xs">
          {activeSession.type === 'cmd' ? (
            <>
              <span className="truncate max-w-[240px] font-medium">{activeProject.path}</span>
              <span className="text-zinc-500 font-bold">&gt;</span>
            </>
          ) : activeSession.type === 'bash' ? (
            <>
              <span className="truncate max-w-[240px] font-medium text-emerald-400">{activeProject.path.replace(/\\/g, '/')}</span>
              <span className="text-zinc-500 font-bold">$</span>
            </>
          ) : activeSession.type === 'codex' ? (
            <>
              <span className="text-cyan-400 font-medium">codex</span>
              <span className="truncate max-w-[200px] font-medium">{activeProject.path}</span>
              <span className="text-zinc-500 font-bold">&gt;</span>
            </>
          ) : activeSession.type === 'gemini' ? (
            <>
              <span className="text-blue-400 font-medium">gemini</span>
              <span className="truncate max-w-[200px] font-medium">{activeProject.path}</span>
              <span className="text-zinc-500 font-bold">&gt;</span>
            </>
          ) : activeSession.type === 'claude' ? (
            <>
              <span className="text-purple-400 font-medium">claude</span>
              <span className="truncate max-w-[200px] font-medium">{activeProject.path}</span>
              <span className="text-zinc-500 font-bold">&gt;</span>
            </>
          ) : activeSession.type === 'antigravity' ? (
            <>
              <span className="text-amber-400 font-medium">antigravity</span>
              <span className="truncate max-w-[190px] font-medium">{activeProject.path}</span>
              <span className="text-zinc-500 font-bold">&gt;</span>
            </>
          ) : activeSession.type === 'build' ? (
            <>
              <span className="text-orange-400 font-medium">[dev-server]</span>
              <span className="truncate max-w-[190px] font-medium">{activeProject.path}</span>
              <span className="text-zinc-500 font-bold">&gt;</span>
            </>
          ) : (
            <>
              <span className="text-zinc-400 font-medium">PS</span>
              <span className="truncate max-w-[220px] font-medium">{activeProject.path}</span>
              <span className="text-zinc-500 font-bold">&gt;</span>
            </>
          )}
          <span className="w-2 h-3.5 bg-zinc-300 inline-block terminal-cursor ml-0.5"></span>
        </div>

        <div ref={bufferEndRef} />
      </div>

      {/* 4. Missing CLI Interceptor Banner (shows if unregistered tool typed) */}
      <CliMissingInterceptor />

      {/* 5. Command Input & Keyboard Accessory Bar directly below terminal */}
      <DeveloperAccessoryBar />
    </div>
  );
}
