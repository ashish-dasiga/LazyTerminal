import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { fsRouter } from './src/server/fsRoutes';
import { gitRouter } from './src/server/gitRoutes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const distPath = path.join(__dirname, 'dist');

// Middleware: JSON parsing
app.use(express.json({ limit: '10mb' }));

// Middleware: Permissive local CORS for development companion connection
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'lazy-terminal-host', version: '1.0.0' });
});

// Mount Subsystem 4 (Filesystem) and Subsystem 5 (Git) APIs
app.use('/api/v1/fs', fsRouter);
app.use('/api/v1/git', gitRouter);

// Serve static assets from dist when built
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// SPA fallback: send index.html for all other non-API routes
app.get('*', (req: Request, res: Response) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('Lazy Terminal host is running. Start the Vite dev server for client UI.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lazy Terminal Host Companion listening on http://0.0.0.0:${PORT}`);
});

export default app;
