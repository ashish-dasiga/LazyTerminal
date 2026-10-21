import express from 'express';
import http from 'http';
import 'dotenv/config';
import { createHostCompanion, HostCompanionContext } from './router';
import { HostConfig } from './config';
import { fsRouter } from '../server/fsRoutes';
import { gitRouter } from '../server/gitRoutes';

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

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      serverStatus: companion.pairing.getServerStatus(),
    });
  });

  app.use('/api/v1/fs', fsRouter);
  app.use('/api/v1/git', gitRouter);
  app.use('/api/v1', companion.router);

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
          console.log(` Active 6-Digit Pairing Key: ${keyEnvelope.pairingKey} (TTL: ${keyEnvelope.expiresInSeconds}s)`);
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
