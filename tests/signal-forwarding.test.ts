import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSignalHandler,
  type SignalState,
  type SignalHandlerOptions
} from '../src/core/signal-handler.js';
import type { ChildProcess } from 'node:child_process';

// Mock child process
function createMockChild(): ChildProcess & {
  killed: boolean;
  exitCode: number | null;
  mockKill: ReturnType<typeof vi.fn>;
} {
  const mockKill = vi.fn(() => true);
  return {
    pid: 12345,
    killed: false,
    exitCode: null,
    kill: mockKill,
    mockKill
  } as unknown as ChildProcess & {
    killed: boolean;
    exitCode: number | null;
    mockKill: ReturnType<typeof vi.fn>;
  };
}

describe('createSignalHandler', () => {
  let originalListeners: Map<string, NodeJS.SignalsListener[]>;

  beforeEach(() => {
    // Store original listeners
    originalListeners = new Map();
    ['SIGINT', 'SIGTERM', 'SIGWINCH'].forEach(sig => {
      originalListeners.set(sig, process.listeners(sig as NodeJS.Signals) as NodeJS.SignalsListener[]);
    });
  });

  afterEach(() => {
    // Restore original listeners
    ['SIGINT', 'SIGTERM', 'SIGWINCH'].forEach(sig => {
      process.removeAllListeners(sig);
      originalListeners.get(sig)?.forEach(listener => {
        process.on(sig as NodeJS.Signals, listener);
      });
    });
  });

  it('returns signal state object', () => {
    const child = createMockChild();
    const handler = createSignalHandler(child as ChildProcess, {});

    expect(handler.getState()).toMatchObject({
      receivedSignal: undefined,
      forceKilled: false,
      signalCount: 0
    });

    handler.cleanup();
  });

  it('forwards SIGTERM to child process', () => {
    const child = createMockChild();
    const handler = createSignalHandler(child as ChildProcess, {});

    handler.handleSignal('SIGTERM');

    expect(child.mockKill).toHaveBeenCalledWith('SIGTERM');
    expect(handler.getState().receivedSignal).toBe('SIGTERM');

    handler.cleanup();
  });

  it('forwards SIGINT to child process', () => {
    const child = createMockChild();
    const handler = createSignalHandler(child as ChildProcess, {});

    handler.handleSignal('SIGINT');

    expect(child.mockKill).toHaveBeenCalledWith('SIGINT');
    expect(handler.getState().receivedSignal).toBe('SIGINT');
    expect(handler.getState().signalCount).toBe(1);

    handler.cleanup();
  });

  it('sends SIGKILL on second SIGINT', () => {
    const child = createMockChild();
    const handler = createSignalHandler(child as ChildProcess, { graceMs: 5000 });

    handler.handleSignal('SIGINT');
    handler.handleSignal('SIGINT');

    expect(child.mockKill).toHaveBeenCalledWith('SIGINT');
    expect(child.mockKill).toHaveBeenCalledWith('SIGKILL');
    expect(handler.getState().forceKilled).toBe(true);

    handler.cleanup();
  });

  it('calls onSignal callback when signal received', () => {
    const child = createMockChild();
    const onSignal = vi.fn();
    const handler = createSignalHandler(child as ChildProcess, { onSignal });

    handler.handleSignal('SIGTERM');

    expect(onSignal).toHaveBeenCalledWith('SIGTERM', expect.objectContaining({
      receivedSignal: 'SIGTERM',
      signalCount: 1
    }));

    handler.cleanup();
  });

  it('calls onForceKill callback when force killing', () => {
    const child = createMockChild();
    const onForceKill = vi.fn();
    const handler = createSignalHandler(child as ChildProcess, { onForceKill });

    handler.handleSignal('SIGINT');
    handler.handleSignal('SIGINT');

    expect(onForceKill).toHaveBeenCalled();

    handler.cleanup();
  });

  it('does not forward signals if child already exited', () => {
    const child = createMockChild();
    child.exitCode = 0;
    const handler = createSignalHandler(child as ChildProcess, {});

    handler.handleSignal('SIGTERM');

    expect(child.mockKill).not.toHaveBeenCalled();

    handler.cleanup();
  });

  it('starts grace timer after SIGTERM', async () => {
    vi.useFakeTimers();
    const child = createMockChild();
    const handler = createSignalHandler(child as ChildProcess, { graceMs: 100 });

    handler.handleSignal('SIGTERM');

    // Should have sent SIGTERM
    expect(child.mockKill).toHaveBeenCalledWith('SIGTERM');
    expect(child.mockKill).not.toHaveBeenCalledWith('SIGKILL');

    // Advance past grace period
    await vi.advanceTimersByTimeAsync(150);

    // Should now have sent SIGKILL
    expect(child.mockKill).toHaveBeenCalledWith('SIGKILL');

    handler.cleanup();
    vi.useRealTimers();
  });

  it('cleanup clears grace timer', async () => {
    vi.useFakeTimers();
    const child = createMockChild();
    const handler = createSignalHandler(child as ChildProcess, { graceMs: 100 });

    handler.handleSignal('SIGTERM');
    handler.cleanup();

    // Advance past grace period
    await vi.advanceTimersByTimeAsync(150);

    // Should not have sent SIGKILL (timer was cleared)
    expect(child.mockKill).toHaveBeenCalledTimes(1);
    expect(child.mockKill).toHaveBeenCalledWith('SIGTERM');

    vi.useRealTimers();
  });

  it('handles kill throwing gracefully', () => {
    const child = createMockChild();
    child.mockKill.mockImplementation(() => { throw new Error('process gone'); });

    const handler = createSignalHandler(child as ChildProcess, {});

    // Should not throw
    expect(() => handler.handleSignal('SIGTERM')).not.toThrow();

    handler.cleanup();
  });

  it('is idempotent for cleanup', () => {
    const child = createMockChild();
    const handler = createSignalHandler(child as ChildProcess, {});

    expect(() => {
      handler.cleanup();
      handler.cleanup();
      handler.cleanup();
    }).not.toThrow();
  });

  it('forwards SIGWINCH when enabled', () => {
    const child = createMockChild();
    const handler = createSignalHandler(child as ChildProcess, { forwardSigwinch: true });

    handler.handleSignal('SIGWINCH');

    expect(child.mockKill).toHaveBeenCalledWith('SIGWINCH');

    handler.cleanup();
  });

  it('does not forward SIGWINCH by default', () => {
    const child = createMockChild();
    const handler = createSignalHandler(child as ChildProcess, {});

    handler.handleSignal('SIGWINCH');

    expect(child.mockKill).not.toHaveBeenCalled();

    handler.cleanup();
  });
});
