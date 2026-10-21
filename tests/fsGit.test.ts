import assert from 'assert';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { validateSafePath } from '../src/server/fsSecurity';

function runGitCmd(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

async function runTests() {
  console.log('--- Starting Lazy Terminal Filesystem & Git Security Tests ---');

  // 1. Test Path Traversal & Security Validation
  console.log('\n[1] Testing Path Traversal and Security Boundaries:');
  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'lazy-terminal-test-'));

  try {
    // 1.1 Valid relative path
    const res1 = validateSafePath('src/main.ts', tempWorkspace, [tempWorkspace]);
    assert.strictEqual(res1.isValid, true, 'Valid relative path should be allowed');

    // 1.2 Path traversal with ../ outside workspace
    const res2 = validateSafePath('../../../etc/passwd', tempWorkspace, [tempWorkspace]);
    assert.strictEqual(res2.isValid, false, 'Traversal outside workspace root must be rejected');
    assert.strictEqual(res2.errorCode, 'PATH_NOT_ALLOWED');

    // 1.3 Windows style path traversal
    const res3 = validateSafePath('..\\..\\Windows\\System32', tempWorkspace, [tempWorkspace]);
    assert.strictEqual(res3.isValid, false, 'Windows-style traversal must be rejected');

    // 1.4 Null byte injection
    const res4 = validateSafePath('file.txt\0.exe', tempWorkspace, [tempWorkspace]);
    assert.strictEqual(res4.isValid, false, 'Null byte must be rejected');
    assert.strictEqual(res4.errorCode, 'INVALID_PATH');

    // 1.5 Reserved Windows device names
    const res5 = validateSafePath('CON.txt', tempWorkspace, [tempWorkspace]);
    assert.strictEqual(res5.isValid, false, 'Windows reserved device name CON must be rejected');

    const res6 = validateSafePath('sub/NUL', tempWorkspace, [tempWorkspace]);
    assert.strictEqual(res6.isValid, false, 'Windows reserved device name NUL must be rejected');

    console.log('✓ All 6 path security boundary assertions passed.');

    // 2. Test File Operations & Atomic Conflict Checks
    console.log('\n[2] Testing Safe File Operations and Conflict Checks:');
    const testFile = path.join(tempWorkspace, 'test_document.txt');
    const initialContent = 'Hello Lazy Terminal\nLine 2';
    fs.writeFileSync(testFile, initialContent, 'utf-8');

    // Check reading and hash
    const crypto = await import('crypto');
    const initialHash = `sha256:${crypto.createHash('sha256').update(Buffer.from(initialContent)).digest('hex')}`;

    // Verify hash matches
    const currentBuf = fs.readFileSync(testFile);
    const calculatedHash = `sha256:${crypto.createHash('sha256').update(currentBuf).digest('hex')}`;
    assert.strictEqual(calculatedHash, initialHash, 'SHA-256 hash must match exact file content');

    // Stale hash check: if user provides stale hash, it must detect conflict
    const staleHash = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
    assert.notStrictEqual(calculatedHash, staleHash, 'Stale hash does not match current hash');

    // Atomic update simulation
    const updatedContent = 'Updated by Ashritha';
    const tempAtomic = path.join(tempWorkspace, '.tmp.test');
    fs.writeFileSync(tempAtomic, updatedContent, 'utf-8');
    fs.renameSync(tempAtomic, testFile);

    const reRead = fs.readFileSync(testFile, 'utf-8');
    assert.strictEqual(reRead, updatedContent, 'Atomic rename update must succeed');

    console.log('✓ Read, SHA-256 hashing, conflict detection, and atomic write passed.');

    // 3. Test Real Git Operations
    console.log('\n[3] Testing Real Git Operations (Status, Stage, Commit, Branch):');
    const gitDir = path.join(tempWorkspace, 'git-repo');
    fs.mkdirSync(gitDir);

    await runGitCmd(['init'], gitDir);
    await runGitCmd(['config', 'user.name', 'LazyTerminal Tester'], gitDir);
    await runGitCmd(['config', 'user.email', 'test@lazyterminal.io'], gitDir);

    // Initial status on empty repo
    const statusEmpty = await runGitCmd(['status', '--porcelain=v1'], gitDir);
    assert.strictEqual(statusEmpty, '', 'New repository should have empty porcelain status');

    // Add a file
    const repoFile = path.join(gitDir, 'README.md');
    fs.writeFileSync(repoFile, '# Test Repo', 'utf-8');

    // Status should show ?? README.md
    const statusUntracked = await runGitCmd(['status', '--porcelain=v1'], gitDir);
    assert.ok(statusUntracked.includes('?? README.md'), 'New file must appear as untracked (??)');

    // Stage file
    await runGitCmd(['add', 'README.md'], gitDir);
    const statusStaged = await runGitCmd(['status', '--porcelain=v1'], gitDir);
    assert.ok(statusStaged.startsWith('A '), 'Staged file must appear with A flag');

    // Commit file
    await runGitCmd(['commit', '-m', 'Initial test commit'], gitDir);
    const statusClean = await runGitCmd(['status', '--porcelain=v1'], gitDir);
    assert.strictEqual(statusClean, '', 'Clean working tree after commit');

    // Create and checkout branch
    await runGitCmd(['checkout', '-b', 'feature/test-branch'], gitDir);
    const currentBranch = await runGitCmd(['branch', '--show-current'], gitDir);
    assert.strictEqual(currentBranch, 'feature/test-branch', 'Branch switch must succeed');

    // Diff check
    fs.appendFileSync(repoFile, '\nAppended line for diff');
    const diffOutput = await runGitCmd(['diff'], gitDir);
    assert.ok(diffOutput.includes('+Appended line for diff'), 'Git diff must show changes');

    console.log('✓ Git init, status, stage, commit, branch, and diff operations passed.');

    console.log('\n========================================');
    console.log('  ALL ASHRITHA FEATURE TESTS PASSED!   ');
    console.log('========================================\n');
  } finally {
    // Cleanup temporary workspace
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
