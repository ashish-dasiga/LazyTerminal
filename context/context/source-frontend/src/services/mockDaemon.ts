import { CommandIntent, Project, TerminalLine, ProjectFile } from '../types/relay';

// Simple ANSI-to-HTML parser for realistic VT100 colors
export function parseAnsiToHtml(text: string): string {
  if (!text) return '';
  
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Standard ANSI colors
  html = html
    .replace(/\x1b\[32m(.*?)\x1b\[0m/g, '<span class="text-emerald-400 font-medium">$1</span>')
    .replace(/\x1b\[36m(.*?)\x1b\[0m/g, '<span class="text-cyan-400 font-medium">$1</span>')
    .replace(/\x1b\[35m(.*?)\x1b\[0m/g, '<span class="text-purple-300 font-medium">$1</span>')
    .replace(/\x1b\[33m(.*?)\x1b\[0m/g, '<span class="text-amber-300">$1</span>')
    .replace(/\x1b\[31m(.*?)\x1b\[0m/g, '<span class="text-rose-400">$1</span>')
    .replace(/\x1b\[90m(.*?)\x1b\[0m/g, '<span class="text-slate-500">$1</span>')
    .replace(/\x1b\[1m(.*?)\x1b\[0m/g, '<span class="font-bold text-white">$1</span>')
    .replace(/\x1b\[4m(.*?)\x1b\[0m/g, '<span class="underline">$1</span>');

  // Strip remaining escape codes
  html = html.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

  return html;
}

export interface ExecutionResponse {
  lines: Array<{
    type: TerminalLine['type'];
    content: string;
    delay?: number;
  }>;
  interceptCliPrompt?: {
    toolName: string;
    cliName: string;
    installCommand: string;
  };
  stateChanges?: {
    branch?: string;
    isDirty?: boolean;
    dirtyCount?: number;
    newCommit?: {
      hash: string;
      message: string;
      author: string;
      time: string;
    };
  };
}

export function executeCommandOnDaemon(
  command: string,
  currentProject: Project,
  installedCliMap: Record<string, boolean>
): ExecutionResponse {
  const trimmed = command.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check for AI CLIs
  if (lower.startsWith('claude') && !installedCliMap['claude']) {
    return {
      lines: [
        {
          type: 'error',
          content: `\x1b[31m'claude' is not recognized as an internal or external command, operable program or batch file.\x1b[0m`,
          delay: 50,
        },
      ],
      interceptCliPrompt: {
        toolName: 'Claude Code',
        cliName: 'claude',
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
    };
  }

  if (lower.startsWith('codex') && !installedCliMap['codex']) {
    return {
      lines: [
        {
          type: 'error',
          content: `\x1b[31m'codex' is not recognized as an internal or external command, operable program or batch file.\x1b[0m`,
          delay: 50,
        },
      ],
      interceptCliPrompt: {
        toolName: 'OpenAI Codex',
        cliName: 'codex',
        installCommand: 'npm install -g @openai/codex-cli',
      },
    };
  }

  if (lower.startsWith('gemini') && !installedCliMap['gemini']) {
    return {
      lines: [
        {
          type: 'error',
          content: `\x1b[31m'gemini' is not recognized as an internal or external command, operable program or batch file.\x1b[0m`,
          delay: 50,
        },
      ],
      interceptCliPrompt: {
        toolName: 'Gemini CLI',
        cliName: 'gemini',
        installCommand: 'npm install -g @google/gemini-cli',
      },
    };
  }

  // Active AI executions if installed
  if (lower.startsWith('claude')) {
    const promptMatch = trimmed.match(/claude\s+(.*)/i);
    const promptText = promptMatch ? promptMatch[1] : 'reviewing repository...';
    return {
      lines: [
        {
          type: 'ai_thought',
          content: `\x1b[35m[Claude Code v1.0.8]\x1b[0m Parsing AST and workspace context in \x1b[36m${currentProject.path}\x1b[0m...`,
          delay: 80,
        },
        {
          type: 'output',
          content: `\x1b[32m✔ Plan synthesized for prompt:\x1b[0m ${promptText}\nAnalyzing 7 project files:\n  • Verified Rust daemon state ledger\n  • Scanned TLS handshake routines in config/tunnel.yaml\n  • Found 0 invariant violations`,
          delay: 240,
        },
        {
          type: 'output',
          content: `\x1b[36mSuggested change:\x1b[0m Added SQLite WAL checkpoint background thread. Ready to stage changes.`,
          delay: 350,
        },
      ],
    };
  }

  if (lower.startsWith('codex')) {
    return {
      lines: [
        {
          type: 'ai_thought',
          content: `\x1b[36m[OpenAI Codex CLI]\x1b[0m Synthesizing code completions for ${currentProject.name}...`,
          delay: 80,
        },
        {
          type: 'output',
          content: `\x1b[32mCompleted snippet:\x1b[0m Generated unit test suite for Ed25519 payload verification. Exit code: 0`,
          delay: 200,
        },
      ],
    };
  }

  if (lower.startsWith('gemini')) {
    return {
      lines: [
        {
          type: 'ai_thought',
          content: `\x1b[34m[Gemini CLI 2.5 Pro]\x1b[0m Connected to developer workspace model...`,
          delay: 80,
        },
        {
          type: 'output',
          content: `\x1b[32m✔ Code Review Complete:\x1b[0m High test coverage detected. Suggested optimizing buffer lock in relay_daemon.rs line 42.`,
          delay: 220,
        },
      ],
    };
  }

  if (lower.startsWith('antigravity')) {
    return {
      lines: [
        {
          type: 'error',
          content: `\x1b[31m[Antigravity Error] Daemon agent bridge is unavailable on this Windows host.\x1b[0m\nAntigravity requires the native agent bridge service (port 9872). Direct invocation via standard ConPTY is not supported until the host agent daemon is configured.`,
          delay: 80,
        },
      ],
    };
  }

  // 2. Git Status
  if (lower === 'git status' || lower === 'gs') {
    return {
      lines: [
        {
          type: 'output',
          content: `\x1b[1mOn branch ${currentProject.branch}\x1b[0m\nYour branch is ahead of 'origin/${currentProject.branch.replace('*', '')}' by ${currentProject.ahead} commit.\n  (use "git push" to publish your local commits)\n`,
          delay: 50,
        },
        {
          type: 'output',
          content: currentProject.isDirty
            ? `\x1b[33mChanges not staged for commit:\x1b[0m\n  (use "git add <file>..." to update what will be committed)\n\n\t\x1b[31mmodified:   relay_daemon.rs\x1b[0m\n\t\x1b[31mmodified:   Cargo.toml\x1b[0m\n\n\x1b[33mUntracked files:\x1b[0m\n\t\x1b[31mconfig/tunnel.yaml\x1b[0m\n\nno changes added to commit (use "git add")`
            : `\x1b[32mnothing to commit, working tree clean\x1b[0m`,
          delay: 100,
        },
      ],
    };
  }

  // 3. Git Branch
  if (lower === 'git branch' || lower === 'git branch -a') {
    return {
      lines: [
        {
          type: 'output',
          content: `  dev\n  feature/reconciliation-engine\n* \x1b[32m${currentProject.branch}\x1b[0m\n  remotes/origin/HEAD -> origin/main\n  remotes/origin/main`,
          delay: 40,
        },
      ],
    };
  }

  // 4. Git Diff
  if (lower.startsWith('git diff')) {
    return {
      lines: [
        {
          type: 'output',
          content: `\x1b[1mdiff --git a/relay_daemon.rs b/relay_daemon.rs\x1b[0m\nindex 82fa9b4..f0c1143 100644\n--- a/relay_daemon.rs\n+++ b/relay_daemon.rs\n\x1b[36m@@ -42,7 +42,9 @@ pub async fn handle_incoming_intent(intent: Intent) -> Result<()> {\x1b[0m\n     info!("Reconciling intent #{}", intent.seq);\n\x1b[31m-    execute_raw_shell(&intent.command).await?;\x1b[0m\n\x1b[32m+    let verified = verify_ed25519_signature(&intent)?;\x1b[0m\n\x1b[32m+    let outcome = execute_sandboxed_vt100(&intent.command).await?;\x1b[0m\n\x1b[32m+    persist_sqlite_audit_log(intent.seq, outcome.exit_code)?;\x1b[0m\n     Ok(())\n }`,
          delay: 60,
        },
      ],
    };
  }

  // 5. Git Log
  if (lower.startsWith('git log')) {
    return {
      lines: [
        {
          type: 'output',
          content: `\x1b[33mcommit ${currentProject.lastCommit.hash} (HEAD -> ${currentProject.branch}, origin/main)\x1b[0m\nAuthor: ${currentProject.lastCommit.author}\nDate:   ${currentProject.lastCommit.time}\n\n    ${currentProject.lastCommit.message}\n\n\x1b[33mcommit 9f41b2c41908ef1a7a2bc540938b\x1b[0m\nAuthor: dev@relay-terminal.io\nDate:   Sun Oct 11 18:22:10 2026 -0700\n\n    feat: add SQLite durable intent buffer and WAL mode\n\n\x1b[33mcommit a1b8400f983ce3d0107384192b0c\x1b[0m\nAuthor: dev@relay-terminal.io\nDate:   Fri Oct 09 14:05:44 2026 -0700\n\n    init: Windows 11 relay daemon skeleton with xterm.dart bridge`,
          delay: 60,
        },
      ],
    };
  }

  // 6. Git Checkout
  if (lower.startsWith('git checkout') || lower.startsWith('git switch')) {
    const parts = trimmed.split(' ');
    const newBranch = parts[parts.length - 1];
    return {
      lines: [
        {
          type: 'output',
          content: `Switched to branch '${newBranch}'`,
          delay: 80,
        },
      ],
      stateChanges: {
        branch: newBranch,
      },
    };
  }

  // 7. Git Add & Commit
  if (lower.startsWith('git commit')) {
    const match = trimmed.match(/-m\s+["']?(.*?)["']?$/);
    const msg = match ? match[1] : 'reconciled changes from mobile phone';
    const hash = Math.random().toString(16).substring(2, 9);
    return {
      lines: [
        {
          type: 'output',
          content: `[${currentProject.branch.replace('*', '')} ${hash}] ${msg}\n 2 files changed, 28 insertions(+), 6 deletions(-)\n create mode 100644 config/tunnel.yaml`,
          delay: 100,
        },
      ],
      stateChanges: {
        isDirty: false,
        dirtyCount: 0,
        branch: currentProject.branch.replace('*', ''),
        newCommit: {
          hash,
          message: msg,
          author: 'Mobile Relay <relay@terminal.app>',
          time: 'Just now',
        },
      },
    };
  }

  if (lower.startsWith('git push')) {
    return {
      lines: [
        {
          type: 'output',
          content: `Enumerating objects: 7, done.\nCounting objects: 100% (7/7), done.\nCompressing objects: 100% (4/4), done.\nWriting objects: 100% (4/4), 482 bytes | 482.00 KiB/s, done.\nTotal 4 (delta 3), reused 0 (delta 0)\nTo github.com:org/${currentProject.name}.git\n   ${currentProject.lastCommit.hash}..${Math.random().toString(16).substring(2, 9)}  ${currentProject.branch} -> ${currentProject.branch}`,
          delay: 150,
        },
      ],
    };
  }

  if (lower.startsWith('git pull')) {
    return {
      lines: [
        {
          type: 'output',
          content: `Already up to date.`,
          delay: 80,
        },
      ],
    };
  }

  // 8. Directory listings (dir / ls)
  if (lower === 'dir' || lower === 'ls' || lower === 'ls -la') {
    const lines = [
      {
        type: 'output' as const,
        content: `    Directory: ${currentProject.path}\n\nMode                 LastWriteTime         Length Name\n----                 -------------         ------ ----`,
        delay: 30,
      },
    ];

    currentProject.files.forEach((f) => {
      const mode = f.isDir ? 'd-----' : '-a----';
      const sizeStr = f.size || (f.isDir ? '' : '1240 B');
      lines.push({
        type: 'output' as const,
        content: `${mode.padEnd(20)} ${f.modified.padEnd(21)} ${sizeStr.padStart(6)} ${f.name}`,
        delay: 15,
      });
    });

    return { lines };
  }

  // 9. Node / npm / cargo / python
  if (lower.startsWith('npm test') || lower.startsWith('cargo test')) {
    return {
      lines: [
        {
          type: 'output',
          content: `\x1b[36mrunning 14 tests\x1b[0m\ntest relay::handshake::test_tls_negotiation ... \x1b[32mok\x1b[0m\ntest relay::wal::test_causal_dependency_validation ... \x1b[32mok\x1b[0m\ntest relay::sandbox::test_permission_jail ... \x1b[32mok\x1b[0m\ntest relay::xterm::test_vt100_chunking ... \x1b[32mok\x1b[0m\n\ntest result: \x1b[32mok\x1b[0m. 14 passed; 0 failed; 0 ignored; finished in 0.42s`,
          delay: 120,
        },
      ],
    };
  }

  if (lower.startsWith('npm run dev')) {
    return {
      lines: [
        {
          type: 'output',
          content: `\x1b[32m➜  VITE v5.4.8\x1b[0m  ready in 184 ms\n\n  ➜  Local:   \x1b[36mhttp://localhost:5173/\x1b[0m\n  ➜  Tunnel:  \x1b[36mhttps://tun-784.relay.internal/\x1b[0m (Active TLS 1.3)`,
          delay: 100,
        },
      ],
    };
  }

  // 10. Echo command
  if (lower.startsWith('echo ')) {
    return {
      lines: [
        {
          type: 'output',
          content: trimmed.substring(5).replace(/^["']|["']$/g, ''),
          delay: 20,
        },
      ],
    };
  }

  // 11. Default shell execution output
  return {
    lines: [
      {
        type: 'output',
        content: `[${trimmed}] completed (exit code 0)`,
        delay: 50,
      },
    ],
  };
}
