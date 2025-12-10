# execa Streaming and Tee Patterns

Research on how to stream subprocess output with [`execa`](https://github.com/sindresorhus/execa) while keeping HyperYOLO’s UI responsive and parsers reliable.

---

## Goals

- Deliver minimal-latency streaming to the terminal while feeding a sanitized copy to parsers (session ID, stats).
- Preserve chunk order across branches (stdout/stderr) without introducing buffering lag.
- Handle timeouts, signals, and shutdown cleanly so hung CLIs do not stall HyperYOLO.

## execa streaming notes (v9.x)

- Use `stdout: 'pipe'` / `stderr: 'pipe'` (default) to get `Readable` streams; avoid `stdio: 'inherit'` when parsing is needed.
- Set `buffer: false` for long streams to stop execa from accumulating output in memory (we already stream).
- `all: true` exposes a combined stream that preserves stdout/stderr ordering; keep individual streams when styling stderr separately.
- `reject: false` prevents throws on non-zero exit codes when callers want to inspect exit code manually.
- `forceKillAfterDelay` defaults to 5000ms; set to `false` when implementing your own SIGTERM→SIGKILL ladder (as in `executor.ts`).
- `cleanup: true` (default) tears down children on parent exit; keep it on so zombies do not linger if HyperYOLO crashes.
- `signal` accepts `AbortSignal` for cancellation; combine with timers for timeouts.

## Tee pattern for display + parsing

- Read chunks once and fan out immediately; do not buffer to full lines for display.
- Honor backpressure: if a destination returns `false`, pause the source and resume on `drain`.
- Keep parser input ANSI-free and CR-normalized (`\r` treated as a soft line break) so regex/JSON parsing is stable.
- Prefer piping to `process.stdout`/`process.stderr` for display so Node manages backpressure; use lightweight writes for the parser branch.

### Example: stream while parsing (stdout tee)

```typescript
import { execa } from 'execa';
import { PassThrough } from 'node:stream';
import stripAnsi from 'strip-ansi';

async function run(prompt: string) {
  const child = execa('codex', ['exec', prompt], {
    stdout: 'pipe',
    stderr: 'pipe',
    buffer: false,
    reject: false // let caller inspect exitCode
  });

  const tee = new PassThrough();
  child.stdout?.pipe(tee);

  const feedParser = (chunk: Buffer) => {
    const sanitized = stripAnsi(chunk.toString('utf8')).replace(/\r/g, '\n');
    handleParserChunk(sanitized);
  };

  const forward = (chunk: Buffer) => {
    if (!process.stdout.write(chunk)) {
      child.stdout?.pause();
      process.stdout.once('drain', () => child.stdout?.resume());
    }
  };

  tee.on('data', chunk => {
    forward(chunk);
    feedParser(chunk);
  });

  child.stderr?.on('data', chunk => {
    // Option 1: style separately
    process.stderr.write(chunk);
    feedParser(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  const result = await child;
  return result.exitCode ?? 0;
}
```

## Real-time output and line handling

- Expect chunk boundaries to split lines; parsers should buffer minimal context (e.g., incremental string builder) instead of assuming newline alignment.
- Handle `\r`, `\r\n`, and bare `\n`. Convert carriage returns to `\n` for the parser branch so progress-style rewrites still surface as distinct events.
- Avoid UTF-8 decoding per line for the display path; keep `Buffer` objects to minimize CPU and preserve ANSI bytes.

## Stderr strategies

- Keep separate when styling errors differently or when stdout is JSON and stderr is logs.
- Merge when ordering between stdout/stderr matters (use `all: true`), but note this removes styling differentiation. Parser must be resilient to mixed streams.
- If merging manually, prefix stderr with a marker before parsing so adapters can ignore cosmetic noise.

## Backpressure and ordering

- `Readable.pipe(Writable)` handles backpressure automatically; when teeing manually, always pause/resume the source when `write` returns `false`.
- Avoid attaching many `data` listeners; prefer one listener that fans out synchronously so chunk order is preserved before the next read.
- If a parser is slow, consider running parsing on microtasks (`queueMicrotask`) but keep the display write synchronous to avoid visible lag.

## Timeouts and cancellation

- Prefer `AbortController` + `signal` over ad-hoc `child.kill` only; combine with a SIGTERM→SIGKILL grace window.
- Keep absolute and idle timers separate so silent hangs are detected even if total runtime is long.
- Clear timers on process exit to avoid stray rejects.

### Example: timeout wrapper with AbortSignal

```typescript
import { execa } from 'execa';

async function runWithTimeout(cmd: string[], ms = 5 * 60_000) {
  const ac = new AbortController(); // available globally in Node 18+
  const timer = setTimeout(() => ac.abort(new Error('timeout')), ms);

  const child = execa(cmd[0]!, cmd.slice(1), {
    stdout: 'pipe',
    stderr: 'pipe',
    buffer: false,
    signal: ac.signal,
    forceKillAfterDelay: 5_000
  });

  try {
    return await child;
  } finally {
    clearTimeout(timer);
  }
}
```

## Signal forwarding and clean shutdown

- Forward `SIGINT`/`SIGTERM` to the child so the underlying CLI can tidy up its session; remove listeners once the child exits.
- Await stream completion (`stream.finished`) before resolving to ensure the last chunks flush after a signal.

### Example: signal forwarding and teardown

```typescript
import { finished } from 'node:stream/promises';

async function runWithSignals() {
  const child = execa('claude', ['-p', 'hello'], { stdout: 'pipe', stderr: 'pipe', buffer: false });

  const forward = (sig: NodeJS.Signals) => {
    if (child.exitCode === null) child.kill(sig);
  };
  process.on('SIGINT', forward);
  process.on('SIGTERM', forward);

  try {
    await child;
  } finally {
    process.off('SIGINT', forward);
    process.off('SIGTERM', forward);
    if (child.stdout) await finished(child.stdout);
    if (child.stderr) await finished(child.stderr);
  }
}
```

## Alternatives to execa

- `child_process.spawn`: lowest overhead, maximal control. Use when you need custom stdio wiring (e.g., Unix domain sockets, pseudo-TTY) or want zero buffering logic; loses execa conveniences (promises, cleanup, env merging).
- `node:child_process.spawn` + `foreground-child` (npm): helpful if you need robust signal forwarding in CLIs that daemonize.
- `zx` is ergonomically nice for scripting but hides streaming details; not recommended for HyperYOLO’s executor.

## Gotchas and edge cases

- Large output: with `buffer: true` (default), execa collects data into memory; disable buffering for long streams to avoid OOM.
- Encoding: Node streams are `Buffer` by default. Avoid `setEncoding` on stdout/stderr to keep binary/tool output intact; decode only in parser branch.
- `stripFinalNewline` (default `true`) only affects collected `stdout`; irrelevant when `buffer: false`.
- Multiple pipes: `stdout.pipe(a); stdout.pipe(b);` is safe, but each destination’s backpressure can pause the source; keep destinations lightweight.
- Exit codes: execa throws on non-zero exit unless `reject: false`; callers must handle `result.exitCode`.
- Windows: `SIGTERM` is emulated; expect less graceful shutdown. Prefer timeouts + `child.kill('SIGKILL')` fallback on Unix.

## Recommended approach for HyperYOLO

- Keep `stdout`/`stderr` piped with `buffer: false`, `reject: false`, and `forceKillAfterDelay: false` (handled in `executor.ts`).
- Use a single tee handler per stream: write raw chunks to the display branch (respecting backpressure), and feed a sanitized copy (ANSI stripped, `\r` normalized) to adapter parsers.
- Merge stderr into the parser stream when adapters need to catch session IDs/stats from either channel; keep terminal styling separated so errors remain visible.
- Use `AbortController`-driven timeouts layered on top of absolute/idle timers already in `executor.ts`.
- Forward `SIGINT`/`SIGTERM` to children, then await `finished` on streams before resolving to guarantee tail output is not lost.
