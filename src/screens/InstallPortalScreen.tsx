import React, { useState, useEffect } from 'react';
import { useRelay } from '../context/RelayContext';
import { QrCodeView } from '../components/QrCodeView';
import {
  Smartphone,
  Laptop,
  Download,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  Terminal as TerminalIcon,
  Wifi,
  ExternalLink,
  ChevronRight,
  Server,
  Zap,
  Lock,
  ArrowRight,
  Sparkles,
  Layers,
  HardDrive
} from 'lucide-react';

export function InstallPortalScreen() {
  const { setActiveFrontend, connectionStep, device } = useRelay();

  // Active tab in the portal: 'all' | 'mobile' | 'windows' | 'web'
  const [activeTab, setActiveTab] = useState<'all' | 'mobile' | 'windows' | 'web'>('all');

  // Copy feedback states
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedClone, setCopiedClone] = useState(false);

  // LAN IP resolution
  const [lanIp, setLanIp] = useState<string>('');
  const [hostPort, setHostPort] = useState<number>(3000);

  // PWA install prompt state
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [installSuccess, setInstallSuccess] = useState<boolean>(false);

  useEffect(() => {
    // Detect if running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Capture PWA beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setInstallSuccess(true);
    });

    // Detect LAN IP from companion API or fallback to window.location
    fetch('/api/v1/preview/lan-ip')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ip) setLanIp(data.ip);
        else setLanIp(window.location.hostname || '127.0.0.1');
      })
      .catch(() => {
        setLanIp(window.location.hostname || '127.0.0.1');
      });

    if (window.location.port) {
      setHostPort(Number(window.location.port));
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const mobileUrl = `http://${lanIp || window.location.hostname || '127.0.0.1'}:${hostPort}`;
  const psOneLiner = `powershell -ExecutionPolicy Bypass -Command "irm ${mobileUrl}/downloads/LazyTerminal-Windows-Setup.ps1 | iex"`;
  const gitCloneCmd = `git clone https://github.com/ashish-dasiga/LazyTerminal.git && cd LazyTerminal && npm install && npm run host`;

  const handleInstallPwa = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setInstallSuccess(true);
      }
      setInstallPrompt(null);
    } else {
      // Fallback instructions alert or tooltip
      alert(
        'To install Lazy Terminal on Android:\n1. Tap the Chrome three-dot menu (⋮) in the top-right.\n2. Tap "Install app" or "Add to Home screen".\n\nOn Desktop Chrome/Edge: Click the install icon in the URL bar.'
      );
    }
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#07080a] text-zinc-100 font-sans selection:bg-blue-600/30">
      {/* Top Background Ambient Glow */}
      <div className="relative overflow-hidden border-b border-[#1b1f2a]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[280px] bg-gradient-to-b from-blue-600/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-8 relative z-10">
          {/* Header Row: Branding + App Icon */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5 text-center md:text-left">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden p-0.5 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-950 border border-[#2b3040] shadow-2xl ring-1 ring-white/10">
                  <img
                    src="/icon.jpeg"
                    alt="Lazy Terminal App Icon"
                    className="w-full h-full object-cover rounded-[14px]"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-sm">
                  <Zap className="w-3.5 h-3.5 fill-emerald-400" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Lazy Terminal
                  </h1>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/25">
                    v1.0.0 MVP
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                    ₹0 Cloud-Free
                  </span>
                </div>

                <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                  Mobile-first, local-first Android + Windows PC development companion. Control persistent ConPTY terminals, safe PC filesystem editing, Git operations, and AI coding agents over your local Wi-Fi.
                </p>
              </div>
            </div>

            {/* Live System Status Widget */}
            <div className="bg-[#0f121a] border border-[#222838] rounded-xl p-3 sm:p-4 text-xs font-mono w-full md:w-auto min-w-[280px] shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-[#1c2230] mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-zinc-300 font-semibold uppercase tracking-wider text-[11px]">
                    Host Companion
                  </span>
                </div>
                <span className="text-emerald-400 font-medium">Ready to Pair</span>
              </div>

              <div className="space-y-1.5 text-zinc-400">
                <div className="flex justify-between">
                  <span>Local LAN IP:</span>
                  <span className="text-zinc-200 font-semibold">{lanIp || '127.0.0.1'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Companion Port:</span>
                  <span className="text-zinc-200">{hostPort} / 9871</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Architecture:</span>
                  <span className="text-zinc-200">Local ConPTY + SSE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Tabs */}
          <div className="mt-8 flex items-center justify-between gap-3 flex-wrap pt-4 border-t border-[#181c26]">
            <div className="flex items-center gap-1.5 p-1 bg-[#10131a] border border-[#202534] rounded-lg text-xs font-medium">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All Installation Options
              </button>
              <button
                onClick={() => setActiveTab('mobile')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'mobile'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android Mobile</span>
              </button>
              <button
                onClick={() => setActiveTab('windows')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'windows'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Windows PC</span>
              </button>
              <button
                onClick={() => setActiveTab('web')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'web'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Launch Web Apps</span>
              </button>
            </div>

            {/* Launch In-Browser Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveFrontend('mobile')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1f2c] hover:bg-[#252c3e] border border-[#2c344a] text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                <span>Open Mobile View</span>
              </button>
              <button
                onClick={() => setActiveFrontend('laptop')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1f2c] hover:bg-[#252c3e] border border-[#2c344a] text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                <span>Open Laptop View</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* ========================================================================= */}
        {/* SECTION 1: ANDROID MOBILE INSTALLATION                                    */}
        {/* ========================================================================= */}
        {(activeTab === 'all' || activeTab === 'mobile') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Android Mobile App Installation
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Control your Windows development environment from your phone
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-zinc-500 hidden sm:inline">
                Android 10+ (API 29+)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Option A: PWA Instant Install (Recommended) */}
              <div className="md:col-span-2 bg-[#0d1017] border border-[#212736] hover:border-blue-500/40 transition-colors rounded-xl p-5 sm:p-6 flex flex-col justify-between shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 px-3 py-1 bg-blue-500/15 border-b border-l border-blue-500/30 text-blue-300 font-mono text-[10px] font-semibold rounded-bl-lg uppercase tracking-wider">
                  Recommended Instant Install
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-[#2b3244] shrink-0 shadow-md">
                      <img
                        src="/icon.jpeg"
                        alt="Lazy Terminal Icon"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">
                        Install as Android Web App (PWA)
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Zero download delay. Installs directly to your home screen with native app icon, standalone fullscreen, and offline cache.
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#121520] border border-[#202534] rounded-lg p-3.5 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Standalone phone viewport without browser address bars</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Persistent local IndexedDB intent queuing when offline</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Sub-15ms terminal streaming over local Wi-Fi</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1a1f2b] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <button
                    onClick={handleInstallPwa}
                    disabled={isInstalled}
                    className={`px-5 py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                      isInstalled
                        ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-[0.98]'
                    }`}
                  >
                    {isInstalled ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Installed on this Device</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Install to Android Home Screen</span>
                      </>
                    )}
                  </button>

                  <a
                    href="/downloads/LazyTerminal.apk"
                    download="LazyTerminal.apk"
                    className="px-4 py-2.5 rounded-lg font-medium text-xs bg-[#161a24] hover:bg-[#1e2332] text-zinc-300 border border-[#293042] flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Download APK (.apk)</span>
                  </a>
                </div>
              </div>

              {/* Option B: Scan QR Code from Phone */}
              <div className="bg-[#0d1017] border border-[#212736] rounded-xl p-5 flex flex-col items-center justify-between text-center shadow-xl">
                <div>
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-300 mb-1">
                    <QrCode className="w-4 h-4 text-cyan-400" />
                    <span>Scan with Android Camera</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mb-4 max-w-[220px]">
                    Point your phone camera at this QR code to launch on the same local Wi-Fi.
                  </p>
                </div>

                <div className="my-1">
                  <QrCodeView value={mobileUrl} size={150} />
                </div>

                <div className="mt-4 w-full">
                  <div className="flex items-center justify-between bg-[#121622] border border-[#222838] rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-zinc-300">
                    <span className="truncate pr-2">{mobileUrl}</span>
                    <button
                      onClick={() => copyToClipboard(mobileUrl, setCopiedUrl)}
                      className="p-1 rounded hover:bg-[#1c2234] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Copy Mobile URL"
                    >
                      {copiedUrl ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Setup Walkthrough */}
            <div className="bg-[#0b0e14] border border-[#1d222e] rounded-xl p-4 sm:p-5">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">
                4-Step Pairing Workflow
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-[#11141c] border border-[#1e2330] rounded-lg space-y-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-bold text-[10px] flex items-center justify-center">
                    1
                  </span>
                  <div className="font-semibold text-zinc-200">Connect to Same Wi-Fi</div>
                  <p className="text-[11px] text-zinc-400">
                    Ensure your Android phone and Windows PC are connected to the same local router.
                  </p>
                </div>

                <div className="p-3 bg-[#11141c] border border-[#1e2330] rounded-lg space-y-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-bold text-[10px] flex items-center justify-center">
                    2
                  </span>
                  <div className="font-semibold text-zinc-200">Open on Phone</div>
                  <p className="text-[11px] text-zinc-400">
                    Scan the QR code or navigate to <span className="font-mono text-zinc-300">{mobileUrl}</span>.
                  </p>
                </div>

                <div className="p-3 bg-[#11141c] border border-[#1e2330] rounded-lg space-y-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-bold text-[10px] flex items-center justify-center">
                    3
                  </span>
                  <div className="font-semibold text-zinc-200">Enter 6-Digit Key</div>
                  <p className="text-[11px] text-zinc-400">
                    Type the random token displayed on your PC Companion into the phone prompt.
                  </p>
                </div>

                <div className="p-3 bg-[#11141c] border border-[#1e2330] rounded-lg space-y-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-mono font-bold text-[10px] flex items-center justify-center">
                    4
                  </span>
                  <div className="font-semibold text-zinc-200">Instant Remote Studio</div>
                  <p className="text-[11px] text-zinc-400">
                    Enjoy real PowerShell terminal, safe PC file editor, Git sync, and AI agents.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: WINDOWS PC COMPANION INSTALLATION                              */}
        {/* ========================================================================= */}
        {(activeTab === 'all' || activeTab === 'windows') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                  <Laptop className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Windows PC Companion Installation
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Local ConPTY terminal server, filesystem adapter, and Git runner
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-zinc-500 hidden sm:inline">
                Windows 10 / 11 (64-bit)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Option 1: Standalone Package Download */}
              <div className="bg-[#0d1017] border border-[#212736] hover:border-cyan-500/40 transition-colors rounded-xl p-5 sm:p-6 flex flex-col justify-between shadow-xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 uppercase">
                      Offline Package
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">ZIP bundle (~23 KB)</span>
                  </div>

                  <h3 className="text-base font-bold text-white tracking-tight">
                    Download Windows Companion Bundle
                  </h3>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Includes the portable launch script, desktop batch launcher, and companion config. Extract and double-click to start the background daemon.
                  </p>

                  <div className="p-3 bg-[#11141c] border border-[#1e2330] rounded-lg text-xs space-y-1.5 font-mono text-zinc-300">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Zero administrator privilege required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Auto-detects active LAN interface and ports</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Generates cryptographic 6-digit session PINs</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1a1f2b] flex flex-wrap gap-2.5">
                  <a
                    href="/downloads/LazyTerminal-Windows-Setup.exe"
                    download="LazyTerminal-Windows-Setup.exe"
                    className="flex-1 min-w-[200px] px-4 py-2.5 rounded-lg font-semibold text-xs bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Windows .EXE</span>
                  </a>

                  <a
                    href="/downloads/LazyTerminal-Windows-Companion.zip"
                    download="LazyTerminal-Windows-Companion.zip"
                    className="px-3 py-2.5 rounded-lg font-medium text-xs bg-[#161a24] hover:bg-[#1f2434] text-zinc-300 border border-[#2a3142] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-400" />
                    <span>ZIP</span>
                  </a>

                  <a
                    href="/downloads/LazyTerminal-Windows-Setup.bat"
                    download="LazyTerminal-Windows-Setup.bat"
                    className="px-3 py-2.5 rounded-lg font-medium text-xs bg-[#161a24] hover:bg-[#1f2434] text-zinc-300 border border-[#2a3142] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <TerminalIcon className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Setup.bat</span>
                  </a>
                </div>
              </div>

              {/* Option 2: PowerShell Instant One-Liner */}
              <div className="bg-[#0d1017] border border-[#212736] hover:border-blue-500/40 transition-colors rounded-xl p-5 sm:p-6 flex flex-col justify-between shadow-xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/25 uppercase">
                      Terminal Fast Start
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">PowerShell 5.1 / 7+</span>
                  </div>

                  <h3 className="text-base font-bold text-white tracking-tight">
                    Launch via PowerShell One-Liner
                  </h3>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Paste this command into Windows PowerShell or Windows Terminal to download the launcher script and start the host companion daemon immediately:
                  </p>

                  <div className="relative group">
                    <pre className="p-3 bg-[#090b10] border border-[#1e2332] rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap break-all leading-normal">
                      {psOneLiner}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(psOneLiner, setCopiedScript)}
                      className="absolute top-2 right-2 px-2 py-1 rounded bg-[#181d2a] hover:bg-[#232a3d] border border-[#2c344a] text-zinc-300 text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedScript ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#1a1f2b] flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Path traversal protected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Credentials redacted</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Developer Git Clone & Build Option */}
            <div className="bg-[#0b0e14] border border-[#1d222e] rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-zinc-200">
                  Building from Source / Local Git Repository?
                </div>
                <p className="text-[11px] text-zinc-400">
                  You can run the full companion server using Node.js 18+ and npm:
                </p>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="flex-1 md:w-80 bg-[#10131a] border border-[#202534] rounded-lg px-3 py-1.5 text-[11px] font-mono text-zinc-300 truncate">
                  {gitCloneCmd}
                </div>
                <button
                  onClick={() => copyToClipboard(gitCloneCmd, setCopiedClone)}
                  className="px-3 py-1.5 rounded-lg bg-[#181d2a] hover:bg-[#232a3d] border border-[#2c344a] text-zinc-200 text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  {copiedClone ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedClone ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* SECTION 3: IN-BROWSER DUAL-FRONTEND STUDIO                                */}
        {/* ========================================================================= */}
        {(activeTab === 'all' || activeTab === 'web') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Interactive In-Browser Developer Studio
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Try the exact phone and desktop interfaces without installing anything
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Studio Card 1: Mobile Phone Interface */}
              <div
                onClick={() => setActiveFrontend('mobile')}
                className="bg-[#0d1017] border border-[#212736] hover:border-blue-500/50 p-5 sm:p-6 rounded-xl transition-all cursor-pointer group shadow-xl relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                        Launch Mobile Phone UI
                      </h3>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                      Opens the mobile-frame view designed for Android screens: quick terminal tabs, touch accessory bar, file tree explorer, Git staging, offline intent ledger, and AI coding agents.
                    </p>
                  </div>

                  <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                </div>

                <div className="mt-5 pt-3 border-t border-[#181c26] flex items-center gap-4 text-[11px] text-zinc-400 font-mono">
                  <span>• ANSI Terminal</span>
                  <span>• SHA-256 Git</span>
                  <span>• Offline Queue</span>
                </div>
              </div>

              {/* Studio Card 2: Laptop Windows Desktop Interface */}
              <div
                onClick={() => setActiveFrontend('laptop')}
                className="bg-[#0d1017] border border-[#212736] hover:border-cyan-500/50 p-5 sm:p-6 rounded-xl transition-all cursor-pointer group shadow-xl relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                        <Laptop className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors">
                        Launch Laptop Desktop IDE
                      </h3>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                      Opens the full-width Windows desktop dashboard: split ConPTY terminals, live active pairing key banner, LAN connection status, dev server preview, and host daemon controls.
                    </p>
                  </div>

                  <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                </div>

                <div className="mt-5 pt-3 border-t border-[#181c26] flex items-center gap-4 text-[11px] text-zinc-400 font-mono">
                  <span>• Split View</span>
                  <span>• Daemon Monitor</span>
                  <span>• Dev Servers</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* FOOTER & ARCHITECTURE GUARANTEES                                          */}
        {/* ========================================================================= */}
        <footer className="pt-8 pb-4 border-t border-[#1a1f2b] text-xs text-zinc-500 flex flex-col md:flex-row items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-3">
            <img src="/icon.jpeg" alt="Logo" className="w-5 h-5 rounded object-cover" />
            <span>Lazy Terminal v1.0.0 (Local-First Companion)</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>100% Local LAN</span>
            <span>•</span>
            <span>Zero Mandatory Cloud</span>
            <span>•</span>
            <span>MIT License</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
