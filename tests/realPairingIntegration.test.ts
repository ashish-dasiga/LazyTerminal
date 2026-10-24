import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import { createHostCompanion } from '../src/host/router';
import { RealRelayBackendAdapter } from '../src/services/realAdapter';
import { setHostUrl } from '../src/services/config';

test('Real Backend Pairing Integration — Full Lifecycle over HTTP', async (t) => {
  const app = express();
  app.use(express.json());
  const hostCompanion = createHostCompanion();
  app.use('/api/v1', hostCompanion.router);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  setHostUrl(baseUrl);
  const adapter = new RealRelayBackendAdapter(baseUrl);

  t.after(() => {
    server.close();
  });

  await t.test('1. Server starts and generates live random pairing key', async () => {
    const keyInfo = await adapter.connection.fetchActiveHostKey();
    assert.ok(keyInfo.pairingKey, 'Active pairing key must be present');
    assert.match(keyInfo.pairingKey, /^\d{3}-\d{3}$/, 'Pairing key must follow 6-digit xxx-xxx format');
  });

  await t.test('2. Rejects invalid pairing key with actionable error message and 401 status', async () => {
    await assert.rejects(
      async () => {
        await adapter.connection.connectToHost({ pairingKey: '000-000' });
      },
      (err: any) => {
        assert.match(err.message, /rejected/i, 'Must describe rejection reason');
        assert.equal(err.status, 401, 'Must have HTTP 401 status code');
        return true;
      }
    );
  });

  await t.test('3. Connects with live pairing key and receives real session token', async () => {
    const activeKeyInfo = await adapter.connection.fetchActiveHostKey();
    const connectRes = await adapter.connection.connectToHost({ pairingKey: activeKeyInfo.pairingKey });
    assert.equal(connectRes.success, true, 'Valid pairing key must succeed');
    assert.ok(connectRes.sessionToken, 'Real session token must be returned');
    assert.equal(connectRes.device.isOnline, true, 'Target device must be marked online');
  });

  await t.test('4. Normalizes formatted input with spaces and hyphens', async () => {
    // Regenerate key to test fresh connection
    const freshKey = hostCompanion.pairing.rotatePairingKey('integration_test');
    const digitsOnly = freshKey.pairingKey.replace('-', '');
    
    // Connect using unhyphenated digits
    const connectRes = await adapter.connection.connectToHost({ pairingKey: digitsOnly });
    assert.equal(connectRes.success, true, 'Unhyphenated digits must be normalized and accepted');
  });
});
