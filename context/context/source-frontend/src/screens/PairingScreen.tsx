import React, { useState } from 'react';
import { useRelay } from '../context/RelayContext';
import { 
  Key, 
  ShieldCheck, 
  QrCode, 
  RefreshCw, 
  Copy, 
  Check, 
  Laptop, 
  Lock, 
  Activity, 
  Camera, 
  Loader2 
} from 'lucide-react';

export function PairingScreen() {
  const { device } = useRelay();

  const [copiedKey, setCopiedKey] = useState(false);
  const [pinDigits, setPinDigits] = useState(['7', '8', '4', '2', '9', '1']);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<string | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [revoked, setRevoked] = useState(false);

  const handleCopyFingerprint = () => {
    navigator.clipboard?.writeText(device.ed25519Fingerprint);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleGenerateNewPin = () => {
    const d1 = Math.floor(100 + Math.random() * 900);
    const d2 = Math.floor(100 + Math.random() * 900);
    const newCode = `${d1}${d2}`;
    setPinDigits(newCode.split(''));
  };

  const runLatencyBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkResult(null);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setBenchmarkResult(`WebSocket Round-Trip: 19.4ms · WebRTC DataChannel: 14.8ms · Packet Loss: 0.0%`);
    setIsBenchmarking(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121419] text-zinc-100 font-sans">
      {/* Header */}
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">
            Pairing & Security Hub
          </h2>
        </div>
        <p className="text-xs text-zinc-400">
          Hardware-backed device key authorization and secure tunnel handshake.
        </p>
      </div>

      {/* Paired Host Device Card */}
      <div className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1c1f26] border border-[#2b303b] rounded-md text-zinc-400">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-white">{device.deviceName}</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                  {device.isOnline ? 'Authenticated' : 'Offline'}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                {device.os} · {device.ip}:{device.port}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-zinc-500 font-mono block">Daemon Version</span>
            <span className="text-xs text-zinc-300 font-mono">{device.daemonVersion}</span>
          </div>
        </div>

        {/* Cryptographic Fingerprint */}
        <div className="p-2.5 bg-[#111318] rounded border border-[#252831] space-y-1 font-mono text-xs">
          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Ed25519 Public Key Fingerprint
            </span>
            <button
              onClick={handleCopyFingerprint}
              className="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copiedKey ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="text-zinc-200 text-[11px] break-all select-all">
            {device.ed25519Fingerprint}
          </div>
        </div>
      </div>

      {/* 6-Digit Numeric Pairing Code Card */}
      <div className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-zinc-400" />
            <h3 className="text-xs font-semibold text-white">
              Pair New Device (6-Digit Code)
            </h3>
          </div>
          <button
            onClick={handleGenerateNewPin}
            className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer font-mono"
            title="Generate new pairing token"
          >
            <RefreshCw className="w-3 h-3" /> Regenerate
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          Run <code className="text-zinc-200 font-mono">relay-cli pair</code> on your Windows PC and enter this code:
        </p>

        {/* 6-Digit PIN visual boxes */}
        <div className="flex items-center justify-center gap-2 py-1">
          {pinDigits.map((digit, idx) => (
            <div
              key={idx}
              className="w-9 h-11 bg-[#111318] border border-[#2b303b] rounded-md flex items-center justify-center text-base font-mono font-bold text-white"
            >
              {digit}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => setShowQrScanner(!showQrScanner)}
            className="px-3 py-1.5 bg-[#1c1f26] hover:bg-[#232731] text-zinc-200 border border-[#2b303b] rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-zinc-400" />
            {showQrScanner ? 'Hide QR View' : 'Simulate Camera QR Scan'}
          </button>
        </div>

        {/* QR Scanner */}
        {showQrScanner && (
          <div className="p-4 bg-[#111318] border border-[#252831] rounded-lg text-center space-y-2 animate-in fade-in">
            <div className="w-40 h-40 border border-[#3b404f] rounded-md mx-auto flex items-center justify-center bg-black/40">
              <QrCode className="w-20 h-20 text-zinc-500" />
            </div>
            <div className="text-xs text-zinc-400 font-mono">
              Align terminal QR code within viewfinder
            </div>
          </div>
        )}
      </div>

      {/* Latency & Diagnostics */}
      <div className="p-3.5 bg-[#16181e] border border-[#252831] rounded-lg space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="text-white font-medium flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-zinc-400" /> Connection Diagnostics
          </span>
          <button
            onClick={runLatencyBenchmark}
            disabled={isBenchmarking}
            className="px-2.5 py-1 bg-[#1c1f26] hover:bg-[#232731] text-zinc-200 border border-[#2b303b] rounded text-xs cursor-pointer"
          >
            {isBenchmarking ? (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Pinging...
              </span>
            ) : (
              'Run Benchmark'
            )}
          </button>
        </div>

        {benchmarkResult && (
          <div className="p-2.5 bg-[#111318] border border-[#252831] rounded text-zinc-300 text-xs leading-relaxed font-mono">
            {benchmarkResult}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-[#111318] rounded border border-[#252831]">
            <span className="text-zinc-500 block text-[10px]">Encryption Cipher</span>
            <span className="text-zinc-200">ChaCha20-Poly1305</span>
          </div>
          <div className="p-2 bg-[#111318] rounded border border-[#252831]">
            <span className="text-zinc-500 block text-[10px]">Key Exchange</span>
            <span className="text-zinc-200">X25519 (Ephemeral)</span>
          </div>
        </div>
      </div>

      {/* Revocation Section */}
      <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-lg flex items-center justify-between text-xs">
        <div>
          <div className="font-medium text-rose-200">Revoke Pairing Credentials</div>
          <div className="text-rose-400/80 text-[11px]">
            Disconnects phone key from Windows daemon.
          </div>
        </div>
        <button
          onClick={() => setRevoked(true)}
          disabled={revoked}
          className="px-3 py-1 bg-rose-900/40 hover:bg-rose-900/60 text-rose-200 border border-rose-800/40 rounded-md text-xs font-mono cursor-pointer transition-colors"
        >
          {revoked ? 'Revoked' : 'Revoke Token'}
        </button>
      </div>
    </div>
  );
}
