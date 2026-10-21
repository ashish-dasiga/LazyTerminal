import { Router, Request, Response } from 'express';
import {
  getLiveCliCatalog,
  inspectCliStatus,
  executeInstallTool,
  getCapabilityMatrix,
  launchCliAgent,
} from '../services/cliDetector';
import { runDebugManager } from '../services/runDebugService';
import { previewManager } from '../services/previewService';

export const shreyaRouter = Router();

// ==========================================
// 1. CLI TOOLING & AI AGENT ENDPOINTS (S1-S3)
// ==========================================

shreyaRouter.get('/cli/matrix', (_req: Request, res: Response) => {
  res.json(getCapabilityMatrix());
});

shreyaRouter.get('/cli/tools', async (_req: Request, res: Response) => {
  try {
    const catalog = await getLiveCliCatalog();
    res.json(catalog);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

shreyaRouter.get('/cli/check', async (req: Request, res: Response) => {
  try {
    const name = String(req.query.name || '');
    if (!name) {
      res.status(400).json({ error: 'Query parameter "name" is required' });
      return;
    }
    const status = await inspectCliStatus(name);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

shreyaRouter.post('/cli/launch', async (req: Request, res: Response) => {
  try {
    const { toolId, workingDir, args, env } = req.body || {};
    if (!toolId) {
      res.status(400).json({ error: 'Body parameter "toolId" is required' });
      return;
    }
    const result = await launchCliAgent({ toolId, workingDir, args, env });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

shreyaRouter.post('/cli/install', async (req: Request, res: Response) => {
  try {
    const { toolId } = req.body;
    if (!toolId) {
      res.status(400).json({ error: 'Body parameter "toolId" is required' });
      return;
    }
    const result = await executeInstallTool(toolId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. PREVIEW & DEV SERVER ENDPOINTS (S5)
// ==========================================

shreyaRouter.get('/preview/lan-ip', (_req: Request, res: Response) => {
  const ip = previewManager.getHostLanIp();
  res.json({ ip });
});

shreyaRouter.get('/preview/servers', (_req: Request, res: Response) => {
  const servers = previewManager.listDevServers();
  res.json(servers);
});

shreyaRouter.post('/preview/servers/start', async (req: Request, res: Response) => {
  try {
    const { command, port, workingDir } = req.body;
    if (!command || !port) {
      res.status(400).json({ error: 'Parameters "command" and "port" are required' });
      return;
    }
    const server = await previewManager.startDevServer(command, Number(port), workingDir);
    res.json(server);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

shreyaRouter.post('/preview/servers/stop', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.body;
    if (!serverId) {
      res.status(400).json({ error: 'Parameter "serverId" is required' });
      return;
    }
    await previewManager.stopDevServer(serverId);
    res.json({ success: true, serverId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

shreyaRouter.post('/preview/python/run', async (req: Request, res: Response) => {
  try {
    const { scriptPath } = req.body;
    if (!scriptPath) {
      res.status(400).json({ error: 'Parameter "scriptPath" is required' });
      return;
    }
    const result = await previewManager.runPythonPreview(scriptPath);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

shreyaRouter.get('/preview/file-check', (req: Request, res: Response) => {
  const fileName = String(req.query.fileName || '');
  const result = previewManager.inspectFilePreviewCapability(fileName);
  res.json(result);
});

shreyaRouter.get('/preview/desktop-stream', (req: Request, res: Response) => {
  const appId = String(req.query.appId || 'default-desktop-app');
  res.json(previewManager.getDesktopAppStream(appId));
});

// ==========================================
// 3. RUN / DEBUG TASK ENDPOINTS (S4)
// ==========================================

shreyaRouter.get('/run-debug/detect', (req: Request, res: Response) => {
  const targetDir = String(req.query.path || process.cwd());
  const inspection = runDebugManager.inspectProject(targetDir);
  res.json(inspection);
});

shreyaRouter.post('/run-debug/start', (req: Request, res: Response) => {
  try {
    const { taskId, command, args, workingDir } = req.body;
    if (!taskId || !command) {
      res.status(400).json({ error: 'Parameters "taskId" and "command" are required' });
      return;
    }
    const record = runDebugManager.startTask(taskId, command, args || [], workingDir);
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

shreyaRouter.post('/run-debug/stop', (req: Request, res: Response) => {
  const { taskId } = req.body;
  if (!taskId) {
    res.status(400).json({ error: 'Parameter "taskId" is required' });
    return;
  }
  const stopped = runDebugManager.stopTask(taskId);
  res.json({ success: stopped, taskId });
});

shreyaRouter.get('/run-debug/tasks', (_req: Request, res: Response) => {
  const list = runDebugManager.listAllTasks();
  res.json(list);
});

shreyaRouter.get('/run-debug/tasks/:id', (req: Request, res: Response) => {
  const status = runDebugManager.getTaskStatus(req.params.id);
  if (!status) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json(status);
});
