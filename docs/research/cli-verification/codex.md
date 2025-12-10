# Codex CLI Verification (v0.66.0)

- Environment: macOS; Homebrew cask install at `/opt/homebrew/bin/codex`; tests run in `/tmp/codex-verif` and `~/hyperyolo`; config root `~/.codex` (`auth.json` keys: `OPENAI_API_KEY`, `tokens`, `last_refresh`; defaults in `config.toml` set `model = "gpt-5.1-codex-max"` and `model_reasoning_effort = "xhigh"`).
- Source: https://github.com/openai/codex (Rust binary, Mach-O). CLI built with clap; commands from `codex --help` match repository surface.
- Session storage: JSONL under `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<timestamp>-<uuid>.jsonl`; history lines in `~/.codex/history.jsonl`; logs include global instructions in each session file.

## Quick Outcomes
- Default `codex exec "prompt"` streams text with a banner, settings, and `session id: <uuid>`; sample default fields: `model: gpt-5.1-codex-max`, `approval: never`, `sandbox: read-only`, `tokens used <n>`.
- `--json` outputs newline JSON events (no colors): `thread.started` (with `thread_id` = session id), `turn.started`, `item.started|completed` (types `reasoning`, `agent_message`, `command_execution`, `mcp_tool_call`), and `turn.completed` with `usage`. Works piped from stdin (non‑TTY) without crashes.
- Resume: `codex exec "<prompt>" resume <uuid>` and `codex exec resume <uuid> "<prompt>"` reuse the given session id; invalid ids start a brand-new session instead of erroring.
- Git guard: outside a repo, `codex exec` exits with `Not inside a trusted directory and --skip-git-repo-check was not specified.`; adding `--skip-git-repo-check` bypasses it.
- YOLO/perms: there is no `--yolo` flag. `--dangerously-bypass-approvals-and-sandbox` flips `sandbox: danger-full-access` and immediately runs shell commands without prompting (saw automatic `ls`/`ls -la`).

## Install / Auth / Verify
- Install: `npm install -g @openai/codex` or `brew install --cask codex` (release tarballs also available on GitHub).
- Authenticate: run `codex` once and choose **Sign in with ChatGPT** (Plus/Team/Enterprise). `OPENAI_API_KEY` works for API-key auth on supported accounts.
- Verify: `codex --version` then `codex exec --skip-git-repo-check --sandbox read-only "print('ok')"` should emit a `session id:` line.
- Not-found message copy: `Codex CLI not found. Install it with: npm install -g @openai/codex (or brew install --cask codex). Then sign in with: codex (choose "Sign in with ChatGPT"). More info: https://github.com/openai/codex`
- Models/config: `--model gpt-4.1-codex` fails on a ChatGPT account (`"The 'gpt-4.1-codex' model is not supported when using Codex with a ChatGPT account."`). TOML overrides via `-c` work (`-c model_reasoning_effort="low"` reflected in banner). `-c experimental_instructions_file=/tmp/codex-extra.md` returned `{"detail":"Instructions are not valid"}` (expects structured content).

## CLI Surface (help/flags)
- `codex --help` lists commands: `exec` (non-interactive), `review`, `login/logout`, `mcp`, `app-server`, `sandbox`, `apply`, `resume`, `cloud`, `features`.
- Core options: `-c/--config <key=value>` (TOML override), `--enable/--disable <feature>`, `-i/--image`, `-m/--model`, `--oss/--local-provider`, `-p/--profile`, `-s/--sandbox <read-only|workspace-write|danger-full-access>`, `-a/--ask-for-approval <untrusted|on-failure|on-request|never>`, `--full-auto`, `--dangerously-bypass-approvals-and-sandbox`, `--add-dir`, `--search`, `--cd`, `--version`.
- `codex exec --help` adds `--skip-git-repo-check`, `--output-schema`, `--color <always|never|auto>`, `--json`, `-o/--output-last-message`, plus subcommands `resume` and `review`.
- `codex exec resume --help` exposes `--last` and config/feature toggles; prompt can be passed after the id (quirk documented below). Version: `codex --version` → `codex-cli 0.66.0`.

## Output Formats
- **Text (default):** banner with workdir/model/provider/approval/sandbox/reasoning effort, then `session id: <uuid>`, followed by role-tagged blocks (`user`, `thinking`, `codex`, `tokens used`). Example session id format: `019b0523-d79c-7401-b0a7-e0686a83d6e1`.
- **JSON (`--json`):** streamed events such as:
  ```json
  {"type":"thread.started","thread_id":"019b0524-3ac5-71c2-8e8a-fb9d1e8ab10b"}
  {"type":"turn.started"}
  {"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"PING"}}
  {"type":"turn.completed","usage":{"input_tokens":3523,"cached_input_tokens":3072,"output_tokens":7}}
  ```
  `thread_id` matches the session id stored on disk. Non‑TTY input via `echo "prompt" | codex exec --json --skip-git-repo-check --sandbox read-only -` succeeded (no panic), but the agent still auto-ran shell commands in read‑only mode.

