import { execa } from 'execa';

export type BackendName = 'codex' | 'claude' | 'gemini';
export type TimeoutReason = 'absolute' | 'idle';

export interface TimeoutOverrides {
  absoluteMs?: number | null;
  idleMs?: number | null;
  killAfterMs?: number;
  noTimeout?: boolean;
}

export interface ResolvedTimeouts {
  absoluteMs: number | null;
  idleMs: number | null;
  killAfterMs: number;
  noTimeout: boolean;
}

export interface TimeoutInfo {
  reason: TimeoutReason;
  pid?: number;
  startedAt: Date;
  triggeredAt: Date;
  elapsedMs: number;
  lastOutputAt?: Date;
  absoluteTimeoutMs: number | null;
  idleTimeoutMs: number | null;
  killGraceMs: number;
  forceKilled: boolean;
}

export interface ExecuteCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  backend?: BackendName;
  timeout?: TimeoutOverrides;
  onStdout?: (chunk: Buffer) => void;
  onStderr?: (chunk: Buffer) => void;
  onTimeout?: (info: TimeoutInfo) => void | Promise<void>;
}

export interface ExecutionResult {
  exitCode: number;
  signal: NodeJS.Signals | null;
  durationMs: number;
  pid?: number;
}

export class SubprocessTimeoutError extends Error {
  info: TimeoutInfo;

  constructor(info: TimeoutInfo, cause?: unknown) {
    super(buildTimeoutMessage(info), { cause });
    this.name = 'SubprocessTimeoutError';
    this.info = info;
  }
}

const BASE_TIMEOUTS = {
  absoluteMs: 30 * 60 * 1000, // 30 minutes
  idleMs: 5 * 60 * 1000, // 5 minutes of silence
  killAfterMs: 5 * 1000 // wait 5s after SIGTERM, then SIGKILL
};

export const DEFAULT_TIMEOUTS_BY_BACKEND: Record<BackendName, typeof BASE_TIMEOUTS> = {
  codex: { ...BASE_TIMEOUTS },
  claude: { ...BASE_TIMEOUTS },
  gemini: { ...BASE_TIMEOUTS }
};

export function resolveTimeouts(
  backend?: BackendName,
  overrides?: TimeoutOverrides
): ResolvedTimeouts {
  const preset = backend ? DEFAULT_TIMEOUTS_BY_BACKEND[backend] ?? BASE_TIMEOUTS : BASE_TIMEOUTS;
  const noTimeout = overrides?.noTimeout ?? false;

  const absoluteMs = noTimeout
    ? null
    : normalizeTimeout(overrides?.absoluteMs, preset.absoluteMs);
  const idleMs = noTimeout ? null : normalizeTimeout(overrides?.idleMs, preset.idleMs);
  const killAfterMs = normalizeKillTimeout(overrides?.killAfterMs, preset.killAfterMs);

  return { absoluteMs, idleMs, killAfterMs, noTimeout };
}

