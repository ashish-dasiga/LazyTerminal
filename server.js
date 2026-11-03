import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Delegate `npm start` (`node server.js`) to the unified TypeScript Windows Host Companion (`server.ts`)
// so static assets AND all authenticated `/api/v1/*` endpoints run together.
const child = spawn(
  process.execPath,
  ['--import', 'tsx', path.join(__dirname, 'server.ts')],
  {
    cwd: __dirname,
    env: process.env,
    stdio: 'inherit',
  }
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
