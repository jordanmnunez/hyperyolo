# Claude Code CLI Verification (v2.0.62)

- Environment: macOS, Node 18, global install at `/Users/jordan/.nvm/versions/node/v18.20.8/lib/node_modules/@anthropic-ai/claude-code/cli.js`; tests run in `/Users/jordan/hyperyolo` plus `/tmp/claude-perm-test` for permission checks.
- Config root defaults to `~/.claude`; can be overridden with `CLAUDE_CONFIG_DIR`.
- Focus: help surface, output formats, session storage/resume, permission skipping, non-TTY handling, and error cases (invalid API key, missing permissions).

## Quick Outcomes
- `--output-format stream-json` **requires** `--verbose` or it exits 1 with: `When using --print, --output-format=stream-json requires --verbose`.
- Stream events (types: `system`, `assistant`, `user`, `result`) are captured in `docs/research/cli-verification/claude-stream-json.schema.json`. Each event carries `session_id` (UUID) and `uuid` (event id); `system` exposes `permissionMode`, tool list, version, cwd.
- Session storage: per-project JSONL at `~/.claude/projects/<slug>/<sessionId>.jsonl` (slug = absolute path with `/` replaced by `-`), debug logs at `~/.claude/debug/<sessionId>.txt`, and high-level entries in `~/.claude/history.jsonl`.
- Session IDs are UUIDv4; regex: `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`. Session file path pattern: `<config>/projects/<slug>/<sessionId>.jsonl`.
- Permissions: headless `--print` denies file writes by default (tool results error). `--dangerously-skip-permissions` flips `permissionMode` to `bypassPermissions` and auto-runs Write/Bash without prompts.
- Resume UX: `--resume <uuid>` reuses the same `session_id`; invalid IDs exit 1 with `No conversation found with session ID: ...`. `--continue` resumes the latest session.

## Install / Auth / Verify
- Install: `npm install -g @anthropic-ai/claude-code` (or `npx @anthropic-ai/claude-code@latest --version` for one-off checks).
- Authenticate: set `ANTHROPIC_API_KEY` (env) or run `claude setup-token` to save it to `~/.claude`.
- Verify: `claude --version` then `claude -p "ping" --output-format json --verbose` should return JSON containing `session_id`.
- Not-found message copy: `Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code. Then authenticate with: ANTHROPIC_API_KEY=<your key> claude setup-token. More info: https://docs.anthropic.com/claude/docs/claude-code-cli`

## CLI Surface (help/flags)
- `claude --help` shows interactive by default; `-p/--print` for headless. Subcommands: `mcp`, `plugin`, `setup-token`, `doctor`, `update`, `install`. Version: `claude --version` → `2.0.62 (Claude Code)`.
- Core flags: `--output-format (text|json|stream-json)`, `--include-partial-messages` (stream only), `--input-format (text|stream-json)`, `--dangerously-skip-permissions` / `--allow-dangerously-skip-permissions`, `--permission-mode (acceptEdits|bypassPermissions|default|dontAsk|plan)`, `-c/--continue`, `-r/--resume [uuid|search]`, `--fork-session`, `--model`, `--agent`, `--session-id <uuid>`, `--mcp-config`, `--tools/--allowed-tools/--disallowed-tools`, `--plugin-dir`, `--disable-slash-commands`.
- Subcommand help snapshots: `claude plugin --help` (install/validate/uninstall/enable/disable/marketplace), `claude mcp --help` (serve/add/remove/list/get/add-json/import/reset-project-choices), `claude setup-token|doctor|update|install --help` are all single-flag surfaces.

## Output Formats
- Text: `-p --output-format text` prints only the assistant message (no session ID surfaced).
- JSON: single result object, e.g. `{"type":"result","subtype":"success","is_error":false,"result":"hello","session_id":"43cf4ead-6bce-446f-a199-8791ea92aa2f","usage":{...},"modelUsage":{...},"uuid":"90d6c7fb-cf3c-4949-a2ba-ba6a36f3890b"}`. Errors retain the same shape with `is_error:true` (invalid API key example below).
- Stream JSON (`-p --output-format stream-json --verbose`): newline-delimited events:
  - `system` init: `{type:"system",subtype:"init",session_id,uuid,cwd,model,permissionMode,tools[],mcp_servers[],claude_code_version,...}`.
  - `assistant`: `{type:"assistant",session_id,uuid,message:{role:"assistant",content:[{type:"text",text}|{type:"tool_use",name,id,input}],usage}}`.
  - `user` tool results: `{type:"user",session_id,uuid,message:{role:"user",content:[{type:"tool_result",tool_use_id,content,is_error?}]},tool_use_result:{stdout|stderr|...}}`.
  - `result`: `{type:"result",subtype:"success"|"error",is_error,session_id,uuid,result,duration_ms,duration_api_ms,num_turns,usage,modelUsage,permission_denials[]}`.
