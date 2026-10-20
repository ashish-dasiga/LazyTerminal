import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createHostCompanion } from './src/host/router';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const distPath = path.join(__dirname, 'dist');
const hostCompanion = createHostCompanion();

app.use(express.json());

// Mount Windows Host Companion API routes
app.use('/api/v1', hostCompanion.router);

// Serve static assets from dist
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    serverStatus: hostCompanion.pairing.getServerStatus(),
  });
});

// SPA fallback: send index.html for all other requests
app.get('*', (req: Request, res: Response) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('Relay Terminal build in progress...');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  const keyInfo = hostCompanion.pairing.getCurrentKeyEnvelope();
  console.log(`Lazy Terminal listening on http://0.0.0.0:${PORT}`);
  console.log(`Active Windows Host Pairing Key: ${keyInfo.pairingKey}`);
});
