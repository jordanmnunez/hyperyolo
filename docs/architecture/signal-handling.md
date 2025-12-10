# Process Signal Handling and Graceful Shutdown

Design for how hyperyolo forwards terminal signals to backend CLIs, keeps session data safe, and exits cleanly without leaving zombie processes behind.

## Goals
- Mirror the terminal’s intent: forward user-initiated signals (Ctrl+C/SIGINT, SIGTERM) to the child first, wait briefly, then hard-kill only if required.
- Preserve state: persist session mappings and any collected stats before exit, even when interrupted.
- Keep streaming: do not block stdout/stderr; shutdown flows run alongside streaming and parsing.
- Be explicit about platform expectations (macOS, Linux) and limitations (SIGKILL, OOM).

## Signals to honor
- **SIGINT (Ctrl+C)**: user cancel; forward immediately to child, start graceful shutdown.
- **SIGTERM**: system/service manager request; treat like SIGINT but without UI noise.
- **SIGWINCH**: terminal resize; refresh local UI width and forward to child only if it inherits the TTY.
- **SIGKILL**: cannot be caught; document fallout and recovery expectations.
- **SIGHUP** (non-primary focus): follow Node defaults unless a future daemon mode needs explicit handling.

## Forwarding rules
- Register handlers once per run (debounced) so repeated signals don’t attach duplicate listeners.
- Keep the child in the same process group (default `detached: false` with execa) so the terminal delivers SIGINT to both parent and child; still call `child.kill(signal)` to cover non-TTY executions and scripted runs.
- Record the first received signal in state so downstream cleanup logic knows which path to take; ignore duplicate SIGINT/SIGTERM except for the double-Ctrl+C escape hatch below.
- Never forward signals after the child has already exited; short-circuit if `child.exitCode`/`child.killed` is set.

## Graceful shutdown flows
- **SIGINT (first press)**:
  - Mark run as `abortedBy: 'SIGINT'`, stop scheduling new timers beyond existing idle/absolute ones, and forward SIGINT to the child.
  - Start a grace timer (**5s** default, aligned with `timeout-handling.md`) before sending SIGKILL if the child is still alive.
  - Allow parsers to finish consuming buffered data so session ID/stats extraction can complete.
  - Print a concise notice (“Received Ctrl+C, asking <backend> to stop...”) but keep streaming until exit or force-kill.
- **SIGINT (second press before exit)**:
  - Skip the grace period and send SIGKILL to the child immediately.
  - Set the process exit code to 130 to match POSIX Ctrl+C semantics.
- **SIGTERM**:
  - Treat as a quiet graceful shutdown: forward SIGTERM, start the same 5s grace timer, and avoid UI chatter unless the kill escalates.
  - Exit code should mirror the child if it terminates itself; otherwise use 143 (128 + 15).
- **SIGWINCH**:
  - Update local layout (banner/footer widths) and, if the child is attached to the same TTY, forward SIGWINCH so downstream CLIs can reflow.
  - No impact on shutdown state.

## Cleanup and persistence
- Session mapping: if a native session ID has been discovered, flush it to `sessions.json` before process exit; use the same lock/atomic write rules from `session-storage.md`. If no ID is available, skip writing but do not truncate existing data.
- Stats: persist any collected execution stats alongside the session record when available; partial stats are acceptable if parsing was interrupted.
- Temp files and pipes: close/cleanup any fifo/temp files created for streaming to avoid leaking descriptors.
- Summary: attempt to print the footer/summary even on interrupts; if the child was force-killed, label the run as aborted and omit misleading success cues.
- Handlers must be idempotent so cleanup runs exactly once, regardless of which signal path fired.

## Abnormal termination and recovery
- **SIGKILL / OOM**: cannot be intercepted; rely on atomic session writes to avoid corruption. On next launch, re-parse `sessions.json` and surface a warning if the last run ended abruptly (e.g., by storing a `lastRunStatus: 'aborted' | 'killed' | 'ok'` flag when possible).
- **Parser mid-flight**: if the process dies before parsers flush, treat the session ID/stats as unavailable and avoid writing partial/invalid IDs.
- **Restart guidance**: document that resumes are disabled for runs terminated by SIGKILL/OOM unless the session ID was already persisted.

## Child process monitoring
- Subscribe to `exit`/`close`/`error` to detect child death promptly; clear all timers (idle, absolute, grace) on exit to avoid stray force-kills.
- Use execa’s promise resolution as the single place to trigger cleanup/finalization; signal handlers should only initiate shutdown, not call `process.exit` directly.
- To avoid zombies, always call `child.kill('SIGKILL')` if the process remains after the grace timer or if the parent is exiting due to an uncaught exception.
- Unresponsive child detection defers to `timeout-handling.md`; reuse the same `onTimeout` hook so the force-kill path is consistent whether triggered by timers or signals.

## Platform notes (macOS, Linux)
- Ctrl+C from a TTY sends SIGINT to the entire foreground process group on both macOS and Linux. Manual forwarding remains necessary for non-interactive contexts (pipelines, spawned runs).
- SIGWINCH fires only when attached to a TTY; do not rely on it in CI/non-TTY runs.
- Exit codes follow POSIX convention (128 + signal) when hyperyolo initiates termination; if the child exits first with its own code, prefer the child’s exit code.
- Windows is out of scope for v1; if added later, the signal matrix and forwarding rules need a dedicated review.

## Executor requirements
- Register signal handlers inside `src/core/executor.ts` at spawn time; handlers forward signals, start grace timers, and delegate final cleanup to the existing teardown path.
- Maintain shutdown state (`receivedSignal`, `graceTimer`, `forceKilled`) and make it available to the footer/session writer so aborted runs are labeled correctly.
- Ensure the session/store writer runs in `finally` blocks so it executes after signal-triggered exits, with atomic writes and lock discipline unchanged.
- Integrate with timeout logic: `onTimeout` and signal paths share the same force-kill flow and timer cleanup.
- Provide hooks (`onSignal`, `onForceKill`) for tests so Vitest fixtures can assert the order of events without relying on real signals.

## Testing guidance
- Unit tests that simulate SIGINT and SIGTERM via manual handler invocation: assert forwarding, grace timer scheduling, idempotent cleanup, and exit codes (130/143).
- Fixtures where the child ignores SIGTERM/SIGINT to confirm the grace timer escalates to SIGKILL.
- Tests that ensure session writes occur on signal-triggered exits and never corrupt `sessions.json` (e.g., concurrent write simulation with proper-lockfile).
- Resize handling tests under TTY simulation to confirm SIGWINCH updates layout and does not interfere with shutdown state.
