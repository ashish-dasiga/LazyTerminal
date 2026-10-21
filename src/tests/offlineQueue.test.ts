/**
 * Tests for Offline Queue persistence, sequencing, deduplication,
 * divergence detection, and status transitions via src/services/offlineQueue.ts.
 */

import assert from 'node:assert';
import test from 'node:test';
import {
  enqueueIntent,
  listIntents,
  updateIntentStatus,
  deleteIntent,
  clearAllIntents,
  getPendingIntents,
  getIntentCounts,
  detectDivergedIntents,
  seedOrListIntents,
} from '../services/offlineQueue';

test('Offline Queue: enqueue, sequence numbering, and status transitions', async () => {
  await clearAllIntents();

  const first = await enqueueIntent({
    command: 'git status',
    workingDir: 'C:\\Projects\\test',
    projectName: 'test-project',
    causalDependencyHash: 'sha256:abc1234',
    expectedBaseBranch: 'main',
    expectedHeadCommit: 'commit123',
  });

  assert.strictEqual(first.status, 'queued');
  assert.strictEqual(first.seq, 1);
  assert.ok(first.id.startsWith('intent-'));

  const second = await enqueueIntent({
    command: 'cargo test',
    workingDir: 'C:\\Projects\\test',
    projectName: 'test-project',
    causalDependencyHash: 'sha256:def5678',
    expectedBaseBranch: 'main',
    expectedHeadCommit: 'commit123',
  });

  assert.strictEqual(second.seq, 2);

  // Verify state transitions: queued -> executing -> reconciled
  const exec = await updateIntentStatus(first.id, 'executing');
  assert.strictEqual(exec?.status, 'executing');

  const done = await updateIntentStatus(first.id, 'reconciled', {
    resultOutput: 'On branch main',
    executionDurationMs: 120,
  });
  assert.strictEqual(done?.status, 'reconciled');
  assert.strictEqual(done?.resultOutput, 'On branch main');

  // Verify skip transition on second intent
  const skipped = await updateIntentStatus(second.id, 'skipped');
  assert.strictEqual(skipped?.status, 'skipped');

  const counts = await getIntentCounts();
  assert.strictEqual(counts.reconciled, 1);
  assert.strictEqual(counts.skipped, 1);
  assert.strictEqual(counts.queued, 0);
});

test('Offline Queue Invariant: Queued intents are never auto-executed on reconnect', async () => {
  await clearAllIntents();

  await enqueueIntent({
    command: 'npm test',
    workingDir: 'C:\\Projects\\app',
    projectName: 'app',
    causalDependencyHash: 'sha256:1111',
    expectedBaseBranch: 'main',
    expectedHeadCommit: 'a1b2c3d',
  });
  await enqueueIntent({
    command: 'git push',
    workingDir: 'C:\\Projects\\app',
    projectName: 'app',
    causalDependencyHash: 'sha256:2222',
    expectedBaseBranch: 'main',
    expectedHeadCommit: 'a1b2c3d',
  });

  // Simulated reconnect check: detectDivergedIntents against unchanged branch/commit
  const afterReconnect = await detectDivergedIntents('main', 'a1b2c3d', 'app');
  assert.strictEqual(afterReconnect.length, 2);
  for (const item of afterReconnect) {
    assert.strictEqual(item.status, 'queued', 'Intent must not auto-execute on reconnect');
  }
});

test('Offline Queue Deduplication: Identifies rapid duplicate submissions and preserves caller ID', async () => {
  await clearAllIntents();

  const now = 1_700_000_000_000;
  const first = await enqueueIntent({
    id: 'intent-custom-1',
    seq: 1,
    timestamp: now,
    command: 'cargo build',
    workingDir: 'C:\\Projects\\hyper-relay',
    projectName: 'hyper-relay',
    causalDependencyHash: 'sha256:aaaa',
    expectedBaseBranch: 'main',
    expectedHeadCommit: 'c1',
  });
  assert.strictEqual(first.id, 'intent-custom-1');

  // Rapid duplicate (1 second later) returns existing intent instead of creating duplicate
  const dup = await enqueueIntent({
    id: 'intent-custom-2',
    seq: 2,
    timestamp: now + 1000,
    command: 'cargo build',
    workingDir: 'C:\\Projects\\hyper-relay',
    projectName: 'hyper-relay',
    causalDependencyHash: 'sha256:bbbb',
    expectedBaseBranch: 'main',
    expectedHeadCommit: 'c1',
  });
  assert.strictEqual(dup.id, 'intent-custom-1');
  assert.strictEqual((await listIntents()).length, 1);

  // Legitimate subsequent submission (6 seconds later)
  const later = await enqueueIntent({
    id: 'intent-custom-3',
    seq: 2,
    timestamp: now + 6000,
    command: 'cargo build',
    workingDir: 'C:\\Projects\\hyper-relay',
    projectName: 'hyper-relay',
    causalDependencyHash: 'sha256:cccc',
    expectedBaseBranch: 'main',
    expectedHeadCommit: 'c1',
  });
  assert.strictEqual(later.id, 'intent-custom-3');
  assert.strictEqual((await listIntents()).length, 2);
});

test('Offline Queue Divergence Detection: Flags branch or commit mismatch on reconnect', async () => {
  await clearAllIntents();

  await enqueueIntent({
    id: 'intent-div-1',
    command: 'git commit -m "offline fix"',
    workingDir: 'C:\\Projects\\hyper-relay',
    projectName: 'hyper-relay',
    causalDependencyHash: 'sha256:9999',
    expectedBaseBranch: 'main',
    expectedHeadCommit: 'old-commit-111',
  });

  // PC moved to a new branch/commit while mobile was offline
  const updated = await detectDivergedIntents('feat/new-branch', 'new-commit-222', 'hyper-relay', 2);
  assert.strictEqual(updated.length, 1);
  assert.strictEqual(updated[0].status, 'diverged');
  assert.strictEqual(updated[0].divergenceDetails?.pcCurrentBranch, 'feat/new-branch');
  assert.strictEqual(updated[0].divergenceDetails?.pcDirtyFiles, 2);
  assert.strictEqual(updated[0].divergenceDetails?.suggestedResolution, 'skip');

  const pending = await getPendingIntents();
  assert.strictEqual(pending.length, 1);

  await deleteIntent('intent-div-1');
  assert.strictEqual((await listIntents()).length, 0);

  // Seed defaults when empty
  const seeded = await seedOrListIntents([
    {
      id: 'seed-1',
      seq: 1,
      command: 'dir',
      workingDir: 'C:\\Projects',
      projectName: 'demo',
      timestamp: Date.now(),
      status: 'queued',
      causalDependencyHash: 'sha256:0000',
      expectedBaseBranch: 'main',
      expectedHeadCommit: 'abc',
    },
  ]);
  assert.strictEqual(seeded.length, 1);
  assert.strictEqual(seeded[0].id, 'seed-1');
});
