# Gemini CLI Verification (v0.19.3)

## Version & Environment
- Version tested: 0.19.3
- Environment: macOS, Homebrew install at `/opt/homebrew/Cellar/gemini-cli/0.19.3`, headless tests run from `/Users/jordan/hyperyolo`.
- Auth in normal runs: cached OAuth (“Loaded cached credentials.”). API-key failure tested separately with a temp HOME.

## Installation & Authentication
- Install: `npx https://github.com/google-gemini/gemini-cli` (no install), or `npm install -g @google/gemini-cli`, or `brew install gemini-cli` (Node 20+ required).
- Authenticate: `gemini login` (browser OAuth), or headless `gemini login --api-key` after setting `GEMINI_API_KEY`.
- Verify: `gemini --version` then `gemini -y "ping" -o json` (expect JSON with response/stats; `-y` enables tools in headless mode).
- Not-found message: `Gemini CLI not found. Install it with: npm install -g @google/gemini-cli (or brew install gemini-cli / npx https://github.com/google-gemini/gemini-cli). Then authenticate with: gemini login --api-key <GEMINI_API_KEY> (or browser login). More info: https://geminicli.com/docs`

## Commands & Flags
- Core flags: `-p/--prompt` (deprecated in help; use positional), `--prompt-interactive`, `-y/--yolo`, `--approval-mode (default|auto_edit|yolo)`, `-o/--output-format (text|json|stream-json)`, `-r/--resume [id|index|latest]`, `--list-sessions`, `--delete-session`, `--sandbox`, `--allowed-tools`, `--allowed-mcp-server-names`.
- Subcommands: `mcp add/remove/list`; `extensions install|uninstall|list|update|disable|enable|link|new|validate`.
- Version command: `gemini --version` → `0.19.3`.

## Session Management
- Session ID generation: `randomUUID()` in `@google/gemini-cli-core/dist/src/utils/session.js`; regex `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`.
- Storage root: `Storage.getProjectTempDir()` = `~/.gemini/tmp/<sha256(project_root)>/`; chats under `chats/`.
- File naming: `session-<ISO minute>-<sessionIdPrefix>.json` (e.g., `session-2025-12-09T21-40-36f1bf32.json`); file also stores `sessionId`.
- File schema highlights: top-level `sessionId`, `projectHash`, `startTime`, `lastUpdated`, `messages[]`; messages hold `id`, `timestamp`, `type` (`user`|`gemini`), `content`, optional `thoughts[] {subject, description, timestamp}`, `tokens {input, output, cached, thoughts, tool, total}`, `model`; `toolCalls[]` attached to `gemini` messages with `{id,name,args,result[],status,resultDisplay,displayName,description,renderOutputAsMarkdown}` and captured `functionResponse`.
- `gemini --list-sessions` (non-interactive) prints numbered history sorted oldest→newest for the current project hash.
- Resume: `--resume <index|uuid>` reuses the existing `sessionId` and appends to the same chat file; `--resume` with no value → latest. Invalid resume (`--resume invalid-id`) exits 1 and logs guidance.

## Output Formats & Schemas
- Text (default): no session ID surfaced; example: `Okay, I'm ready. Please provide your first command.` when run with `-p` and YOLO.
- JSON (`--output-format json`): `{"response": "...", "stats": {...}}` with per-model token/API counters and tool/file stats. Errors use `{"error": {"type": "...", "message": "...", "code": <number>}}`.
- Stream JSON (`--output-format stream-json`): newline-delimited events (`init`, `message`, `tool_use`, `tool_result`, `error`, `result`). `init` carries the session ID. Full schema: `docs/research/cli-verification/schemas/gemini-stream-json.schema.json`.
- Stream JSON `init` model/session id appear even when headless; assistant chunks stream with `delta:true`.
- YOLO does **not** auto-enable sandboxing; pass `--sandbox` (macOS uses `sandbox-exec` before Docker/Podman).

## YOLO / Permission Behavior
- Headless without YOLO strips shell/edit/write tools; requesting `pwd` yields `tool_not_registered` errors.
- `--approval-mode yolo` (or `-y`) re-enables tools and auto-approves actions.
- `--approval-mode auto_edit` keeps shell excluded but allows edit/write; not exercised in tests but enforced in `config.loadCliConfig`.
- Sandbox is opt-in (`--sandbox` or `GEMINI_SANDBOX=true`); destructive tools run on host unless enabled.

## Regex Patterns
- Stream `init` session ID: `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`.
- Session file name: `session-[0-9T:-]+-[0-9a-f]{8}\\.json` (ID also present as `sessionId` field).

## Known Issues & Edge Cases
- Invalid API key returns a 400 with `[object Object]` JSON error body, writes reports to `/var/folders/.../T/gemini-client-error-*.json`, and exited with code 144 in tests.
- Stream-JSON/tool exclusion error surfaces as `tool_not_registered` rather than a clear “tool disabled in non-interactive default mode”.
- `--prompt` is marked deprecated but `-p` still works; warning text only emitted when `--prompt` (long flag) is present in argv.
- YOLO does not imply sandbox; destructive tools run on host unless sandbox is explicitly enabled.
- Piped stdin: `echo "piped test" | gemini --output-format stream-json --approval-mode yolo` treated stdin as the prompt and auto-ran tools.

## Commands Exercised
- Help/metadata: `gemini --help`, `gemini mcp --help`, `gemini extensions --help`, `gemini --version`.
- Output/streaming: `gemini -p "Respond with OK only." --output-format stream-json --approval-mode yolo`; `gemini -p "Return 'json mode test' only." --output-format json --approval-mode yolo`.
- Tooling checks: `gemini -p "Run 'pwd' in bash..." --output-format stream-json --approval-mode yolo`; same command without YOLO (tool excluded); `--sandbox` smoke test.
- Resume: `gemini --list-sessions`; `gemini -p "Resume check message." --resume 1 --output-format stream-json --approval-mode yolo`; invalid resume with `--resume invalid-id`.
- Piped stdin: `echo "piped test" | gemini --output-format stream-json --approval-mode yolo`.
- Auth error: `HOME=$(mktemp -d) GEMINI_API_KEY=invalid gemini -p "invalid key test" --output-format json --approval-mode yolo`.
