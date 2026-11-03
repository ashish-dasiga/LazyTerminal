import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startHostCompanionServer } from '../src/host/companionServer';
import { clearDynamicAuthorizedRoots } from '../src/server/fsSecurity';

async function testApi() {
  console.log('--- Testing Host Companion Dynamic Workspace, Filesystem, and Git REST Endpoints ---');

  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'lt-phase3-'));
  const spaceWorkspace = path.join(tempParent, 'Lazy Terminal E2E Workspace');
  fs.mkdirSync(spaceWorkspace, { recursive: true });

  const host = await startHostCompanionServer(
    {
      hostBind: '127.0.0.1',
      hostPort: 0,
      defaultWorkspaceRoot: process.cwd(),
      allowedRoots: [process.cwd(), tempParent],
    },
    { silentLogger: true },
  );

  const baseUrl = `http://127.0.0.1:${host.port}`;

  try {
    // 0. Authenticate via real pairing flow
    const keyRes = await fetch(`${baseUrl}/api/v1/pairing/key`);
    assert.strictEqual(keyRes.status, 200);
    const { pairingKey } = await keyRes.json();

    const connectRes = await fetch(`${baseUrl}/api/v1/tunnel/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingKey }),
    });
    assert.strictEqual(connectRes.status, 200);
    const { sessionToken } = await connectRes.json();
    assert.ok(sessionToken, 'Must receive real sessionToken');

    const authHeaders = {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    };

    // 1. Verify C:\Projects\hyper-relay is NOT silently aliased when missing
    if (!fs.existsSync('C:\\Projects\\hyper-relay')) {
      const fakeWsRes = await fetch(`${baseUrl}/api/v1/workspace/select`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ path: 'C:\\Projects\\hyper-relay' }),
      });
      assert.strictEqual(
        fakeWsRes.status,
        404,
        'Missing C:\\Projects\\hyper-relay must fail honestly with 404, never silently alias',
      );
      const fakeWsData = await fakeWsRes.json();
      assert.strictEqual(fakeWsData.error?.code, 'DIRECTORY_NOT_FOUND');
      console.log('✓ Non-existent C:\\Projects\\hyper-relay rejected honestly with 404 DIRECTORY_NOT_FOUND.');
    }

    // 2. Browse Windows folders
    const browseRes = await fetch(
      `${baseUrl}/api/v1/workspace/browse?path=${encodeURIComponent(tempParent)}`,
      { headers: authHeaders },
    );
    assert.strictEqual(browseRes.status, 200);
    const browseData = await browseRes.json();
    assert.ok(Array.isArray(browseData.drives) && browseData.drives.length > 0);
    assert.ok(
      browseData.entries.some((e: { name: string }) => e.name === 'Lazy Terminal E2E Workspace'),
      'Browse must list subfolder with spaces',
    );
    console.log('✓ GET /api/v1/workspace/browse returned drives and real Windows subfolders.');

    // 3. Select disposable folder with spaces as active workspace
    const selectRes = await fetch(`${baseUrl}/api/v1/workspace/select`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ path: spaceWorkspace }),
    });
    assert.strictEqual(selectRes.status, 200);
    const selectData = await selectRes.json();
    assert.strictEqual(selectData.workspace.exists, true);
    assert.strictEqual(selectData.workspace.isGitRepo, false);
    console.log('✓ POST /api/v1/workspace/select selected dynamic Windows workspace with spaces.');

    // 4. Empty folder listing returns empty array cleanly
    const emptyListRes = await fetch(
      `${baseUrl}/api/v1/fs/list?projectPath=${encodeURIComponent(spaceWorkspace)}`,
      { headers: authHeaders },
    );
    assert.strictEqual(emptyListRes.status, 200);
    const emptyListData = await emptyListRes.json();
    assert.deepStrictEqual(emptyListData.files, []);
    console.log('✓ GET /api/v1/fs/list returned [] for empty directory.');

    // 5. Non-Git workspace returns graceful Git status
    const nonGitRes = await fetch(
      `${baseUrl}/api/v1/git/status?projectPath=${encodeURIComponent(spaceWorkspace)}`,
      { headers: authHeaders },
    );
    assert.strictEqual(nonGitRes.status, 200);
    const nonGitData = await nonGitRes.json();
    assert.strictEqual(nonGitData.isGitRepo, false);
    assert.strictEqual(nonGitData.branch, 'local');
    console.log('✓ GET /api/v1/git/status handled non-Git workspace gracefully.');

    // 6. Create subfolder, create file inside subfolder, stat, read, conflict check, write, rename, delete
    const mkSubRes = await fetch(`${baseUrl}/api/v1/fs/create`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        directoryPath: spaceWorkspace,
        projectPath: spaceWorkspace,
        fileName: 'notes dir',
        isFolder: true,
      }),
    });
    assert.strictEqual(mkSubRes.status, 201);
    assert.ok(fs.existsSync(path.join(spaceWorkspace, 'notes dir')));

    const subFolderAbs = path.join(spaceWorkspace, 'notes dir');
    const createFileRes = await fetch(`${baseUrl}/api/v1/fs/create`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        directoryPath: subFolderAbs,
        projectPath: spaceWorkspace,
        fileName: 'hello-üñîçødé.txt',
        content: 'Line 1 UTF-8 🚀\nLine 2\n',
      }),
    });
    assert.strictEqual(createFileRes.status, 201);
    const createdMeta = await createFileRes.json();
    assert.strictEqual(createdMeta.path, 'notes dir/hello-üñîçødé.txt');

    const statRes = await fetch(
      `${baseUrl}/api/v1/fs/stat?projectPath=${encodeURIComponent(spaceWorkspace)}&filePath=${encodeURIComponent(createdMeta.path)}`,
      { headers: authHeaders },
    );
    assert.strictEqual(statRes.status, 200);
    const statData = await statRes.json();
    assert.strictEqual(statData.type, 'file');

    const readRes = await fetch(
      `${baseUrl}/api/v1/fs/read?projectPath=${encodeURIComponent(spaceWorkspace)}&filePath=${encodeURIComponent(createdMeta.path)}`,
      { headers: authHeaders },
    );
    assert.strictEqual(readRes.status, 200);
    const readData = await readRes.json();
    assert.strictEqual(readData.content, 'Line 1 UTF-8 🚀\nLine 2\n');
    assert.ok(readData.hash.startsWith('sha256:'));

    const conflictRes = await fetch(`${baseUrl}/api/v1/fs/write`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectPath: spaceWorkspace,
        filePath: createdMeta.path,
        content: 'stale write',
        expectedVersionHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      }),
    });
    assert.strictEqual(conflictRes.status, 409);

    const writeRes = await fetch(`${baseUrl}/api/v1/fs/write`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectPath: spaceWorkspace,
        filePath: createdMeta.path,
        content: 'Updated on Windows disk ✅\n',
        expectedVersionHash: readData.hash,
      }),
    });
    assert.strictEqual(writeRes.status, 200);
    assert.strictEqual(
      fs.readFileSync(path.join(subFolderAbs, 'hello-üñîçødé.txt'), 'utf8'),
      'Updated on Windows disk ✅\n',
    );

    const renameRes = await fetch(`${baseUrl}/api/v1/fs/rename`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectPath: spaceWorkspace,
        oldPath: createdMeta.path,
        newName: 'renamed-file.txt',
      }),
    });
    assert.strictEqual(renameRes.status, 200);
    const renameData = await renameRes.json();
    assert.strictEqual(renameData.newPath, 'notes dir/renamed-file.txt');
    assert.ok(!fs.existsSync(path.join(subFolderAbs, 'hello-üñîçødé.txt')));
    assert.ok(fs.existsSync(path.join(subFolderAbs, 'renamed-file.txt')));

    const deleteRes = await fetch(`${baseUrl}/api/v1/fs/delete`, {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({
        projectPath: spaceWorkspace,
        filePath: renameData.newPath,
      }),
    });
    assert.strictEqual(deleteRes.status, 200);
    assert.ok(!fs.existsSync(path.join(subFolderAbs, 'renamed-file.txt')));
    console.log('✓ Create folder/file, stat, read, 409 conflict, write, rename, and delete verified on host disk.');

    // 7. Path traversal protection
    const attackRes = await fetch(
      `${baseUrl}/api/v1/fs/list?projectPath=${encodeURIComponent(spaceWorkspace)}&subDirectory=${encodeURIComponent('../../../../../../Windows')}`,
      { headers: authHeaders },
    );
    assert.strictEqual(attackRes.status, 403);
    console.log('✓ Path traversal blocked over HTTP API with 403 PATH_NOT_ALLOWED.');

    // 8. Live Git repository status & branches on process.cwd()
    const gitStatusRes = await fetch(
      `${baseUrl}/api/v1/git/status?projectPath=${encodeURIComponent(process.cwd())}`,
      { headers: authHeaders },
    );
    assert.strictEqual(gitStatusRes.status, 200);
    const gitData = await gitStatusRes.json();
    assert.strictEqual(gitData.isGitRepo, true);
    assert.ok(typeof gitData.branch === 'string' && gitData.branch.length > 0);

    const branchesRes = await fetch(
      `${baseUrl}/api/v1/git/branches?projectPath=${encodeURIComponent(process.cwd())}`,
      { headers: authHeaders },
    );
    assert.strictEqual(branchesRes.status, 200);
    const branchData = await branchesRes.json();
    assert.ok(branchData.branches.includes(gitData.branch));
    console.log(`✓ Live Git status and branches verified on branch: ${gitData.branch}.`);

    console.log('\n========================================');
    console.log('  ALL HOST REST API ENDPOINTS VERIFIED! ');
    console.log('========================================\n');
  } finally {
    await host.close();
    clearDynamicAuthorizedRoots();
    fs.rmSync(tempParent, { recursive: true, force: true });
  }
}

testApi().catch((err) => {
  console.error('API Test Error:', err);
  process.exit(1);
});
