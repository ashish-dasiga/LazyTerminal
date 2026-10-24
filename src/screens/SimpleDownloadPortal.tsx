import React, { useState, useEffect } from 'react';
import { Smartphone, Laptop, CheckCircle2, ShieldCheck, ArrowDownToLine } from 'lucide-react';
import { useRelay } from '../context/RelayContext';

export function SimpleDownloadPortal() {
  const { setActiveFrontend } = useRelay();
  const [downloadingApk, setDownloadingApk] = useState(false);
  const [downloadingExe, setDownloadingExe] = useState(false);
  const [apkUrl, setApkUrl] = useState('/downloads/LazyTerminal.apk');
  const [exeUrl, setExeUrl] = useState('/downloads/LazyTerminal-Windows-Setup.exe');
  const [iconUrl, setIconUrl] = useState('/icon.jpeg');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      const base = p.endsWith('/') ? p : p + '/';
      setApkUrl(`${base}downloads/LazyTerminal.apk`);
      setExeUrl(`${base}downloads/LazyTerminal-Windows-Setup.exe`);
      setIconUrl(`${base}icon.jpeg`);
    }
  }, []);

  const handleDownloadApk = () => {
    setDownloadingApk(true);
    setTimeout(() => setDownloadingApk(false), 2500);
  };

  const handleDownloadExe = () => {
    setDownloadingExe(true);
    setTimeout(() => setDownloadingExe(false), 2500);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#07080a] text-zinc-100 flex flex-col items-center justify-center p-6 relative overflow-hidden select-none font-sans">
      {/* Ambient background glow themed to icon */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full pointer-events-none opacity-20 blur-[120px]"
        style={{
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, rgba(37, 99, 235, 0.2) 50%, transparent 80%)'
        }}
      />

      <main className="relative z-10 w-full max-w-md flex flex-col items-center text-center">
        {/* App Icon */}
        <div className="relative group mb-6">
          <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-blue-600/20 to-sky-400/20 blur-md opacity-75 group-hover:opacity-100 transition duration-300" />
          <img
            src={iconUrl}
            alt="Lazy Terminal Icon"
            className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-[#272d3d] shadow-2xl transition duration-200 group-hover:scale-[1.02]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = './icon.jpeg';
            }}
          />
        </div>

        {/* Title & Tagline */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">
          Lazy Terminal
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-sm mb-8 leading-relaxed">
          Local-first Android + Windows development companion.
        </p>

        {/* 2 Simple Download Options */}
        <div className="w-full flex flex-col gap-4">
          {/* Option 1: Download APK */}
          <a
            href={apkUrl}
            download="LazyTerminal.apk"
            onClick={handleDownloadApk}
            className="group relative flex items-center justify-between w-full px-5 py-4 rounded-xl bg-[#12151d] hover:bg-[#181c26] active:scale-[0.98] border border-[#262c3c] hover:border-blue-500/50 shadow-lg transition-all duration-200 cursor-pointer text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
                  Download APK
                </div>
                <div className="text-xs text-zinc-400 font-mono">
                  Android App • v1.0.0
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-zinc-400 group-hover:text-white">
              {downloadingApk ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Started
                </span>
              ) : (
                <ArrowDownToLine className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
              )}
            </div>
          </a>

          {/* Option 2: Download EXE */}
          <a
            href={exeUrl}
            download="LazyTerminal-Windows-Setup.exe"
            onClick={handleDownloadExe}
            className="group relative flex items-center justify-between w-full px-5 py-4 rounded-xl bg-[#12151d] hover:bg-[#181c26] active:scale-[0.98] border border-[#262c3c] hover:border-blue-500/50 shadow-lg transition-all duration-200 cursor-pointer text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
                  Download EXE
                </div>
                <div className="text-xs text-zinc-400 font-mono">
                  Windows Companion • x64 Native
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-zinc-400 group-hover:text-white">
              {downloadingExe ? (
                <span className="flex items-center gap-1.5 text-xs text-sky-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Started
                </span>
              ) : (
                <ArrowDownToLine className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
              )}
            </div>
          </a>
        </div>

        {/* Option to launch directly in browser */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setActiveFrontend('mobile')}
            className="text-xs text-zinc-400 hover:text-sky-400 underline underline-offset-4 transition-colors cursor-pointer"
          >
            Or open Mobile Web App directly in browser &rarr;
          </button>
        </div>

        {/* Minimalist Trust & Security Footer */}
        <div className="mt-8 flex items-center gap-2 text-xs text-zinc-500">
          <ShieldCheck className="w-4 h-4 text-zinc-400" />
          <span>100% Free & Local • No Cloud Relay</span>
        </div>
      </main>
    </div>
  );
}

export default SimpleDownloadPortal;
