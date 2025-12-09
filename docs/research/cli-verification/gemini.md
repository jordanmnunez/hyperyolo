# Gemini CLI Verification (v0.19.3)

- Environment: macOS, Homebrew install at `/opt/homebrew/Cellar/gemini-cli/0.19.3`, headless tests run from `/Users/jordan/hyperyolo`.
- Auth in normal runs: cached OAuth (“Loaded cached credentials.”). API-key failure tested separately with a temp HOME.
- Primary focus: headless `-p`/positional prompts, session storage/resume, stream JSON schema, tool authorization (YOLO vs default), sandbox behavior, and edge cases (piped stdin, color flags, invalid API key).

## Quick Outcomes
- Session files live at `~/.gemini/tmp/<sha256(project_root)>/chats/session-YYYY-MM-DDTHH-MM-XXXXXXXX.json` with the same UUID stored inside (`sessionId`).
- Stream JSON now documented in `docs/research/cli-verification/gemini-stream-json.schema.json`; `init` event carries the session ID, not the JSON/text outputs.
- Headless without YOLO strips shell/edit/write tools; requesting `pwd` yields “Tool not found” errors. `--approval-mode yolo` (or `-y`) re-enables tools and auto-approves actions.
- YOLO does **not** auto-enable sandboxing; pass `--sandbox` (macOS uses `sandbox-exec` before Docker/Podman).
- `--resume` accepts UUID, index, or empty (`--resume` → latest). Invalid IDs exit 1 with a clear message.
- Invalid API key returns a 400 with “[object Object]” JSON error body and writes reports to `/var/folders/.../T/gemini-client-error-*.json`; exit code observed as 144.

## CLI Surface (help/flags)
- Core flags: `-p/--prompt` (deprecated in help; use positional), `--prompt-interactive`, `-y/--yolo`, `--approval-mode (default|auto_edit|yolo)`, `-o/--output-format (text|json|stream-json)`, `-r/--resume [id|index|latest]`, `--list-sessions`, `--delete-session`, `--sandbox`, `--allowed-tools`, `--allowed-mcp-server-names`.
- Subcommands: `mcp add/remove/list`; `extensions install|uninstall|list|update|disable|enable|link|new|validate`.
- Version: `gemini --version` → `0.19.3`.

## Session Storage & ID Patterns
- Session ID generation: `randomUUID()` in `@google/gemini-cli-core/dist/src/utils/session.js`.
- Storage root: `Storage.getProjectTempDir()` = `~/.gemini/tmp/<sha256(project_root)>/`; chats under `chats/`.
- File naming: `session-<ISO minute>-<sessionIdPrefix>.json` (e.g., `session-2025-12-09T21-40-36f1bf32.json`).
- File schema highlights (from test runs):
  - Top-level: `sessionId`, `projectHash`, `startTime`, `lastUpdated`, `messages[]`.
  - Message: `id`, `timestamp`, `type` (`user`|`gemini`), `content`, optional `thoughts[] {subject, description, timestamp}`, `tokens {input, output, cached, thoughts, tool, total}`, `model`.
  - Tool calls: `toolCalls[]` on `gemini` messages with `{id,name,args,result[],status,resultDisplay,displayName,description,renderOutputAsMarkdown}` and captured `functionResponse`.
- Regex references:
  - Stream `init` event session ID: `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`.
  - Session file name: `session-[0-9T:-]+-[0-9a-f]{8}\\.json` (ID also present as `sessionId` field).

## Output Formats
- Text (default): no session ID surfaced; example: `Okay, I'm ready. Please provide your first command.` when run with `-p` and YOLO.
- JSON (`--output-format json`): `{"response": "...", "stats": {...}}` with per-model token/API counters and tool/file stats. Errors use `{"error": {"type": "...", "message": "...", "code": <number>}}`.
- Stream JSON (`--output-format stream-json`): newline-delimited events; types = `init`, `message`, `tool_use`, `tool_result`, `error`, `result`. Full schema captured in `docs/research/cli-verification/gemini-stream-json.schema.json`.
  - `init`: `{type:"init", timestamp, session_id, model}`.
  - `message`: `{type:"message", timestamp, role:"user"|"assistant", content, delta?}` (assistant chunks stream with `delta:true`).
  - `tool_use`: `{type:"tool_use", timestamp, tool_name, tool_id, parameters{...}}`.
  - `tool_result`: `{type:"tool_result", timestamp, tool_id, status:"success"|"error", output?, error?{type,message}}`.
  - `error`: emitted for loop/turn issues `{severity:"warning"|"error", message}`.
  - `result`: `{type:"result", timestamp, status:"success"|"error", stats?, error?}`; stats collapsed to `{total_tokens,input_tokens,output_tokens,duration_ms,tool_calls}`.

