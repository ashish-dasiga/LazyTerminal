import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { createHostCompanion, HostCompanionContext } from './router';
import { HostConfig } from './config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RunningHostServer {
  app: express.Express;
  server: http.Server;
  companion: HostCompanionContext;
  port: number;
  close: () => Promise<void>;
}

export async function startHostCompanionServer(
  customConfig?: Partial<HostConfig>,
  options?: { silentLogger?: boolean }
): Promise<RunningHostServer> {
  const companion = createHostCompanion(customConfig, options);
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Permissive CORS for local/LAN/emulator clients; protected routes still require session auth
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Session-Token'
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'lazy-terminal-host-companion',
      version: '1.0.0',
      hostName: os.hostname(),
      serverStatus: companion.pairing.getServerStatus(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/v1', companion.router);

  // Explicit JSON 404 for unknown /api/* routes so SPA fallback never returns HTML to API callers
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      error: {
        code: 'ENDPOINT_NOT_FOUND',
        message: `Endpoint ${req.path} not found on Windows host companion.`,
        retryable: false,
      },
    });
  });

  const distPath = path.resolve(__dirname, '../../dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Frontend build not found.');
      }
    });
  }

  return new Promise<RunningHostServer>((resolve, reject) => {
    const server = app.listen(
      companion.config.hostPort,
      companion.config.hostBind,
      () => {
        const addr = server.address();
        const boundPort =
          typeof addr === 'object' && addr ? addr.port : companion.config.hostPort;

        if (!options?.silentLogger) {
          const keyEnvelope = companion.pairing.getCurrentKeyEnvelope();
          console.log('============================================================');
          console.log(' Lazy Terminal — Windows PC Companion Started');
          console.log(` Listening on: http://${companion.config.hostBind}:${boundPort}`);
          console.log(` Workspace Root: ${companion.config.defaultWorkspaceRoot}`);
          console.log(
            ` Active 6-Digit Pairing Key: ${keyEnvelope.pairingKey} (TTL: ${keyEnvelope.expiresInSeconds}s)`
          );
          console.log('============================================================');
        }

        resolve({
          app,
          server,
          companion,
          port: boundPort,
          close: () =>
            new Promise<void>((resClose) => {
              companion.shutdown();
              server.close(() => resClose());
            }),
        });
      }
    );

    server.on('error', (err) => {
      companion.shutdown();
      reject(err);
    });
  });
}

// Run standalone when executed directly via `tsx src/host/companionServer.ts` or `npm run host`
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('companionServer.ts') ||
    process.argv[1].endsWith('companionServer.js'));

if (isDirectRun) {
  startHostCompanionServer().catch((err) => {
    console.error('Failed to start Windows PC Companion:', err);
    process.exit(1);
  });
}
