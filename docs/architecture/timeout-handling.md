# Subprocess Timeout Handling

Design rules for preventing hung backend CLIs (e.g., Claude stream-json stalls) and failing fast while preserving whatever state we can.

## Goals
- Catch both **total runtime overruns** and **idle stalls** without blocking streaming output.
- Give users control: per-backend defaults, overrides via flags/config, and an explicit `--no-timeout` escape hatch for truly long jobs.
- Fail gracefully: send SIGTERM first, escalate to SIGKILL only after a grace period, and surface a clear timeout error with context for support.
- Allow persistence hooks so partial session data can be saved before the process is torn down.

## Defaults and configuration
- **Defaults (per backend)**: absolute timeout **30m**, idle timeout **5m** of silence, grace period **5s** between SIGTERM and SIGKILL. Values live in `DEFAULT_TIMEOUTS_BY_BACKEND` so adapters can adjust later if needed.
- **Overrides**: `absoluteMs`, `idleMs`, and `killAfterMs` may be set per invocation; any non-positive value disables that timer. Passing `null` explicitly disables an individual timer.
- **No-timeout mode**: `noTimeout` disables both timers. CLI layer will expose this as `--no-timeout`; overrides like `--timeout 10m` and `--idle-timeout 2m` will map into the same options object.
- **Startup behavior**: idle timer starts immediately at spawn, so “no output ever appeared” hangs are caught without requiring a first chunk.

## Detection
- **Absolute timer**: wall-clock from process start → timeout when exceeded.
- **Idle timer**: reset on any stdout/stderr chunk (after ANSI handling in the tee path); timeout when no output arrives for the configured window.

## Response
- On the first timeout (idle or absolute):
  - Build a `TimeoutInfo` record: reason, pid, startedAt, triggeredAt, elapsedMs, lastOutputAt, configured limits, and `forceKilled` flag (updated if SIGKILL is sent).
  - Invoke `onTimeout` hook before signals so session metadata can be persisted.
  - Send **SIGTERM**, then schedule **SIGKILL** after the grace period if the child is still running. Mark `forceKilled` when SIGKILL is dispatched.
  - Surface `SubprocessTimeoutError` with a human-readable message and the `TimeoutInfo` payload for callers/UIs.

## Implementation (src/core/executor.ts)
- `executeWithTimeout(command, args, options)` wraps `execa` with streaming pipes, timeout bookkeeping, and tee hooks (`onStdout`, `onStderr`, `onTimeout`).
- Uses `resolveTimeouts` to merge per-backend defaults with overrides; `noTimeout` skips both timers entirely.
- Timers are cleared on process exit/cleanup; idle and absolute timers are mutually exclusive only in the sense that the first to fire wins.
- The force-kill timer is manual (not `execa`’s built-in `timeout`) so we know whether SIGKILL was required.

## Testing
- Vitest coverage in `tests/executor.timeout.test.ts` with fixtures that ignore SIGTERM (force kill), hang silently (idle timeout), respect graceful termination, and confirm the `noTimeout` escape hatch.
- Future integration tests should wrap real Codex/Claude/Gemini binaries with long-running prompts to ensure flags are wired correctly end-to-end.
