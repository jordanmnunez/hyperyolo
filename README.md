# hyperyolo

A cobbled execution unit. Strap the rockets together. Fan the flames. **Built to be an OSHA violation.**

One interface for Codex, Claude Code, and Gemini CLI.

```bash
# Instead of three different syntaxes:
codex exec --dangerously-bypass-approvals-and-sandbox "fix the bug"
claude -p "fix the bug" --dangerously-skip-permissions
gemini -p "fix the bug" --yolo

# Use one:
hyperyolo codex "fix the bug"
hyperyolo claude "fix the bug"
hyperyolo gemini "fix the bug"
```

## What It Does

- **Straps rockets together** — Wraps `codex`, `claude`, and `gemini` into one frame
- **Normalizes the interface** — Same syntax for all three backends
- **No guardrails** — Always applies YOLO/full-auto flags
- **Session continuity** — Unified `--resume` flag across all backends
- **Terminalcore maximalism** — Industrial hazard aesthetic

## What It Doesn't Do

- **Not an API client** — Does not call OpenAI/Anthropic/Google APIs directly
- **Not a reimplementation** — Does not rebuild tool execution, sandboxing, or MCP support
- **Preserves CLI features** — Sandboxing, context compaction, and native session storage all work as designed

## Requirements

- Node.js 18+ (Gemini CLI requires Node 20+)
- CLI version baselines (hyperyolo warns when below these): Codex ≥ 0.66.0, Claude Code ≥ 2.0.62, Gemini CLI ≥ 0.19.3. See `docs/cli-compatibility.md` for the full matrix.
- At least one of the underlying CLIs installed and configured:
  - [Codex CLI](https://github.com/openai/codex)
  - [Claude Code](https://claude.ai/code)
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli)

## Installation

```bash
npm install -g hyperyolo

# Or run directly
npx hyperyolo
```

## Quickstart

1) Install hyperyolo (above).
2) Install and authenticate at least one backend CLI (Codex, Claude Code, or Gemini). See the setup table below.
3) Run the verification commands to ensure each CLI works before using hyperyolo.
4) Run `hyperyolo <backend> "prompt"` as shown in the Usage section.

## Backend CLI Setup (install, auth, verify)

### Codex CLI

- Install: `npm install -g @openai/codex` **or** `brew install --cask codex` (or download a release binary).
- Authenticate: run `codex` once and choose **Sign in with ChatGPT** (Plus/Team/Enterprise) or set `OPENAI_API_KEY` before running.
- Verify: `codex --version` then `codex exec --skip-git-repo-check --sandbox read-only "print('ok')"` (expect a session id in output).
- Common install issues: npm global bin not on `PATH`; Homebrew upgrades can lag (reinstall if version stays stale); outside a git repo use `--skip-git-repo-check` to avoid early exit.

### Claude Code CLI

- Install: `npm install -g @anthropic-ai/claude-code` (or one-off via `npx @anthropic-ai/claude-code@latest --version`).
- Authenticate: set `ANTHROPIC_API_KEY` or run `claude setup-token` to persist it to `~/.claude`.
- Verify: `claude --version` then `claude -p "ping" --output-format json --verbose` (should return JSON with `session_id`).
- Common install issues: missing API key returns `Invalid API key`; `--output-format stream-json` requires `--verbose`; ensure Node 18+.

### Gemini CLI

- Install: `npx https://github.com/google-gemini/gemini-cli` (no install), `npm install -g @google/gemini-cli`, or `brew install gemini-cli`.
- Authenticate: `gemini login` for Google OAuth in a browser, or set `GEMINI_API_KEY` and run `gemini login --api-key` in headless environments.
- Verify: `gemini --version` then `gemini -y "ping" -o json` (expect JSON response; use `--approval-mode yolo`/`-y` so shell/edit tools are enabled).
- Common install issues: requires Node 20+; API-key mode is safer on servers without browsers; YOLO does not auto-enable sandbox—pass `--sandbox` when you want isolation.

### Missing CLI helpful messages (copy/paste)