## Session Storage & Schema
- Path template: `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<YYYY-MM-DDThh-mm-ss>-<session_uuid>.jsonl`. Session ids are UUID-like (`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}` starting with `01` in observed runs).
- History: `~/.codex/history.jsonl` entries like `{"session_id":"...","ts":<unix>,"text":"<first prompt>"}`. Auth/config stored in `auth.json` and `config.toml` alongside `archived_sessions/`, `log/`, `version.json`.
- JSONL event types observed in session files:
  - `session_meta.payload`: `id`, `timestamp`, `cwd`, `originator` (`codex_exec`), `cli_version`, `instructions` (full AGENTS+project doc string), `source` (`exec`), `model_provider`, optional `git{commit_hash,branch}`.
  - `response_item.payload.type`: `message` (with `role` and `content[]` items like `input_text`), `reasoning` (includes `summary[]`, optional `encrypted_content`), `function_call{ name, arguments, call_id }`, `function_call_output{ call_id, output }`, `ghost_snapshot{ ghost_commit{id,parent,preexisting_untracked_files[]} }`.
  - `event_msg.payload.type`: `user_message`, `token_count` (with rate limit snapshots), `agent_reasoning`, `turn_aborted`.
  - `turn_context.payload`: `cwd`, `approval_policy`, `sandbox_policy{type}`, `model`, `effort`, `summary`.
- Session files capture every prompt/instruction injected by Codex (AGENTS.md text, environment context) before user content; expect privacy-sensitive data to be logged verbatim.

## Resume, Git, and Edge Behavior
- **Resume syntax:** Both `codex exec "<prompt>" resume <uuid>` and `codex exec resume <uuid> "<prompt>"` preserved the prior session id. Passing an invalid id did not error—Codex started a new session with a fresh id and continued running commands, so consumers must validate ids themselves.
- **Git check:** Running `codex exec resume <uuid>` outside a repo fails unless `--skip-git-repo-check` is present. With the flag, commands in `/tmp` worked normally.
- **Non‑TTY:** Piping stdin into `codex exec --json ... -` worked; the agent still attempted shell commands even for trivial prompts (read-only sandbox mitigated writes).
- **Sandbox/approvals:** `--dangerously-bypass-approvals-and-sandbox` reports `sandbox: danger-full-access` and executed `ls`/`ls -la` immediately with no approval prompts. Default exec runs in read-only unless overridden (config-driven).

## Flag & Config Findings
- `--model gpt-4.1-codex` → `{"detail":"The 'gpt-4.1-codex' model is not supported when using Codex with a ChatGPT account."}`; stick to `gpt-5.1-codex(-max)` on this account.
- `-c model_reasoning_effort="low"` was accepted and reflected in the banner. TOML parsing treats values as TOML first, then string literal.
- `-c experimental_instructions_file=/tmp/codex-extra.md` returned `{"detail":"Instructions are not valid"}` (expects structured instructions; plain text rejected).
- `--skip-git-repo-check` is required for `/tmp` runs; without it Codex exits before starting a session.
- There is no `--yolo` flag; closest equivalents are `--full-auto` (sets approval on-request + workspace-write) and `--dangerously-bypass-approvals-and-sandbox` (full access, no approvals).

## Commands Exercised
- Help/version: `codex --help`, `codex exec --help`, `codex exec resume --help`, `codex --version`, `brew info codex`, `file $(which codex)`.
- Default/JSON runs: `codex exec --skip-git-repo-check --sandbox read-only "Say 'hello...'"`, `codex exec --json --skip-git-repo-check --sandbox read-only "Reply with 'PING'"`.
- Resume: `codex exec "Now respond with PONG" resume <session>`, `codex exec resume <session> "Repeat PING"`.
- Error/edge cases: run without `--skip-git-repo-check` in `/tmp` (git guard), `codex exec resume 000...` (creates new session), `echo "Non-tty" | codex exec --json --skip-git-repo-check --sandbox read-only -`.
- Flags: `codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check "Say YOLO-only"`, `codex exec --model gpt-4.1-codex ...` (model error), `codex exec -c model_reasoning_effort="low" ...` (accepted), `codex exec -c experimental_instructions_file=/tmp/codex-extra.md ...` (rejected), `OPENAI_API_KEY=invalid codex exec --json ...` (env override ignored; session started).
