# Output Format Selection

Guidance for choosing and parsing Codex, Claude Code, and Gemini outputs while preserving resume/stats fidelity and degrading safely when a format is unavailable.

## Goals
- Prefer structured streaming so session IDs and stats are captured without blocking display.
- Avoid re-running user prompts; detect unsupported formats early and downgrade once with a warning.
- Keep parsers tolerant of mixed/ANSI output while preserving the raw stream for the UI.

## Recommended defaults and trade-offs
| Backend | Default when `outputFormat` is unset | Fallback order | Session ID surface | Stats surface | Notes |
| --- | --- | --- | --- | --- | --- |
| Codex | `json` (line-delimited events) | `text` | `thread.started.thread_id` (json) or `session id: <uuid>` (text) | `turn.completed.usage` (json) or `tokens used <n>` (text) | `--json` is uncolored and safest for parsing; text keeps a banner and ANSI. |
| Claude | `stream-json` with `--verbose -p` | `json` → `text` | `session_id` on every event (stream/json); none in text | `result` event (stream) or `usage/modelUsage` (json); none in text | Stream requires `--verbose` or the CLI exits 1; text hides session IDs entirely. |
| Gemini | `stream-json` | `json` → `text` | `init.session_id` (stream only) | `result.stats` (stream) or `stats` (json); none in text | JSON/text omit session IDs, so resume mapping is disabled when falling back. |

## Selection algorithm (auto)
1. Resolve intent: `target = options.outputFormat ?? defaultForBackend[backend]`. Undefined means “auto.” Respect explicit user requests even if they are worse for parsing.
2. Preflight support: use `isAvailable().versionStatus` to skip formats known to be unsupported. If the version is unknown, attempt the target once; treat “unknown flag/invalid value” stderr (exit 2) as a safe pre-exec failure and downgrade.
3. Build commands with required quirks:
   - Codex: append `--json` when target is `json`; otherwise allow default text. Keep `--skip-git-repo-check`/sandbox flags independent of format.
   - Claude: always pair `--output-format stream-json` with `--verbose -p`; if the target is `json`, emit `--output-format json -p`; text keeps `-p`.
   - Gemini: set `-o stream-json` or `-o json`; text omits `-o`. Headless runs still pass `-p`/positional prompt and `-y/--approval-mode yolo` so tool calls are authorized regardless of format.
4. Runtime confirmation: the parser inspects the first few sanitized lines to lock onto a mode (`{"type":"thread.started"` → Codex JSON, `{"type":"system","subtype":"init"` → Claude stream, `{"type":"init","session_id"` → Gemini stream). If no structured marker appears before the first user chunk, fall back to text parsing heuristics.
5. Fallback execution: only rerun the CLI when it fails before creating a session (flag rejection, format validation). Downgrade one step per the table above and surface a warning that stats/resume fidelity may be reduced. Never auto-rerun after a session ID has been observed to avoid repeating side effects.

## Format detection and mixed output
- Parser input is already ANSI-stripped/CR-normalized (see `ansi-handling.md`); display keeps raw color. JSON modes are uncolored by the CLIs, but text may carry gradients/cursor rewrites.
- Treat stream formats as JSONL: parse line by line, ignoring blank lines. If a line is not JSON, keep it for logs but do not crash; emit an `output-parsing` warning instead.
- Single-shot JSON (`--output-format json`) is parsed from the final accumulated buffer. If parsing fails, attempt to salvage a session ID via regex before downgrading diagnostics to “stats unavailable.”
- Text mode parsing uses regexes only; do not attempt opportunistic JSON parsing once the mode is locked to text.

## CLI-specific parsing requirements

### Codex
- **Session ID**
  - JSON: first `thread.started.thread_id` (or `session_meta.payload.id` in session files); validate against UUID regex.
  - Text: `session id: ([0-9a-f-]{36})` line.
- **Stats**
  - JSON: `turn.completed.usage` carries token counts; no cost fields observed.
  - Text: `tokens used <number>` near the footer; no duration.
- **Errors/completion**
  - Completion: presence of `turn.completed` event; otherwise rely on process exit.
  - Errors: non-zero exit or `{"type":"event_msg","payload":{"type":"turn_aborted"}}` in JSON; in text, look for the git guard line to surface a clear message.

### Claude Code
- **Session ID**
  - Stream: any event `session_id` (system init arrives first); stash the first valid UUID.
  - JSON: `session_id` top-level.
  - Text: none — keep session persistence disabled.
- **Stats**
  - Stream: final `result` event (`usage`, `modelUsage`, `duration_ms`).
  - JSON: `usage`/`modelUsage` fields.
  - Text: none.
- **Errors/completion**
  - Completion: `result.subtype === "success"`; `is_error: true` indicates failure.
  - Common failure: missing `--verbose` with stream-json; if stderr matches that string, downgrade to JSON automatically.

### Gemini
- **Session ID**
  - Stream: `init.session_id` UUID; store the first occurrence.
  - JSON/text: none — session store writes are skipped, and resume is marked unavailable.
- **Stats**
  - Stream: `result.stats` (tokens, duration, tool_calls).
  - JSON: `stats` object; ignore tool detail fields that are absent.
  - Text: none.
- **Errors/completion**
  - Completion: `result` event; `status:"error"` or an `error` event should mark the run failed.
  - API-key errors surface as `error` events or top-level `error` objects in JSON; treat exit code 144 as an auth error even if the JSON is malformed.

## Adapter interface impact
- `ExecutionOptions.outputFormat` already covers `stream-json | json | text`; leaving it undefined enables the auto defaults above. No interface change is required; adapter docs should note that `undefined` means “pick the recommended format and downgrade if rejected.”
