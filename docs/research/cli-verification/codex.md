# Codex CLI Verification (v0.66.0)

## Version & Environment
- Version tested: codex-cli 0.66.0
- Environment: macOS; Homebrew cask install at `/opt/homebrew/bin/codex`; tests run in `/tmp/codex-verif` and `~/hyperyolo`.
- Config root: `~/.codex` (`auth.json` keys: `OPENAI_API_KEY`, `tokens`, `last_refresh`; defaults in `config.toml` set `model = "gpt-5.1-codex-max"` and `model_reasoning_effort = "xhigh"`).
- Source: Rust binary from https://github.com/openai/codex (clap-based CLI; Homebrew and npm builds align).

## Installation & Authentication
- Install: `npm install -g @openai/codex` or `brew install --cask codex` (release tarballs also available on GitHub).
- Authenticate: run `codex` once and choose **Sign in with ChatGPT** (Plus/Team/Enterprise). `OPENAI_API_KEY` works for API-key auth on supported accounts.
- Verify: `codex --version` then `codex exec --skip-git-repo-check --sandbox read-only "print('ok')"` should emit a `session id:` line.
- Not-found message: `Codex CLI not found. Install it with: npm install -g @openai/codex (or brew install --cask codex). Then sign in with: codex (choose "Sign in with ChatGPT"). More info: https://github.com/openai/codex`

## Commands & Flags
- Commands from `codex --help`: `exec` (non-interactive), `review`, `login/logout`, `mcp`, `app-server`, `sandbox`, `apply`, `resume`, `cloud`, `features`.
- Core options: `-c/--config <key=value>` (TOML override), `--enable/--disable <feature>`, `-i/--image`, `-m/--model`, `--oss/--local-provider`, `-p/--profile`, `-s/--sandbox <read-only|workspace-write|danger-full-access>`, `-a/--ask-for-approval <untrusted|on-failure|on-request|never>`, `--full-auto`, `--dangerously-bypass-approvals-and-sandbox`, `--add-dir`, `--search`, `--cd`, `--version`.
- `codex exec --help` adds `--skip-git-repo-check`, `--output-schema`, `--color <always|never|auto>`, `--json`, `-o/--output-last-message`, plus subcommands `resume` and `review`.
- Version command: `codex --version` → `codex-cli 0.66.0`.
- Model/config quirks: `--model gpt-4.1-codex` fails on a ChatGPT account (`"The 'gpt-4.1-codex' model is not supported when using Codex with a ChatGPT account."`). TOML overrides via `-c` work (e.g., `-c model_reasoning_effort="low"` reflected in the banner). `-c experimental_instructions_file=/tmp/codex-extra.md` returned `{"detail":"Instructions are not valid"}`.

## Session Management
- Session ID regex: `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}` (observed ids start with `01`).
- Storage path template: `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<YYYY-MM-DDThh-mm-ss>-<session_uuid>.jsonl`. History lives at `~/.codex/history.jsonl`.
- Session file payload types observed:
  - `session_meta.payload`: `id`, `timestamp`, `cwd`, `originator` (`codex_exec`), `cli_version`, `instructions` (full AGENTS+project doc string), `source` (`exec`), `model_provider`, optional `git{commit_hash,branch}`.
  - `response_item.payload.type`: `message` (with `role` and `content[]` items like `input_text`), `reasoning` (includes `summary[]`, optional `encrypted_content`), `function_call{ name, arguments, call_id }`, `function_call_output{ call_id, output }`, `ghost_snapshot{ ghost_commit{id,parent,preexisting_untracked_files[]} }`.
  - `event_msg.payload.type`: `user_message`, `token_count` (with rate limit snapshots), `agent_reasoning`, `turn_aborted`.
  - `turn_context.payload`: `cwd`, `approval_policy`, `sandbox_policy{type}`, `model`, `effort`, `summary`.
- Resume: `codex exec "<prompt>" resume <uuid>` and `codex exec resume <uuid> "<prompt>"` reuse the given session id; invalid ids start a brand-new session instead of erroring, so consumers must validate ids.
- Git guard: outside a repo, `codex exec` exits with `Not inside a trusted directory and --skip-git-repo-check was not specified.`; adding `--skip-git-repo-check` bypasses it.

## Output Formats & Schemas
- Text (default): banner with workdir/model/provider/approval/sandbox/reasoning effort, then `session id: <uuid>`, followed by role-tagged blocks (`user`, `thinking`, `codex`, `tokens used`). Session id format matches the regex above.
- JSON (`--json`): streamed events such as:
  ```json
  {"type":"thread.started","thread_id":"..."}
  {"type":"turn.started"}
  {"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"PING"}}
  {"type":"turn.completed","usage":{"input_tokens":3523,"cached_input_tokens":3072,"output_tokens":7}}
  ```
  `thread_id` matches the session id stored on disk. Works piped from stdin (non‑TTY) without crashes.
- Schema: `docs/research/cli-verification/schemas/codex-output.schema.json` (JSON event stream only; banner/session-id text is documented above).

## YOLO / Permission Behavior
- No `--yolo` flag; closest equivalents: `--full-auto` (sets approval on-request + workspace-write) and `--dangerously-bypass-approvals-and-sandbox` (full access, no approvals).
- Default exec runs in read-only unless overridden via `--sandbox` or config; JSON runs still attempt shell commands even in read-only mode.
- `--dangerously-bypass-approvals-and-sandbox` reports `sandbox: danger-full-access` and executed `ls`/`ls -la` immediately with no approval prompts.

## Regex Patterns
- Session id: `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}` (observed ids start with `01`).
- Session file naming: `rollout-[0-9T-]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jsonl` under date-stamped directories.

## Known Issues & Edge Cases
- Resume with an invalid id silently starts a new session; adapters must validate ids before resuming.
- Running outside a git repo fails unless `--skip-git-repo-check` is present.
- Non-interactive (`echo "prompt" | codex exec --json ... -`) succeeds; the agent still attempts shell commands, mitigated only by sandbox policy.
- `--model gpt-4.1-codex` rejected on ChatGPT account; stick to `gpt-5.1-codex(-max)`.
- `OPENAI_API_KEY=invalid` did not block session creation when run alongside existing chat auth; CLI still created sessions.

## Commands Exercised
- Help/version: `codex --help`, `codex exec --help`, `codex exec resume --help`, `codex --version`, `brew info codex`, `file $(which codex)`.
- Default/JSON runs: `codex exec --skip-git-repo-check --sandbox read-only "Say 'hello...'"`, `codex exec --json --skip-git-repo-check --sandbox read-only "Reply with 'PING'"`.
- Resume: `codex exec "Now respond with PONG" resume <session>`, `codex exec resume <session> "Repeat PING"`.
- Error/edge cases: run without `--skip-git-repo-check` in `/tmp` (git guard), `codex exec resume 000...` (creates new session), `echo "Non-tty" | codex exec --json --skip-git-repo-check --sandbox read-only -`.
- Flags: `codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check "Say YOLO-only"`, `codex exec --model gpt-4.1-codex ...` (model error), `codex exec -c model_reasoning_effort="low" ...` (accepted), `codex exec -c experimental_instructions_file=/tmp/codex-extra.md ...` (rejected).