## Resume / Sessions UX
- `gemini --list-sessions` (non-interactive) prints numbered history sorted oldest→newest for the current project hash.
- `--resume <index|uuid>` reuses the existing `sessionId` and appends to the same chat file; observed init event `session_id` stays constant.
- `--resume` with no value → latest (via `coerce` to `RESUME_LATEST`).
- Invalid resume (`--resume invalid-id`) exits 1 and logs: `Error resuming session: Invalid session identifier "...". Use --list-sessions...`.
- `--delete-session` blocks deleting the active session; expects index or UUID (see `sessionUtils`/`sessions` helpers).

## Tool Authorization in Headless (-p)
- Default (no `--approval-mode`/`--yolo`): shell/edit/write tools are excluded in non-interactive mode. Asking for `pwd` yields a `tool_not_registered` error in stream JSON with `status:"error"` on `tool_result`.
- `--approval-mode yolo` (or `-y`): no exclusions; shell tool is available and auto-approved. Example run executed `run_shell_command` → `tool_result` with `status:"success"` and output `/Users/jordan/hyperyolo` without prompts.
- `--approval-mode auto_edit`: only shell is excluded (edit/write allowed); not exercised in tests but enforced in `config.loadCliConfig`.
- `--allowed-tools` can whitelist tools to bypass the default exclusion lists when not in YOLO.
- Warning: `--yolo` does not flip on sandboxing; tool calls run on the host unless `--sandbox`/`GEMINI_SANDBOX` is set.

## Sandbox Notes
- `--sandbox` resolves to `sandbox-exec` on macOS when available; otherwise Docker/Podman only if explicitly requested (`--sandbox` or `GEMINI_SANDBOX=true`).
- With `--sandbox` + YOLO in headless mode, responses completed normally; no visible change in stream events beyond standard output.

## Edge Cases & Failure Modes
- **No TTY / piped stdin**: `echo "piped test" | gemini --output-format stream-json --approval-mode yolo` treated stdin as the prompt and auto-ran tools (`run_shell_command ls -F`) without user approval, then proposed a plan. Input content preserved with trailing newlines in the `message` event.
- **Color env vars**: entrypoint only colorizes FatalError text when `NO_COLOR` is unset; setting `NO_COLOR=1` suppresses the red ANSI wrapper. Stream/JSON outputs stay uncolored regardless; `FORCE_COLOR` not specially handled beyond chalk defaults.
- **Timeouts/hangs**: Non-interactive loop uses `AbortController` for Ctrl+C; no explicit runtime timeout. Long turns can linger (e.g., piped run took ~33s while planning).
- **Invalid API key**: Running with `HOME` pointed to a temp dir and `GEMINI_API_KEY=invalid` produced a 400 (`API key not valid...`), wrote error reports to `/var/folders/.../T/gemini-client-error-*.json`, surfaced JSON `{"error":{"type":"Error","message":"[object Object]","code":400}}`, and exited with code 144.

## Commands Exercised
- Help/metadata: `gemini --help`, `gemini mcp --help`, `gemini extensions --help`, `gemini --version`.
- Output/streaming: `gemini -p "Respond with OK only." --output-format stream-json --approval-mode yolo`; `gemini -p "Return 'json mode test' only." --output-format json --approval-mode yolo`.
- Tooling checks: `gemini -p "Run 'pwd' in bash..." --output-format stream-json --approval-mode yolo`; same command without YOLO (tool excluded); `--sandbox` smoke test.
- Resume: `gemini --list-sessions`; `gemini -p "Resume check message." --resume 1 --output-format stream-json --approval-mode yolo`; invalid resume with `--resume invalid-id`.
- Piped stdin: `echo "piped test" | gemini --output-format stream-json --approval-mode yolo`.
- Auth error: `HOME=$(mktemp -d) GEMINI_API_KEY=invalid gemini -p "invalid key test" --output-format json --approval-mode yolo`.

## Known Limitations/Bugs Observed
- Stream-JSON/tool exclusion error surfaces as `tool_not_registered` rather than a clear “tool disabled in non-interactive default mode”.
- `--prompt` is marked deprecated but `-p` still works; warning text only emitted when `--prompt` (long flag) is present in argv.
- Invalid API key path returns `[object Object]` in JSON output and writes temp error files; exit code 144 is opaque.
- YOLO does not imply sandbox; destructive tools run on host unless sandbox is explicitly enabled.