- Stream schema recorded in `docs/research/cli-verification/claude-stream-json.schema.json`.
- Stream-only error path: omitting `--verbose` with `--output-format=stream-json` exits 1 with the message above.

## Session Storage & ID Patterns
- Config root: `~/.claude` (or `CLAUDE_CONFIG_DIR`). Per-project sessions: `~/.claude/projects/<slug>/<sessionId>.jsonl` with JSONL rows containing `type` (`user`|`assistant`), `message{...}`, `timestamp`, `parentUuid`, `cwd`, `version`, optional `slug`.
- Debug: `~/.claude/debug/<sessionId>.txt` captures startup, LSP, tool, and plugin logs.
- History: `~/.claude/history.jsonl` lines like `{"display":"...","project":"/Users/jordan/hyperyolo","sessionId":"bd54f558-0647-47ef-a830-451fbea4d555","timestamp":...}`.
- Empty `session-env/<sessionId>/` directories are created alongside (empty in tests).
- Session/file regexes: `session_id` and filenames use `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`; file path template `~/.claude/projects/<slug>/<sessionId>.jsonl`.

## Resume, Permissions, and Edge Cases
- Resume: `claude -p "What is 2+2?" --output-format json --resume de05d167-cd6b-4568-a9e4-60e7e05c0f80` reused the session and returned `session_id` unchanged. Invalid resume (`--resume 00000000-0000-0000-0000-000000000000`) exited 1 with `No conversation found with session ID: ...`. `--continue` picked the latest session id.
- Permissions: headless Write without YOLO produced `permission_denials` and tool errors (`"Claude requested permissions to write to /private/tmp/claude-perm-test/note.txt, but you haven't granted it yet."`). With `--dangerously-skip-permissions`, `permissionMode` became `bypassPermissions` and Write/Bash ran automatically.
- Non-TTY: `echo "hi" | claude --print --output-format json` worked; stdin became the prompt and JSON response still carried `session_id`.
- Invalid API key: `ANTHROPIC_API_KEY=invalid claude -p "test invalid api" --output-format json` exited 1 with `{"is_error":true,"result":"Invalid API key · Fix external API key","session_id":"a43d16a9-37e2-466c-b2ef-5f944019e8cd","modelUsage":{}}`.
- MCP noise: init events listed `mcp-agent-mail` with status `failed` (missing config) but runs continued normally.
- Color env vars: outputs observed in text/JSON were already uncolored; `NO_COLOR`/`FORCE_COLOR` had no visible impact in `--print` runs.

## Commands Exercised
- Metadata: `claude --help`, `claude plugin --help`, `claude mcp --help`, `claude setup-token --help`, `claude doctor --help`, `claude update --help`, `claude install --help`, `claude --version`.
- Outputs: `claude -p "Say 'hello'" --output-format json`; `claude -p "Say 'hi'" --output-format stream-json --verbose`; `claude -p "Hello" --output-format text --verbose`.
- Session/resume: `claude -p "What is 2+2?" --output-format json --resume <uuid>`; `claude -p "What is our session id?" --output-format json --continue`; invalid resume example above.
- Permissions: `claude -p "Run 'pwd' using bash and report the result" --output-format stream-json --verbose` (default perms, Bash auto-ran); `claude -p "Create a file named note.txt..." --output-format stream-json --verbose` (permission denied); same command with `--dangerously-skip-permissions` (Write/Bash succeeded).
- Non-TTY: `echo "hi" | claude --print --output-format json`.
- Auth error: `ANTHROPIC_API_KEY=invalid claude -p "test invalid api" --output-format json`.
