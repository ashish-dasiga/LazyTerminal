import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { previewManager } from '../src/services/previewService';

describe('Preview & Dev Server Subsystem (S5)', () => {
  test('S5: getHostLanIp returns a valid IPv4 format', () => {
    const ip = previewManager.getHostLanIp();
    assert.match(ip, /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
  });

  test('S5: isPortInUse accurately detects port availability', async () => {
    const inUse = await previewManager.isPortInUse(49152);
    assert.equal(typeof inUse, 'boolean');
  });

  test('S5: startDevServer and stopDevServer lifecycle without shell deprecation warnings', async () => {
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

  test('S5: runPythonPreview executes Python script or snippet cleanly', async () => {
    const res = await previewManager.runPythonPreview('-c print("Python preview working")');
    assert.equal(res.exitCode, 0);
    assert.ok(res.stdout.includes('Python preview working'));
    assert.ok(res.executionTimeMs >= 0);
  });

  test('S5: inspectFilePreviewCapability and getDesktopAppStream honestly report unsupported native/binary types', () => {
    const webCheck = previewManager.inspectFilePreviewCapability('index.html');
    assert.equal(webCheck.supported, true);
    assert.equal(webCheck.category, 'web');

    const pyCheck = previewManager.inspectFilePreviewCapability('train.py');
    assert.equal(pyCheck.supported, true);
    assert.equal(pyCheck.category, 'python');

    const exeCheck = previewManager.inspectFilePreviewCapability('HyperRelayHost.exe');
    assert.equal(exeCheck.supported, false);
    assert.equal(exeCheck.category, 'desktop');
    assert.ok(exeCheck.reason?.includes('unsupported in the local-first MVP'));

    const binCheck = previewManager.inspectFilePreviewCapability('firmware.bin');
    assert.equal(binCheck.supported, false);
    assert.equal(binCheck.category, 'unsupported');
    assert.ok(binCheck.reason?.includes('binary asset'));

    const desktopStream = previewManager.getDesktopAppStream('win-calculator');
    assert.equal(desktopStream.isStreamActive, false);
    assert.ok(desktopStream.resolution.includes('Unsupported in MVP'));
  });
});
