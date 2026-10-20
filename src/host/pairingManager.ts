import crypto from 'crypto';
import os from 'os';
import {
  ConnectHostRequest,
  ConnectHostResponse,
  GenerateKeyResponse,
  HostServerStatusResponse,
  ValidateKeyRequest,
  ValidateKeyResponse,
} from '../services/contracts';
import { DeviceInfo } from '../types/relay';
import { HostConfig } from './config';
import { HostLogger } from './logger';

export interface ActiveSessionRecord {
  sessionToken: string;
  mobileDeviceId: string;
  clientPublicKey?: string;
  createdAt: number;
  lastSeenAt: number;
}

function getLocalLanIp(fallbackBind: string): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return fallbackBind === '0.0.0.0' ? '127.0.0.1' : fallbackBind;
}

function generateEd25519Fingerprint(): string {
  const { publicKey } = crypto.generateKeyPairSync('ed25519');
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const hash = crypto.createHash('sha256').update(der).digest('hex');
  return `SHA256:${hash.slice(0, 12)}...${hash.slice(-4)}`;
}

export class PairingManager {
  private readonly config: HostConfig;
  private readonly logger: HostLogger;
  private readonly nowFn: () => number;

  private activePairingKey: string = '';
  private keyCreatedAt: number = 0;
  private keyExpiresAt: number = 0;

  private failedAttemptTimestamps: number[] = [];
  private lockedUntil: number = 0;

  private activeSessions = new Map<string, ActiveSessionRecord>();
  private serverStatus: 'running' | 'stopped' | 'starting' = 'running';
  private pairedAtDisplay: string = 'Unpaired';
  private totalIntentsProcessed: number = 0;
  private readonly ed25519Fingerprint: string;

  constructor(
    config: HostConfig,
    logger: HostLogger,
    options?: { nowFn?: () => number }
  ) {
    this.config = config;
    this.logger = logger;
    this.nowFn = options?.nowFn || (() => Date.now());
    this.ed25519Fingerprint = generateEd25519Fingerprint();

    // Generate a fresh cryptographically secure secret on service startup
    this.rotatePairingKey('service_startup');
  }

  private createRandomSixDigitKey(): string {
    const part1 = crypto.randomInt(100, 1000);
    const part2 = crypto.randomInt(100, 1000);
    return `${part1}-${part2}`;
  }

  public rotatePairingKey(reason: string = 'manual_regenerate'): GenerateKeyResponse {
    let nextKey = this.createRandomSixDigitKey();
    // Ensure rotation always changes the secret even on astronomical collision
    while (nextKey === this.activePairingKey) {
      nextKey = this.createRandomSixDigitKey();
    }

    const now = this.nowFn();
    this.activePairingKey = nextKey;
    this.keyCreatedAt = now;
    this.keyExpiresAt = now + this.config.pairingTtlSeconds * 1000;
    this.failedAttemptTimestamps = [];
    this.lockedUntil = 0;

    this.logger.info('Generated fresh host pairing secret', {
      reason,
      expiresInSeconds: this.config.pairingTtlSeconds,
    });

    return this.getCurrentKeyEnvelope();
  }

  public getCurrentKeyEnvelope(): GenerateKeyResponse {
    const now = this.nowFn();
    const remainingSeconds = Math.max(0, Math.ceil((this.keyExpiresAt - now) / 1000));
    const ip = getLocalLanIp(this.config.hostBind);
    return {
      pairingKey: this.activePairingKey,
      expiresInSeconds: remainingSeconds,
      qrPayload: `relay://pair?host=${ip}&port=${this.config.hostPort}&key=${this.activePairingKey}`,
    };
  }

  private normalizeDigits(key: string): string {
    return (key || '').replace(/[\s-]/g, '').trim();
  }

  private isKeyMatchConstantTime(candidateRaw: string): boolean {
    const candidate = this.normalizeDigits(candidateRaw);
    const target = this.normalizeDigits(this.activePairingKey);

    if (!/^\d{6}$/.test(candidate) || !/^\d{6}$/.test(target)) {
      return false;
    }

    const bufA = Buffer.from(candidate, 'utf8');
    const bufB = Buffer.from(target, 'utf8');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }

  private pruneFailedAttempts(now: number): void {
    const windowStart = now - this.config.pairingLockoutMs;
    this.failedAttemptTimestamps = this.failedAttemptTimestamps.filter(
      (ts) => ts > windowStart
    );
  }

