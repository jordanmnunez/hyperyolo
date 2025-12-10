import type { ChildProcess } from 'node:child_process';

export interface SignalState {
  receivedSignal?: NodeJS.Signals;
  graceTimer?: NodeJS.Timeout;
  forceKilled: boolean;
  signalCount: number;
}

export interface SignalHandlerOptions {
  /** Grace period in ms before SIGKILL after SIGTERM. Defaults to 5000. */
  graceMs?: number;
  /** Callback when a signal is received. */
  onSignal?: (signal: NodeJS.Signals, state: SignalState) => void;
  /** Callback when force killing (SIGKILL) the child. */
  onForceKill?: () => void;
  /** Whether to forward SIGWINCH (terminal resize). Defaults to false. */
  forwardSigwinch?: boolean;
}

export interface SignalHandler {
  /** Get current signal state. */
  getState(): Readonly<SignalState>;
  /** Manually handle a signal (useful for testing). */
  handleSignal(signal: NodeJS.Signals): void;
  /** Clean up signal handlers and timers. */
  cleanup(): void;
}

const DEFAULT_GRACE_MS = 5000;

/**
 * Create a signal handler that forwards signals to a child process.
 */
export function createSignalHandler(
  child: ChildProcess,
  options: SignalHandlerOptions
): SignalHandler {
  const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
  const state: SignalState = {
    receivedSignal: undefined,
    graceTimer: undefined,
    forceKilled: false,
    signalCount: 0
  };

  let cleaned = false;

  const sendSignal = (signal: NodeJS.Signals): boolean => {
    // Don't send if child already exited
    if (child.exitCode !== null) {
      return false;
    }

    try {
      child.kill(signal);
      return true;
    } catch {
      // Process may have exited between check and kill
      return false;
    }
  };

  const forceKill = (): void => {
    if (state.forceKilled) return;

    state.forceKilled = true;
    sendSignal('SIGKILL');
    options.onForceKill?.();
  };

  const startGraceTimer = (): void => {
    if (state.graceTimer) return;

    state.graceTimer = setTimeout(() => {
      forceKill();
    }, graceMs);
  };

  const handleSignal = (signal: NodeJS.Signals): void => {
    // Handle SIGWINCH specially
    if (signal === 'SIGWINCH') {
      if (options.forwardSigwinch) {
        sendSignal('SIGWINCH');
      }
      return;
    }

    state.signalCount++;

    // Double SIGINT = immediate force kill
    if (signal === 'SIGINT' && state.signalCount > 1) {
      forceKill();
      options.onSignal?.(signal, { ...state });
      return;
    }

    // First signal - record and forward
    if (!state.receivedSignal) {
      state.receivedSignal = signal;
    }

    sendSignal(signal);
    startGraceTimer();

    options.onSignal?.(signal, { ...state });
  };

  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;

    if (state.graceTimer) {
      clearTimeout(state.graceTimer);
      state.graceTimer = undefined;
    }
  };

  return {
    getState(): Readonly<SignalState> {
      return { ...state };
    },
    handleSignal,
    cleanup
  };
}

/**
 * Install process-level signal handlers that forward to a signal handler.
 * Returns a cleanup function to remove the handlers.
 */
export function installSignalHandlers(
  handler: SignalHandler,
  options: { forwardSigwinch?: boolean } = {}
): () => void {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  if (options.forwardSigwinch) {
    signals.push('SIGWINCH');
  }

  const listeners = new Map<NodeJS.Signals, () => void>();

  for (const signal of signals) {
    const listener = () => handler.handleSignal(signal);
    process.on(signal, listener);
    listeners.set(signal, listener);
  }

  return () => {
    for (const [signal, listener] of listeners) {
      process.removeListener(signal, listener);
    }
    listeners.clear();
    handler.cleanup();
  };
}
