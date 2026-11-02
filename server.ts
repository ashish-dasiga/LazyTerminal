import { startHostCompanionServer } from './src/host/companionServer';

const PORT = Number(process.env.PORT || process.env.LAZY_TERMINAL_HOST_PORT) || 3000;
const BIND = process.env.LAZY_TERMINAL_HOST_BIND || '0.0.0.0';

const runningPromise = startHostCompanionServer({
  hostPort: PORT,
  hostBind: BIND,
});

runningPromise.catch((err) => {
  console.error('Failed to start Lazy Terminal Host Companion:', err);
  process.exit(1);
});

export default runningPromise;
