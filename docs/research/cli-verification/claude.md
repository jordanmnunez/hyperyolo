# Claude Code CLI Verification (v2.0.62)

## Version & Environment
- Version tested: 2.0.62 (Claude Code)
- Environment: macOS, Node 18, global install at `/Users/jordan/.nvm/versions/node/v18.20.8/lib/node_modules/@anthropic-ai/claude-code/cli.js`; tests run in `/Users/jordan/hyperyolo` plus `/tmp/claude-perm-test` for permission checks.
- Config root defaults to `~/.claude` (overridable via `CLAUDE_CONFIG_DIR`).
- Focus areas: help surface, output formats, session storage/resume, permission skipping, non-TTY handling, and error cases (invalid API key, missing permissions).

## Installation & Authentication
- Install: `npm install -g @anthropic-ai/claude-code` (or `npx @anthropic-ai/claude-code@latest --version` for one-off checks).
- Authenticate: set `ANTHROPIC_API_KEY` (env) or run `claude setup-token` to save it to `~/.claude`.
- Verify: `claude --version` then `claude -p "ping" --output-format json --verbose` should return JSON containing `session_id`.
- Not-found message: `Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code. Then authenticate with: ANTHROPIC_API_KEY=<your key> claude setup-token. More info: https://docs.anthropic.com/claude/docs/claude-code-cli`

## Commands & Flags
- `claude --help` shows interactive by default; `-p/--print` for headless. Subcommands: `mcp`, `plugin`, `setup-token`, `doctor`, `update`, `install`.
- Core flags: `--output-format (text|json|stream-json)`, `--include-partial-messages` (stream only), `--input-format (text|stream-json)`, `--dangerously-skip-permissions` / `--allow-dangerously-skip-permissions`, `--permission-mode (acceptEdits|bypassPermissions|default|dontAsk|plan)`, `-c/--continue`, `-r/--resume [uuid|search]`, `--fork-session`, `--model`, `--agent`, `--session-id <uuid>`, `--mcp-config`, `--tools/--allowed-tools/--disallowed-tools`, `--plugin-dir`, `--disable-slash-commands`.
- Subcommand help snapshots: `claude plugin --help` (install/validate/uninstall/enable/disable/marketplace), `claude mcp --help` (serve/add/remove/list/get/add-json/import/reset-project-choices), `claude setup-token|doctor|update|install --help` are all single-flag surfaces.
- Version command: `claude --version` → `2.0.62 (Claude Code)`.

## Session Management
- Session IDs are UUIDv4; regex: `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`. Session file path pattern: `<config>/projects/<slug>/<sessionId>.jsonl` (slug = absolute path with `/` replaced by `-`).
- Storage: per-project JSONL at `~/.claude/projects/<slug>/<sessionId>.jsonl`; debug logs at `~/.claude/debug/<sessionId>.txt`; high-level entries in `~/.claude/history.jsonl`; empty `session-env/<sessionId>/` directories are created alongside.
- Resume: `--resume <uuid>` reuses the same `session_id`; invalid IDs exit 1 with `No conversation found with session ID: ...`. `--continue` resumes the latest session.
- Session fields observed: session file rows include `type` (`user`|`assistant`), `message{...}`, `timestamp`, `parentUuid`, `cwd`, `version`, optional `slug`.

## Output Formats & Schemas
- Text: `-p --output-format text` prints only the assistant message (no session ID surfaced).
- JSON: single result object, e.g. `{"type":"result","subtype":"success","is_error":false,"result":"hello","session_id":"...","usage":{...}}`; errors share the same shape with `is_error:true`.
- Stream JSON (`-p --output-format stream-json --verbose`): newline-delimited events (`system`, `assistant`, `user`, `result`, `error`). Each event carries `session_id` (UUID) and `uuid` (event id); `system` exposes `permissionMode`, tool list, version, cwd. Schema: `docs/research/cli-verification/schemas/claude-stream-json.schema.json`.
- `--output-format stream-json` **requires** `--verbose` or the CLI exits 1 with: `When using --print, --output-format=stream-json requires --verbose`.
- Non-TTY: `echo "hi" | claude --print --output-format json` worked; stdin becomes the prompt and JSON response still carries `session_id`.

## YOLO / Permission Behavior
- Headless `--print` denies file writes by default (tool results error). `--dangerously-skip-permissions` flips `permissionMode` to `bypassPermissions` and auto-runs Write/Bash without prompts.
- Default runs surface `permission_denials` and tool errors when access is blocked; YOLO mode clears these and runs tools automatically.

## Regex Patterns
- Session ID: `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}` for both parsed IDs and session filenames.
- Session file path template: `~/.claude/projects/<slug>/<sessionId>.jsonl`.

## Known Issues & Edge Cases
- Stream-only error path: omitting `--verbose` with `--output-format=stream-json` exits 1 with the message above.
- Invalid API key: `ANTHROPIC_API_KEY=invalid claude -p "test invalid api" --output-format json` exited 1 with `{"is_error":true,"result":"Invalid API key · Fix external API key","session_id":"...","modelUsage":{}}`.
- MCP noise: init events can list `mcp-agent-mail` with status `failed` (missing config) but runs continue normally.
- Color env vars: outputs observed in text/JSON were uncolored; `NO_COLOR`/`FORCE_COLOR` had no visible impact in `--print` runs.

## Commands Exercised
- Metadata: `claude --help`, `claude plugin --help`, `claude mcp --help`, `claude setup-token --help`, `claude doctor --help`, `claude update --help`, `claude install --help`, `claude --version`.
- Outputs: `claude -p "Say 'hello'" --output-format json`; `claude -p "Say 'hi'" --output-format stream-json --verbose`; `claude -p "Hello" --output-format text --verbose`.
- Session/resume: `claude -p "What is 2+2?" --output-format json --resume <uuid>`; `claude -p "What is our session id?" --output-format json --continue`; invalid resume example above.
- Permissions: `claude -p "Run 'pwd' using bash and report the result" --output-format stream-json --verbose` (default perms, Bash auto-ran); `claude -p "Create a file named note.txt..." --output-format stream-json --verbose` (permission denied); same command with `--dangerously-skip-permissions` (Write/Bash succeeded).
- Non-TTY: `echo "hi" | claude --print --output-format json`.
- Auth error: `ANTHROPIC_API_KEY=invalid claude -p "test invalid api" --output-format json`.
