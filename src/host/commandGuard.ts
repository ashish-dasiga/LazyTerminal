export interface CommandGuardResult {
  allowed: boolean;
  code?: 'COMMAND_REJECTED' | 'COMMAND_APPROVAL_REQUIRED';
  reason?: string;
}

const MAX_COMMAND_LENGTH = 8192;

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(format|diskpart)\b/i,
    reason: 'Disk formatting or partition manipulation commands are blocked on the remote host.',
  },
  {
    pattern: /\bcipher\s+\/w:/i,
    reason: 'Disk wipe commands (cipher /w:) are blocked on the remote host.',
  },
  {
    pattern: /\b(Stop-Computer|Restart-Computer)\b|\bshutdown(?:\.exe)?\s+\/[sr]/i,
    reason: 'Host shutdown/restart commands are blocked from mobile terminal execution.',
  },
  {
    pattern: /\b(?:Remove-Item|ri|rm|del|erase|rd|rmdir)\b[^\n;]*\b(?:[A-Za-z]:\\|\/)\s*(?:$|[;&|])/i,
    reason: 'Root filesystem deletion commands are blocked for host safety.',
  },
  {
    pattern: /\b(?:Remove-Item|ri)\b(?=[^\n;]*-Recurse)(?=[^\n;]*-Force)[^\n;]*(?:[A-Za-z]:\\Windows|[A-Za-z]:\\Users|[A-Za-z]:\\Program Files)/i,
    reason: 'Recursive forced deletion of system or user root directories is blocked.',
  },
  {
    pattern: /\b(?:rd|rmdir)\s+\/s\s+\/q\s+[A-Za-z]:\\(?:Windows|Users|Program Files|$)/i,
    reason: 'Recursive forced deletion of system or root directories is blocked.',
  },
  {
    pattern: /\breg(?:\.exe)?\s+delete\s+HKLM/i,
    reason: 'Deleting HKLM registry keys is blocked from remote terminal execution.',
  },
  {
    pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    reason: 'Fork bomb patterns are blocked.',
  },
];

export function validateCommandSafety(command: string): CommandGuardResult {
  const trimmed = command.trim();
  if (!trimmed) {
    return {
      allowed: false,
      code: 'COMMAND_REJECTED',
      reason: 'Command cannot be empty.',
    };
  }

  if (trimmed.length > MAX_COMMAND_LENGTH) {
    return {
      allowed: false,
      code: 'COMMAND_REJECTED',
      reason: `Command exceeds maximum allowed length (${MAX_COMMAND_LENGTH} characters).`,
    };
  }

  if (trimmed.includes('\0')) {
    return {
      allowed: false,
      code: 'COMMAND_REJECTED',
      reason: 'Command contains illegal null byte characters.',
    };
  }

  for (const rule of BLOCKED_PATTERNS) {
    if (rule.pattern.test(trimmed)) {
      return {
        allowed: false,
        code: 'COMMAND_APPROVAL_REQUIRED',
        reason: rule.reason,
      };
    }
  }

  return { allowed: true };
}
