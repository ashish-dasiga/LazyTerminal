import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { runDebugManager } from '../src/services/runDebugService';

describe('Run & Debug Subsystem (S4)', () => {
  test('S4: inspectProject correctly inspects current repository package.json scripts', () => {
    const inspection = runDebugManager.inspectProject(process.cwd());
    assert.ok(inspection.projectType.includes('Node.js'));
    assert.ok(inspection.availableTasks.length >= 4);

    const taskIds = inspection.availableTasks.map((t) => t.id);
    assert.ok(taskIds.includes('npm-dev'), 'npm run dev must be discovered');
    assert.ok(taskIds.includes('npm-build'), 'npm run build must be discovered');
    assert.ok(taskIds.includes('npm-lint'), 'npm run lint must be discovered');
  });

  test('S4: inspectProject returns empty tasks for non-existent path', () => {
    const inspection = runDebugManager.inspectProject(path.join(process.cwd(), 'non_existent_folder_xyz'));
    assert.equal(inspection.projectType, 'Path Not Found');
    assert.equal(inspection.availableTasks.length, 0);
  });

  test('S4: startTask launches a safe command, captures output, and detects bound ports', async () => {
    const record = runDebugManager.startTask('test-echo-task', 'node', [
      '-e',
      'console.log("hello from test task listening on localhost:4567")',
    ]);
    assert.equal(record.taskId, 'test-echo-task');
    assert.equal(record.status, 'running');

    await new Promise((r) => setTimeout(r, 600));

    const finalStatus = runDebugManager.getTaskStatus('test-echo-task');
    assert.ok(finalStatus);
    assert.equal(finalStatus.status, 'completed');
    assert.equal(finalStatus.exitCode, 0);
    assert.ok(finalStatus.outputLines.some((l) => l.includes('hello from test task')));
    assert.ok(finalStatus.portsDetected.includes(4567));
  });

  test('S4: startTask records error status and non-zero exit code for failed command', async () => {
    runDebugManager.startTask('test-fail-task', 'node', ['-e', 'console.error("fatal failure"); process.exit(2)']);
    await new Promise((r) => setTimeout(r, 600));

    const failedStatus = runDebugManager.getTaskStatus('test-fail-task');
    assert.ok(failedStatus);
    assert.equal(failedStatus.status, 'error');
    assert.equal(failedStatus.exitCode, 2);
    assert.ok(failedStatus.outputLines.some((l) => l.includes('fatal failure')));
  });

  test('S4: stopTask safely terminates a long-running process', async () => {
    runDebugManager.startTask('test-sleep-task', 'node', ['-e', 'setInterval(() => {}, 1000)']);
    const running = runDebugManager.getTaskStatus('test-sleep-task');
    assert.equal(running?.status, 'running');

    const stopped = runDebugManager.stopTask('test-sleep-task');
    assert.equal(stopped, true);

    const finalStatus = runDebugManager.getTaskStatus('test-sleep-task');
    assert.equal(finalStatus?.status, 'completed');
  });
});
