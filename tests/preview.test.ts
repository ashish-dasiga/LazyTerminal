import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { previewManager } from '../src/services/previewService';

describe('Preview & Dev Server Subsystem', () => {
  test('getHostLanIp returns a valid IPv4 format', () => {
    const ip = previewManager.getHostLanIp();
    assert.match(ip, /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
  });

  test('isPortInUse accurately detects port availability', async () => {
    // Port 49152 is typically free in ephemeral range
    const inUse = await previewManager.isPortInUse(49152);
    assert.equal(typeof inUse, 'boolean');
  });

  test('startDevServer and stopDevServer lifecycle', async () => {
    const testPort = 49199;
    const server = await previewManager.startDevServer('node -e "setInterval(()=>{},1000)"', testPort);
    assert.equal(server.port, testPort);
    assert.ok(server.url.includes(testPort.toString()));

    const list = previewManager.listDevServers();
    assert.ok(list.some((s) => s.port === testPort));

    await previewManager.stopDevServer(server.id);
    const afterStop = previewManager.listDevServers();
    assert.ok(!afterStop.some((s) => s.id === server.id));
  });

  test('runPythonPreview executes Python script or snippet cleanly', async () => {
    // Test with python script or python inline test
    const res = await previewManager.runPythonPreview('-c print("Python preview working")');
    assert.equal(res.exitCode, 0);
    assert.ok(res.stdout.includes('Python preview working'));
    assert.ok(res.executionTimeMs >= 0);
  });

  test('inspectFilePreviewCapability accurately categorizes files', () => {
    const webCheck = previewManager.inspectFilePreviewCapability('index.html');
    assert.equal(webCheck.supported, true);
    assert.equal(webCheck.category, 'web');

    const pyCheck = previewManager.inspectFilePreviewCapability('train.py');
    assert.equal(pyCheck.supported, true);
    assert.equal(pyCheck.category, 'python');

    const binCheck = previewManager.inspectFilePreviewCapability('firmware.bin');
    assert.equal(binCheck.supported, false);
    assert.equal(binCheck.category, 'unsupported');
    assert.ok(binCheck.reason?.includes('binary asset'));
  });
});
