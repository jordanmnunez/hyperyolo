# Session ID Extraction Strategy

Design for reliably capturing native session IDs from Codex, Claude Code, and Gemini CLI streams without delaying user-visible output.

## Goals and constraints
- Parse session IDs early enough to show them in the header/footer while never blocking the display stream (tee rules in `ansi-handling.md` still apply).
- Work with mixed stdout/stderr streams, carriage-return rewrites, and chunked JSON lines.
- Keep memory bounded: ring-buffer text for regex searches; per-backend JSON decoders hold only the current partial line.
- Treat resume correctness as critical: detect when a CLI silently starts a new session (Codex resume mismatch) and surface that warning immediately.

## Buffering and timing
- **Display immediately**: chunks go straight to the UI; parsing happens in parallel on the sanitized branch.
- **Ring buffer**: keep the last 16 KB of stripped text for regex-based detectors (Codex text mode). This is enough to span chunk boundaries without accumulating the full transcript.
- **Line buffer for JSON CLIs**: append sanitized text, split on `\n`, parse full lines, and keep the trailing partial line for the next chunk.
- **Deadlines**:
  - Mark status `pending` until a parser returns an ID.
  - On process exit, call `flush()` once to process any buffered partial line.
  - If still missing, mark `unavailable`, warn the user that resume is disabled, and **do not** write a session record.
  - If the user requested `--resume` and the parsed ID does not match the expected native ID, treat the resume as rejected: mark the stored record `invalid`, emit a warning, and skip updating `lastSeenAt`.

## Adapter interface contract
Parsers are stateful per backend and consume already-sanitized text (ANSI stripped, `\r` normalized to `\n`).

```ts
export interface SessionIdParseResult {
  id: string;
  source: 'stdout' | 'stderr';
  format: 'json' | 'text';
}

export interface SessionIdParser {
  /** Feed the next chunk; return a result only when the ID is first discovered. */
  feed(chunk: string, source: 'stdout' | 'stderr'): SessionIdParseResult | null;
  /** Process any buffered partial line at stream end; same return semantics as feed. */
  flush(): SessionIdParseResult | null;
}
```

- The executor owns lifecycle: create parser per run (from backend), call `feed` for every chunk on the parser branch, call `flush` after exit, and stop calling once a result is returned.
- Parsers must be idempotent after success (always return the first-found ID).
- Type definitions and regex constants live in `src/core/session-id.ts`; keep this doc and that file in sync.
- The caller records `{ backend, nativeId, foundAt: Date, source }` and updates the session store only when `nativeId` is present.

## Per-CLI extraction rules
- **Codex**
  - Preferred format: JSON events via `--json`; look for `{"type":"thread.started","thread_id":"<uuid>"}`.
  - Text fallback: regex across the ring buffer: `/session id:\\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i`.
  - Resume guard: if the run was started with a specific native ID and the parsed ID differs (Codex starts a new session on invalid resumes), surface a warning and mark the original record `invalid`.
- **Claude Code**
  - Use stream JSON (`--output-format stream-json --verbose`) and parse each newline JSON object for a `session_id` string. The init `system` event emits it first, but continue scanning until found in case the stream starts mid-run.
  - Regex fallback for partial fragments (within the 16 KB ring): `/\"session_id\"\\s*:\\s*\"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\"/i`.
  - Ignore text-only output for ID discovery; if the user opts into text mode, emit the “resume disabled” warning unless JSON events are seen.
- **Gemini**
  - Use `--output-format stream-json`; parse newline JSON events and pick the first `init` event’s `session_id`.
  - Regex fallback: `/\"type\"\\s*:\\s*\"init\"[^\\n\\r]*\"session_id\"\\s*:\\s*\"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\"/i` against the ring buffer.
  - If running in text/json (non-stream) modes, no session ID is exposed; warn and skip persistence.

## Fallback behavior
- **Missing ID**: Run continues, footer shows “native session ID unavailable; resume disabled,” and nothing is written to `sessions.json`.
- **Format mismatch**: If CLI output is malformed JSON, parsers should swallow JSON parse errors, keep the partial line, and fall back to the regex search in the ring buffer.
- **Multiple candidates**: Take the first ID encountered; ignore subsequent matches unless the run was a resume with an expected ID, in which case mismatches trigger the resume guard above.
- **Source tracking**: Record whether the ID was observed on stdout or stderr to aid debugging and tests.

## Testing checklist
- Fixtures for each backend covering: JSON happy path, split JSON across chunks, carriage-return rewrites, stderr-only IDs, and Codex invalid-resume yielding a new ID.
- Assert bounded buffers (16 KB ring, single-line JSON buffer) and idempotent parser behavior after success.
- Simulate missing-ID cases (text-only Claude/Gemini, Codex with truncated banner) and verify warnings + absence from the session store.