  public validatePairingKey(req: ValidateKeyRequest): ValidateKeyResponse {
    const now = this.nowFn();

    if (this.serverStatus !== 'running') {
      return {
        isValid: false,
        errorMessage: 'Windows host communication service is currently stopped.',
      };
    }

    if (this.lockedUntil > now) {
      const waitSec = Math.ceil((this.lockedUntil - now) / 1000);
      this.logger.warn('Rejected pairing attempt during rate-limit lockout', {
        waitSeconds: waitSec,
      });
      return {
        isValid: false,
        errorMessage: `Too many failed pairing attempts. Please wait ${waitSec}s or regenerate the key on your Windows PC.`,
      };
    }

    if (!this.activePairingKey || now > this.keyExpiresAt) {
      this.logger.warn('Rejected expired pairing secret');
      return {
        isValid: false,
        errorMessage: 'Pairing key has expired on the Windows host. Please generate a new key on your PC.',
      };
    }

    const matched = this.isKeyMatchConstantTime(req.pairingKey || '');
    if (!matched) {
      this.pruneFailedAttempts(now);
      this.failedAttemptTimestamps.push(now);

      if (this.failedAttemptTimestamps.length >= this.config.pairingMaxAttempts) {
        this.lockedUntil = now + this.config.pairingLockoutMs;
        this.logger.warn('Pairing rate-limit threshold exceeded; locking pairing attempts', {
          attempts: this.failedAttemptTimestamps.length,
        });
        return {
          isValid: false,
          errorMessage: `Too many failed pairing attempts (${this.config.pairingMaxAttempts}). Pairing locked for ${Math.ceil(this.config.pairingLockoutMs / 1000)}s.`,
        };
      }

      this.logger.warn('Rejected invalid pairing key attempt', {
        failedAttemptsInWindow: this.failedAttemptTimestamps.length,
      });
      return {
        isValid: false,
        errorMessage: 'Pairing key rejected by Windows host. Please check the 6-digit key displayed on your PC.',
      };
    }

    // Valid match: clear failed attempts
    this.failedAttemptTimestamps = [];
    return {
      isValid: true,
      targetDeviceName: os.hostname(),
    };
  }

  public connectToHost(req: ConnectHostRequest): ConnectHostResponse {
    const validation = this.validatePairingKey({
      pairingKey: req.pairingKey,
    });

    if (!validation.isValid) {
      return {
        success: false,
        device: {
          ...this.getHostDeviceInfo({ includePairingToken: false }),
          isOnline: this.serverStatus === 'running',
        },
        sessionToken: '',
        errorMessage: validation.errorMessage,
      };
    }

    const now = this.nowFn();
    const sessionToken = `lt_sess_${crypto.randomBytes(32).toString('hex')}`;
    const record: ActiveSessionRecord = {
      sessionToken,
      mobileDeviceId: 'android-client',
      clientPublicKey: req.ed25519ClientPublicKey,
      createdAt: now,
      lastSeenAt: now,
    };

    this.activeSessions.set(sessionToken, record);
    this.pairedAtDisplay = new Date(now).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    this.logger.info('Authenticated mobile client session established', {
      activeSessionsCount: this.activeSessions.size,
    });

    return {
      success: true,
      device: this.getHostDeviceInfo({ includePairingToken: false }),
      sessionToken,
    };
  }

  public validateSessionToken(token: string | undefined): boolean {
    if (this.serverStatus !== 'running') {
      return false;
    }
    if (!token || typeof token !== 'string') {
      return false;
    }
    const clean = token.replace(/^Bearer\s+/i, '').trim();
    const session = this.activeSessions.get(clean);
    if (!session) {
      return false;
    }
    session.lastSeenAt = this.nowFn();
    return true;
  }

  public disconnectSession(token?: string): void {
    if (token) {
      const clean = token.replace(/^Bearer\s+/i, '').trim();
      this.activeSessions.delete(clean);
    } else {
      this.activeSessions.clear();
    }
    this.logger.info('Disconnected mobile session', {
      remainingSessions: this.activeSessions.size,
    });
  }

  public setHostServerStatus(action: 'start' | 'stop' | 'restart'): HostServerStatusResponse {
    if (action === 'stop') {
      this.serverStatus = 'stopped';
      this.activeSessions.clear();
      this.activePairingKey = '';
      this.keyExpiresAt = 0;
      this.logger.info('Windows host communication service stopped; invalidated active secrets and sessions');
    } else {
      this.serverStatus = 'running';
      this.activeSessions.clear();
      // Requirement FR-02: Every time the PC communication service starts, generate a fresh random secret
      this.rotatePairingKey(action === 'restart' ? 'service_restart' : 'service_start');
    }

    const memMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
    return {
      status: this.serverStatus,
      activePortBindings: this.serverStatus === 'running' ? [this.config.hostPort, 3000] : [],
      cpuUsagePercent: this.serverStatus === 'running' ? 2.4 : 0.1,
      memoryUsageMb: memMb,
    };
  }

  public incrementProcessedCount(): void {
    this.totalIntentsProcessed += 1;
  }

  public getServerStatus(): 'running' | 'stopped' | 'starting' {
    return this.serverStatus;
  }

  public getHostDeviceInfo(options: { includePairingToken?: boolean } = {}): DeviceInfo {
    const isRunning = this.serverStatus === 'running';
    const memMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
    const ip = getLocalLanIp(this.config.hostBind);

    return {
      isOnline: isRunning,
      deviceName: os.hostname() || 'WINDOWS-PC-HOST',
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      ip,
      port: this.config.hostPort,
      daemonVersion: 'v1.4.0 (Windows Host Companion)',
      pingMs: isRunning ? 4 : 0,
      pairedAt: this.pairedAtDisplay,
      ed25519Fingerprint: this.ed25519Fingerprint,
      pairingToken: options.includePairingToken ? this.activePairingKey : 'REDACTED',
      sqliteDbSizeKb: 142,
      backendServerStatus: this.serverStatus,
      tunnelStatus: isRunning && this.activeSessions.size > 0 ? 'active' : 'idle',
      totalIntentsProcessed: this.totalIntentsProcessed,
      cpuUsagePercent: isRunning ? 2.4 : 0.1,
      memoryUsageMb: memMb,
      activePortBindings: isRunning ? [this.config.hostPort, 3000] : [],
    };
  }
}
