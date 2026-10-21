import express, { Request, Response, NextFunction, Router } from 'express';
import { HostConfig, loadHostConfig } from './config';
import { createHostLogger, HostLogger } from './logger';
import { PairingManager } from './pairingManager';
import { TerminalSessionManager } from './terminalManager';

export interface HostCompanionContext {
  config: HostConfig;
  logger: HostLogger;
  pairing: PairingManager;
  terminal: TerminalSessionManager;
  router: Router;
  shutdown: () => void;
}

function isLoopbackAddress(ip: string | undefined): boolean {
  if (!ip) return false;
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('127.')
  );
}

function extractSessionToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.trim().length > 0) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }
  const headerToken = req.headers['x-session-token'];
  if (typeof headerToken === 'string' && headerToken.trim().length > 0) {
    return headerToken.trim();
  }
  if (typeof req.query.sessionToken === 'string' && req.query.sessionToken.trim()) {
    return req.query.sessionToken.trim();
  }
  return undefined;
}

export function createHostCompanion(
  customConfig?: Partial<HostConfig>,
  options?: { silentLogger?: boolean; nowFn?: () => number }
): HostCompanionContext {
  const baseConfig = loadHostConfig();
  const config: HostConfig = { ...baseConfig, ...customConfig };
  const logger = createHostLogger({ silent: options?.silentLogger });
  const pairing = new PairingManager(config, logger, { nowFn: options?.nowFn });
  const terminal = new TerminalSessionManager(config, logger);

  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));

  // Local CORS support for frontend dev server
  router.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Session-Token'
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, DELETE, OPTIONS'
    );
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  const requireSessionAuth = (req: Request, res: Response, next: NextFunction) => {
    if (pairing.getServerStatus() !== 'running') {
      res.status(503).json({
        error: {
          code: 'PC_UNREACHABLE',
          message: 'Windows host communication service is currently stopped.',
          retryable: true,
        },
      });
      return;
    }

    const token = extractSessionToken(req);
    if (!pairing.validateSessionToken(token)) {
      logger.warn('Rejected unauthenticated request to protected endpoint', {
        method: req.method,
        path: req.path,
      });
      res.status(401).json({
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Unauthorized: A valid paired session token is required.',
          retryable: false,
        },
      });
      return;
    }

    next();
  };

  const requireLoopbackOrSessionAuth = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const token = extractSessionToken(req);
    if (pairing.validateSessionToken(token) || isLoopbackAddress(req.ip || req.socket?.remoteAddress)) {
      next();
      return;
    }

    logger.warn('Rejected non-loopback unauthenticated host control request', {
      method: req.method,
      path: req.path,
      remoteIp: req.ip,
    });
    res.status(401).json({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Host control endpoints require local loopback access or an authenticated session.',
        retryable: false,
      },
    });
  };

  // 1. Health & Diagnostics
  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      protocolVersion: '1.0',
      serverStatus: pairing.getServerStatus(),
    });
  });

  // 2. Host-Local Pairing Key & Daemon Lifecycle (Laptop App UI)
  router.get(
    '/pairing/key',
    requireLoopbackOrSessionAuth,
    (_req: Request, res: Response) => {
      if (pairing.getServerStatus() !== 'running') {
        res.status(503).json({
          error: {
            code: 'PC_UNREACHABLE',
            message: 'Windows host communication service is stopped.',
            retryable: true,
          },
        });
        return;
      }
      res.status(200).json(pairing.getCurrentKeyEnvelope());
    }
  );

  router.post(
    '/pairing/generate',
    requireLoopbackOrSessionAuth,
    (_req: Request, res: Response) => {
      if (pairing.getServerStatus() !== 'running') {
        res.status(503).json({
          error: {
            code: 'PC_UNREACHABLE',
            message: 'Cannot generate pairing key while host service is stopped.',
            retryable: true,
          },
        });
        return;
      }
      const generated = pairing.rotatePairingKey('host_ui_regenerate');
      res.status(200).json(generated);
    }
  );

  router.post(
    '/host/daemon/control',
    requireLoopbackOrSessionAuth,
    (req: Request, res: Response) => {
      const action = req.body?.status as 'start' | 'stop' | 'restart' | undefined;
      if (action !== 'start' && action !== 'stop' && action !== 'restart') {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'status must be "start", "stop", or "restart".',
            retryable: false,
          },
        });
        return;
      }

      if (action === 'stop' || action === 'restart') {
        terminal.shutdownAll();
      }
      const statusRes = pairing.setHostServerStatus(action);
      res.status(200).json({
        ...statusRes,
        ...(action !== 'stop' ? { pairingKey: pairing.getCurrentKeyEnvelope().pairingKey } : {}),
      });
    }
  );

  // 3. Mobile Pairing & Session Handshake
  router.post('/pairing/validate', (req: Request, res: Response) => {
    const pairingKey = String(req.body?.pairingKey || '');
    const result = pairing.validatePairingKey({
      pairingKey,
      mobileDeviceId: req.body?.mobileDeviceId,
    });

    if (!result.isValid) {
      const isLocked = result.errorMessage?.includes('Too many failed');
      res.status(isLocked ? 429 : 401).json(result);
      return;
    }

    res.status(200).json(result);
  });

  router.post('/tunnel/connect', (req: Request, res: Response) => {
    const pairingKey = String(req.body?.pairingKey || '');
    const result = pairing.connectToHost({
      pairingKey,
      ed25519ClientPublicKey: req.body?.ed25519ClientPublicKey,
    });

    if (!result.success) {
      const isLocked = result.errorMessage?.includes('Too many failed');
      res.status(isLocked ? 429 : 401).json(result);
      return;
    }

    res.status(200).json(result);
  });

  router.post(
    '/tunnel/disconnect',
    requireSessionAuth,
    (req: Request, res: Response) => {
      const token = extractSessionToken(req);
      pairing.disconnectSession(token);
      res.status(200).json({ disconnected: true });
    }
  );

  router.get(
    '/host/status',
    requireSessionAuth,
    (req: Request, res: Response) => {
      const isLocal = isLoopbackAddress(req.ip || req.socket?.remoteAddress);
      res.status(200).json(
        pairing.getHostDeviceInfo({ includePairingToken: isLocal })
      );
    }
  );

  // 4. Authenticated Terminal & PTY Session Endpoints
  router.get(
    '/pty/sessions',
    requireSessionAuth,
    (_req: Request, res: Response) => {
      res.status(200).json(terminal.listSessions());
    }
  );

  router.post(
    '/pty/sessions',
    requireSessionAuth,
    (req: Request, res: Response) => {
      try {
        const session = terminal.createSession({
          title: String(req.body?.title || 'PowerShell'),
          type: req.body?.type || 'powershell',
          workingDir: req.body?.workingDir,
        });
        res.status(201).json(session);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(403).json({
          error: {
            code: 'PATH_NOT_ALLOWED',
            message,
            retryable: false,
          },
        });
      }
    }
  );

  router.delete(
    '/pty/sessions/:id',
    requireSessionAuth,
    (req: Request, res: Response) => {
      terminal.closeSession(String(req.params.id));
      res.status(200).json({ closed: true, sessionId: req.params.id });
    }
  );

  const handleExecuteCommand = async (req: Request, res: Response) => {
    const sessionId = String(req.params.id || req.body?.sessionId || 'sess-pwsh');
    const command = String(req.body?.command || '');
    const workingDir = String(req.body?.workingDir || '');
    const envOverrides = req.body?.envOverrides;

    const execRes = await terminal.executeCommand({
      sessionId,
      command,
      workingDir,
      envOverrides,
    });

    pairing.incrementProcessedCount();
    res.status(200).json(execRes);
  };

  router.post(
    '/pty/sessions/:id/input',
    requireSessionAuth,
    handleExecuteCommand
  );
  router.post('/pty/execute', requireSessionAuth, handleExecuteCommand);

  router.post(
    '/pty/sessions/:id/signal',
    requireSessionAuth,
    (req: Request, res: Response) => {
      const sessionId = String(req.params.id || req.body?.sessionId || 'sess-pwsh');
      const signal = req.body?.signal as 'SIGINT' | 'SIGTERM' | 'CLEAR' | undefined;
      if (signal !== 'SIGINT' && signal !== 'SIGTERM' && signal !== 'CLEAR') {
        res.status(400).json({
          error: {
            code: 'INVALID_SIGNAL',
            message: 'signal must be SIGINT, SIGTERM, or CLEAR.',
            retryable: false,
          },
        });
        return;
      }

      terminal.sendSignal({ sessionId, signal });
      res.status(200).json({ ok: true, sessionId, signal });
    }
  );

  // SSE Streaming endpoint for real-time terminal output
  router.get(
    '/pty/sessions/:id/stream',
    requireSessionAuth,
    (req: Request, res: Response) => {
      const sessionId = String(req.params.id);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const unsubscribe = terminal.subscribeSession(sessionId, (line) => {
        res.write(`data: ${JSON.stringify(line)}\n\n`);
      });

      req.on('close', () => {
        unsubscribe();
      });
    }
  );

  return {
    config,
    logger,
    pairing,
    terminal,
    router,
    shutdown: () => {
      terminal.shutdownAll();
    },
  };
}
