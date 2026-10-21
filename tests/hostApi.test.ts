import assert from 'assert';
import http from 'http';
import express from 'express';
import { fsRouter } from '../src/server/fsRoutes';
import { gitRouter } from '../src/server/gitRoutes';

async function testApi() {
  console.log('--- Testing Host Companion Filesystem and Git REST Endpoints ---');

  const app = express();
  app.use(express.json());
  app.use('/api/v1/fs', fsRouter);
  app.use('/api/v1/git', gitRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Test FS List on current project and default UI project placeholder
    const listRes = await fetch(`${baseUrl}/api/v1/fs/list?projectPath=${encodeURIComponent('C:\\Projects\\hyper-relay')}`);
    assert.strictEqual(listRes.status, 200, 'GET /api/v1/fs/list should return 200');
    const listData = await listRes.json();
    assert.ok(Array.isArray(listData.files), 'Response should contain files array');
    assert.ok(listData.files.length > 0, 'Directory listing should contain files');
    const hasPackageJson = listData.files.some((f: any) => f.name === 'package.json');
    assert.ok(hasPackageJson, 'Listing should find package.json');
    console.log('✓ GET /api/v1/fs/list returned real project files.');

    // 1b. Test FS List on subdirectory (src)
    const subListRes = await fetch(
      `${baseUrl}/api/v1/fs/list?projectPath=${encodeURIComponent('C:\\Projects\\hyper-relay')}&subDirectory=src`
    );
    assert.strictEqual(subListRes.status, 200, 'Subdirectory list should return 200');
    const subListData = await subListRes.json();
    assert.ok(subListData.files.some((f: any) => f.name === 'App.tsx'), 'src listing should include App.tsx');
    console.log('✓ GET /api/v1/fs/list?subDirectory=src returned real subdirectory files.');

    // 2. Test Path Traversal Protection over HTTP
    const attackRes = await fetch(
      `${baseUrl}/api/v1/fs/list?projectPath=${encodeURIComponent(process.cwd())}&subDirectory=${encodeURIComponent('../../../../../../etc')}`
    );
    assert.strictEqual(attackRes.status, 403, 'Path traversal should return HTTP 403 Forbidden');
    const attackData = await attackRes.json();
    assert.strictEqual(attackData.error, 'PATH_NOT_ALLOWED');
    console.log('✓ Path traversal blocked over HTTP API with 403 PATH_NOT_ALLOWED.');

    // 3. Test Read File
    const readRes = await fetch(`${baseUrl}/api/v1/fs/read?filePath=package.json`);
    assert.strictEqual(readRes.status, 200);
    const readData = await readRes.json();
    assert.strictEqual(readData.encoding, 'utf-8');
    assert.ok(readData.hash.startsWith('sha256:'));
    assert.ok(readData.content.includes('"name": "react-example"'));
    console.log('✓ GET /api/v1/fs/read successfully read package.json with SHA-256 hash.');

    // 3b. Test Create, Conflict Detection (409), Write, and Delete Lifecycle over HTTP
    const tempFileName = `.tmp_api_test_${Date.now()}.txt`;
    const createRes = await fetch(`${baseUrl}/api/v1/fs/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directoryPath: process.cwd(), fileName: tempFileName, isTextOnly: true }),
    });
    assert.strictEqual(createRes.status, 201, 'POST /api/v1/fs/create should return 201');

    const conflictRes = await fetch(`${baseUrl}/api/v1/fs/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: tempFileName,
        content: 'should fail due to stale hash',
        expectedVersionHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      }),
    });
    assert.strictEqual(conflictRes.status, 409, 'Stale version hash write must return 409 Conflict');
    const conflictData = await conflictRes.json();
    assert.strictEqual(conflictData.error, 'FILE_CONFLICT');

    const deleteRes = await fetch(`${baseUrl}/api/v1/fs/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: tempFileName }),
    });
    assert.strictEqual(deleteRes.status, 200, 'DELETE /api/v1/fs/delete should return 200');
    console.log('✓ Create, 409 FILE_CONFLICT check, and Delete lifecycle verified over HTTP.');

    // 4. Test Git Status on current project
    const gitStatusRes = await fetch(`${baseUrl}/api/v1/git/status?projectPath=${encodeURIComponent('C:\\Projects\\hyper-relay')}`);
    assert.strictEqual(gitStatusRes.status, 200);
    const gitData = await gitStatusRes.json();
    assert.ok(typeof gitData.branch === 'string' && gitData.branch.length > 0);
    assert.ok(typeof gitData.dirtyFilesCount === 'number');
    assert.ok(typeof gitData.isDirty === 'boolean');
    console.log(`✓ GET /api/v1/git/status successfully queried repository on branch: ${gitData.branch}`);

    // 5. Test Git Branches
    const branchesRes = await fetch(`${baseUrl}/api/v1/git/branches?projectPath=${encodeURIComponent('C:\\Projects\\hyper-relay')}`);
    assert.strictEqual(branchesRes.status, 200);
    const branchData = await branchesRes.json();
    assert.ok(branchData.branches.includes(gitData.branch));
    console.log(`✓ GET /api/v1/git/branches returned active branches including ${gitData.branch}.`);

    console.log('\n========================================');
    console.log('  ALL HOST REST API ENDPOINTS VERIFIED! ');
    console.log('========================================\n');
  } finally {
    server.close();
  }
}

testApi().catch((err) => {
  console.error('API Test Error:', err);
  process.exit(1);
});