export async function executeWithTimeout(
  command: string,
  args: string[],
  options: ExecuteCommandOptions = {}
): Promise<ExecutionResult> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs);
  const resolvedTimeouts = resolveTimeouts(options.backend, options.timeout);

  const child = execa(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    forceKillAfterDelay: false
  });

  let idleTimer: NodeJS.Timeout | null = null;
  let absoluteTimer: NodeJS.Timeout | null = null;
  let forceKillTimer: NodeJS.Timeout | null = null;
  let timeoutInfo: TimeoutInfo | null = null;
  let lastOutputAt: Date | undefined = startedAt;

  const clearTimers = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (absoluteTimer) {
      clearTimeout(absoluteTimer);
      absoluteTimer = null;
    }
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
      forceKillTimer = null;
    }
  };

  const resetIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
    }

    if (resolvedTimeouts.idleMs !== null) {
      idleTimer = setTimeout(() => triggerTimeout('idle'), resolvedTimeouts.idleMs);
    }
  };

  const triggerTimeout = (reason: TimeoutReason) => {
    if (timeoutInfo) {
      return;
    }

    const triggeredAt = new Date();
    timeoutInfo = {
      reason,
      pid: child.pid ?? undefined,
      startedAt,
      triggeredAt,
      elapsedMs: triggeredAt.getTime() - startedAtMs,
      lastOutputAt,
      absoluteTimeoutMs: resolvedTimeouts.absoluteMs,
      idleTimeoutMs: resolvedTimeouts.idleMs,
      killGraceMs: resolvedTimeouts.killAfterMs,
      forceKilled: false
    };

    if (options.onTimeout) {
      void Promise.resolve(options.onTimeout(timeoutInfo)).catch(() => undefined);
    }

    sendTerminationSignals();
  };

  const sendTerminationSignals = () => {
    if (child.exitCode !== null) {
      return;
    }

    try {
      child.kill('SIGTERM');
    } catch {
      // If the process already exited, kill may throw; swallow so we still surface the timeout error.
    }

    if (resolvedTimeouts.killAfterMs > 0) {
      forceKillTimer = setTimeout(() => {
        if (child.exitCode === null) {
          try {
            const killed = child.kill('SIGKILL');
            if (timeoutInfo) {
              timeoutInfo.forceKilled = timeoutInfo.forceKilled || killed;
            }
          } catch {
            if (timeoutInfo) {
              timeoutInfo.forceKilled = true;
            }
          }
        }
      }, resolvedTimeouts.killAfterMs);
    }
  };

  const handleData = (kind: 'stdout' | 'stderr') => (chunk: Buffer | string) => {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    lastOutputAt = new Date();
    resetIdleTimer();

    if (kind === 'stdout') {
      options.onStdout?.(buffer);
    } else {
      options.onStderr?.(buffer);
    }
  };

  if (child.stdout) {
    child.stdout.on('data', handleData('stdout'));
  }

  if (child.stderr) {
    child.stderr.on('data', handleData('stderr'));
  }

  if (!resolvedTimeouts.noTimeout) {
    if (resolvedTimeouts.absoluteMs !== null) {
      absoluteTimer = setTimeout(() => triggerTimeout('absolute'), resolvedTimeouts.absoluteMs);
    }

    if (resolvedTimeouts.idleMs !== null) {
      resetIdleTimer();
    }
  }

  child.once?.('exit', clearTimers);

  try {
    const result = await child;
    clearTimers();

    if (timeoutInfo) {
      throw new SubprocessTimeoutError(timeoutInfo);
    }

    return {
      exitCode: result.exitCode ?? 0,
      signal: result.signal ?? null,
      durationMs: Date.now() - startedAtMs,
      pid: child.pid ?? undefined
    };
  } catch (error) {
    clearTimers();

    if (timeoutInfo) {
      throw new SubprocessTimeoutError(timeoutInfo, error);
    }

    throw error;
  }
}

function normalizeTimeout(value: number | null | undefined, fallback: number): number | null {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function normalizeKillTimeout(value: number | null | undefined, fallback: number): number {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function buildTimeoutMessage(info: TimeoutInfo): string {
  const limit =
    info.reason === 'absolute'
      ? formatDuration(info.absoluteTimeoutMs)
      : `${formatDuration(info.idleTimeoutMs)} of inactivity`;
  const pidPart = info.pid ? `pid ${info.pid}` : 'unknown pid';
  const lastOutputPart =
    info.lastOutputAt && info.triggeredAt
      ? `, last output ${info.triggeredAt.getTime() - info.lastOutputAt.getTime()}ms ago`
      : '';
  const killPath = info.forceKilled ? 'SIGTERM then SIGKILL' : 'SIGTERM';

  return `Subprocess timed out (${info.reason}) after ${limit} (${pidPart}${lastOutputPart}); sent ${killPath}.`;
}

function formatDuration(value: number | null): string {
  if (value === null) {
    return 'disabled';
  }

  if (value >= 60_000) {
    return `${(value / 60_000).toFixed(1)}m`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }

  return `${value}ms`;
}