- Codex: `Codex CLI not found. Install it with: npm install -g @openai/codex (or brew install --cask codex). Then sign in with: codex (choose "Sign in with ChatGPT"). More info: https://github.com/openai/codex`
- Claude: `Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code. Then authenticate with: ANTHROPIC_API_KEY=<your key> claude setup-token. More info: https://docs.anthropic.com/claude/docs/claude-code-cli`
- Gemini: `Gemini CLI not found. Install it with: npm install -g @google/gemini-cli (or brew install gemini-cli / npx https://github.com/google-gemini/gemini-cli). Then authenticate with: gemini login --api-key <GEMINI_API_KEY> (or browser login). More info: https://geminicli.com/docs`

## Usage

### Basic Execution

```bash
hyperyolo claude "analyze this codebase and fix any bugs"
hyperyolo codex "add comprehensive test coverage"
hyperyolo gemini "refactor the authentication system"
```

### Resume Sessions

```bash
# First run outputs a session ID
hyperyolo claude "analyze the code"
# ⚡ SESSION: hyper_abc123

# Continue that session
hyperyolo claude "now fix the issues you found" --resume hyper_abc123
```

### Output

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ⚠ HYPERYOLO — ROCKETS STRAPPED                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

ENGINE: claude/claude-sonnet-4-20250514
SESSION: hyper_abc123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[streaming output from the underlying CLI]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BURN COMPLETE — Duration: 47.3s | Tokens: 12,847 | Cost: $0.42

Resume: hyperyolo claude --resume hyper_abc123 "continue"
```

## CLI Reference

```bash
hyperyolo <backend> "<prompt>" [options]

Backends:
  codex     OpenAI Codex CLI
  claude    Anthropic Claude Code
  gemini    Google Gemini CLI

Options:
  --resume <id>    Resume a previous session
  --help           Show help
  --version        Show version
```

## How It Works

1. Parses your command and selects the backend adapter
2. Translates to the backend's native CLI syntax
3. Spawns the CLI subprocess with maximum autonomy flags
4. Streams output to your terminal in real-time
5. Parses output for session IDs and statistics
6. Stores session mapping for later resume

### Flag Translation

| hyperyolo | Codex | Claude | Gemini |
|-----------|-------|--------|--------|
| `"prompt"` | `exec "prompt"` | `-p "prompt"` | `-p "prompt"` |
| `--resume ID` | `resume <id>` | `--resume <id>` | `-r <id>` |
| (auto) | `--dangerously-bypass-approvals-and-sandbox` | `--dangerously-skip-permissions` | `-y` |

## Why Wrapper, Not API Client?

Tools like [Crush](https://github.com/charmbracelet/crush) and [Aider](https://github.com/paul-gauthier/aider) call AI APIs directly. They're full implementations with their own tool execution, sandboxing, and session management.

hyperyolo wraps the official CLIs instead. This preserves:
- Native sandboxing (Gemini's Docker isolation)
- Native context compaction (Claude's summarization)
- Native MCP support
- Native session storage
- Your existing CLI authentication

You get all the work each CLI team has done, with a consistent interface.

## Known Limitations

- Codex: exits outside a git repo unless `--skip-git-repo-check` is set; there is no `--yolo`, so hyperyolo uses `--dangerously-bypass-approvals-and-sandbox` for unattended runs (disables sandbox). Invalid resume IDs make Codex start a new session, so only use hyperyolo-issued IDs.
- Claude: `--output-format stream-json` must be paired with `--verbose` or it exits 1; text output has no `session_id`. Headless runs block Write/Bash without `--dangerously-skip-permissions`.
- Gemini: headless mode removes shell/edit/write tools unless `-y/--approval-mode yolo` is set; `-y` does not enable sandboxing (add `--sandbox` explicitly). Text output lacks session IDs; invalid API keys surface `[object Object]` errors and exit code 144.
- hyperyolo wrapper: only wraps the main execution path (no provider-specific `mcp`, plugin/extension, approval/sandbox/model tuning flags). macOS/Linux only; Node 18+ required (Gemini CLI needs Node 20+). Resume can fail if a native session file was pruned or if upstream output formats change—start a new session or run the native CLI in that case.

## Project Status

**Pre-release** — MVP in development.

See [docs/PRD.md](docs/PRD.md) for the full product requirements document.

## License

MIT
