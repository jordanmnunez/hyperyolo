import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  executeWithTimeout,
  SubprocessTimeoutError,
  type TimeoutInfo
} from '../src/core/executor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

describe('executeWithTimeout', () => {
  test('absolute timeout escalates to SIGKILL after grace period', async () => {
    let callbackInfo: TimeoutInfo | undefined;
    let error: unknown;

    try {
      await executeWithTimeout(process.execPath, [fixture('ignore-term.js')], {
        timeout: { absoluteMs: 150, idleMs: null, killAfterMs: 60 },
        onTimeout: (info) => {
          callbackInfo = info;
        }
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(SubprocessTimeoutError);
    const timeoutError = error as SubprocessTimeoutError;

    expect(timeoutError.info.reason).toBe('absolute');
    expect(timeoutError.info.forceKilled).toBe(true);
    expect(timeoutError.info.elapsedMs).toBeGreaterThanOrEqual(120);
    expect(callbackInfo?.reason).toBe('absolute');
  });

  test('idle timeout fires when output stalls', async () => {
    let error: unknown;

    try {
      await executeWithTimeout(process.execPath, [fixture('idle-runner.js')], {
        timeout: { idleMs: 100, absoluteMs: null, killAfterMs: 50 }
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(SubprocessTimeoutError);
    const timeoutError = error as SubprocessTimeoutError;

    expect(timeoutError.info.reason).toBe('idle');
    expect(timeoutError.info.lastOutputAt).toBeInstanceOf(Date);
    expect(typeof timeoutError.info.forceKilled).toBe('boolean');
  });

  test('noTimeout disables both idle and absolute timers', async () => {
    const result = await executeWithTimeout(process.execPath, [fixture('long-task.js')], {
      timeout: { noTimeout: true, absoluteMs: 50, idleMs: 50 }
    });

    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(180);
  });

  test('graceful shutdown avoids SIGKILL escalation', async () => {
    let error: unknown;

    try {
      await executeWithTimeout(process.execPath, [fixture('graceful-term.js')], {
        timeout: { absoluteMs: 80, idleMs: null, killAfterMs: 200 }
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(SubprocessTimeoutError);
    const timeoutError = error as SubprocessTimeoutError;

    expect(timeoutError.info.reason).toBe('absolute');
    expect(timeoutError.info.forceKilled).toBe(false);
    expect(timeoutError.info.killGraceMs).toBe(200);
  });
});
