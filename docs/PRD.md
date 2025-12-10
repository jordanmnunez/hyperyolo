# hyperyolo: Product Requirements Document

> A unified CLI wrapper for autonomous AI code execution across Codex, Claude Code, and Gemini CLI.

---

## Overview

hyperyolo normalizes three AI coding CLIs into a single interface optimized for maximum autonomous execution. It wraps the official CLI tools as subprocesses rather than reimplementing their functionality via APIs.

### What It Is

```bash
# Instead of remembering three different syntaxes:
codex exec --dangerously-bypass-approvals-and-sandbox "fix the bug"
claude -p "fix the bug" --dangerously-skip-permissions
gemini -p "fix the bug" --yolo

# Use one:
hyperyolo codex "fix the bug"
hyperyolo claude "fix the bug"
hyperyolo gemini "fix the bug"

# With unified session resume:
hyperyolo claude "continue" --resume hyper_abc123
```

### What It Is Not

- **Not an API client** — Does not call OpenAI/Anthropic/Google APIs directly
- **Not a reimplementation** — Does not rebuild tool execution, sandboxing, or context management
- **Not interactive** — Non-interactive by default (fire and forget)

---

## Why CLI Wrapper vs API Client?

### Two Approaches to Multi-Model AI CLIs

**API-Based Tools** (Crush, Aider, OpenCode):
- Call AI provider APIs directly
- Must implement tool execution, file editing, sandboxing from scratch
- Can switch models easily (just swap endpoints)

**CLI Wrappers** (hyperyolo):
- Run official CLIs as subprocesses
- Preserve all CLI-native features (sandboxing, MCP, context compaction)
- Normalize the interface and parse output

### What Official CLIs Provide

| Feature | API-based tools | Official CLIs |
|---------|-----------------|---------------|
| Tool execution | Implement yourself | Built-in |
| Sandbox/safety | Implement yourself | Built-in (Gemini's Docker) |
| Session storage | Implement yourself | Native, CLI-managed |
| Context compaction | Implement yourself | Built-in (Claude's summarization) |
| MCP support | Implement yourself | Native integration |
| Auth/billing | Requires API keys | Uses existing CLI auth |

hyperyolo preserves all of this by delegating to the real CLIs.

### Existing Tools

- **[Crush](https://github.com/charmbracelet/crush)** — Charm team's multi-provider agent. Uses APIs directly. Successor to OpenCode.
- **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)** — Exposes CLIs as OpenAI-compatible APIs (reverse of hyperyolo).
- **[ai-code-interface.el](https://github.com/tninja/ai-code-interface.el)** — Emacs-specific unified interface.

None of these are CLI wrappers that preserve native CLI functionality.

## Pre-Implementation Plan

Research outputs, locked decisions (runtime, storage, streaming/tee strategy, parsing rules), and the version compatibility matrix (Codex 0.66.0, Claude 2.0.62, Gemini 0.19.3) are consolidated in `docs/pre-implementation-plan.md`. Implementation should track that plan and surface version warnings when a detected CLI is below the documented baseline.

---

## Core Requirements

### 1. Unified Command Interface

```bash
hyperyolo <backend> "<prompt>" [--resume <id>]
```

- `backend`: `codex`, `claude`, or `gemini`
- `prompt`: The task to execute
- `--resume`: Optional session ID from previous run

### 2. Maximum Autonomy by Default

hyperyolo always applies maximum settings:

| Backend | YOLO Flag | Model | Other |
|---------|-----------|-------|-------|
| Codex | `--dangerously-bypass-approvals-and-sandbox` | Default `gpt-5.1-codex-max` (fallback to `gpt-5.1-codex` if the max tier is rejected) | `--skip-git-repo-check` recommended outside git repos |
| Claude | `--dangerously-skip-permissions` | Use CLI default alias (`sonnet`, currently `claude-3-7-sonnet-latest`; keep user overrides intact) | `--max-turns` unset |
| Gemini | `--yolo` or `-y` | Default `auto` (resolves to `gemini-2.5-pro`, or `gemini-3-pro-preview` when preview features are enabled) | Request `--sandbox` explicitly; YOLO does not auto-enable sandboxing |

No confirmations, no safety prompts, no iteration limits.

#### Model selection strategy
- Never override a user-supplied `--model`.
- Codex: start with `gpt-5.1-codex-max`; if the CLI returns an unsupported-model error, retry with `gpt-5.1-codex` and surface the downgrade in the footer.
- Claude Code: use the CLI’s default alias (`sonnet` → `claude-3-7-sonnet-latest` as of 2.0.64). If an explicit model fails validation, fall back to `sonnet` and show the error plus the fallback.
- Gemini CLI: pass `-m auto` so the CLI resolves to `gemini-2.5-pro` (or `gemini-3-pro-preview` when preview features are enabled). Rely on the CLI’s built-in fallback to `gemini-2.5-flash` when it enters fallback mode; surface the active model in the footer.

### 3. Session Continuity

Unified `--resume` flag regardless of backend:

```bash
# First run outputs: SESSION: hyper_abc123
hyperyolo claude "analyze the codebase"

# Resume with unified syntax
hyperyolo claude "now fix the issues" --resume hyper_abc123
```

hyperyolo maintains a session registry mapping its IDs to native CLI session IDs.

### 4. Real-Time Streaming Output

- Stream subprocess output to terminal in real-time
- Parse output for session IDs and statistics
- Display decorated header/footer with run metadata

### 5. Maximalist Aesthetic

Bold, colorful, unapologetic terminal output:

```
╔══════════════════════════════════════════════════════════════╗
║  H Y P E R Y O L O                                           ║
║  MAXIMUM AUTONOMOUS EXECUTION                                ║
╚══════════════════════════════════════════════════════════════╝

⚡ BACKEND: Claude Code
⚡ MODE: --dangerously-skip-permissions
⚡ SESSION: hyper_abc123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[streaming output from CLI]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💥 EXECUTION COMPLETE 💥
Duration: 47.3s | Tokens: 12,847 | Cost: $0.42

Resume: hyperyolo claude --resume hyper_abc123 "continue"
```

### 6. Graceful Degradation

- Detect capabilities via `supports-color` (respect `NO_COLOR`, `FORCE_COLOR`, `CI`, non-TTY defaults) and `is-unicode-supported`; non-TTY output is treated as monochrome unless forced.
- Determine width from `process.stdout.columns` (fallback 80), clamp for very narrow terminals, and recompute on `SIGWINCH` without rerendering prior stream output.
- Select a tier per `docs/research/terminal-capabilities.md`: **Maximal** (TrueColor + emoji + box drawing), **Vivid** (256-color gradients), **Minimal Color** (16-color, ASCII emoji), or **Monochrome** (ANSI stripped, ASCII borders only).
- Keep parsing ANSI-agnostic (use stripped output for regex/JSON) while the UI path styles with the chosen tier; log the tier and width in debug output for supportability.

### 7. Timeout Handling

- Default **absolute timeout: 30m** per run; **idle timeout: 5m** of no stdout/stderr; **grace period: 5s** between SIGTERM and SIGKILL. Defaults live per backend and can diverge if a CLI needs extra headroom.
- Flags/config: `--timeout <duration>` (absolute), `--idle-timeout <duration>`, and `--no-timeout` to disable both timers for intentionally long jobs. Any timer can be disabled with `0`/`null` in config.
- Detection starts immediately at spawn (idle timer counts from time zero) and resets on every output chunk; the first timer to trigger wins.
- On timeout: send SIGTERM, then SIGKILL after the grace period if still running; surface a clear `TimeoutError` with reason (absolute/idle), elapsed time, last output timestamp, and whether SIGKILL was required. Callers may persist session metadata before teardown.

### 8. Error Handling

- Error taxonomy and user-facing copy live in `src/core/errors.ts`; full playbooks in `docs/architecture/error-handling.md`.
- Categories: `cli-binary`, `auth`, `session`, `process`, `output-parsing`, `network`, `filesystem`; explicit codes for each (e.g., `CLI_NOT_FOUND`, `AUTH_RATE_LIMITED`, `PARSE_SESSION_ID_MISSING`).
- Severities: `fatal` (stop), `retryable` (user can retry with backoff/flag tweaks), `warning` (continue with degraded features). Defaults live in `DEFAULT_ERROR_SEVERITY`.
- Non-throwing parsing/availability: adapter `isAvailable` returns `{ available: false, error }`; parsing hooks return `null` on failure. Warnings should not flip the exit code.
- Recovery-first UX: every code maps to a headline, detail, and recovery hint via `formatUserFacingError`; stdout/stderr stay intact for debugging.
- Resume safety: do not persist unknown session IDs; on parsing failures disable resume/stats but keep streaming. Session writes stay atomic with lock + temp-write/rename; fallback to read-only with a warning when the store is corrupted or unwritable.
- Rate limits: treat CLI-surfaced throttling (e.g., Claude stream-json `error:"rate_limit"` with text `Limit reached · resets 2pm (America/Denver) · /upgrade...`) as `AUTH_RATE_LIMITED` (retryable). Keep the native message in the stream, add a footer hint with the reset time when present, preserve the session mapping for `--resume` after backoff, and do not auto-loop retries—just exit with the CLI code and guidance to wait or switch backends.
- Rate limit implementation plan (no auto-retry): adapters detect provider-specific throttling markers and map to `AUTH_RATE_LIMITED`; executor streams the native message unmodified, augments the footer with any reset window parsed from the payload, exits with the original CLI code, and preserves session writes for future `--resume`; tests add fixtures for Claude stream-json `error:"rate_limit"` plus Codex/Gemini equivalents to assert classification, footer hint, and no automatic retry loop.

---

## Architecture

### High-Level Data Flow

```
User: hyperyolo claude "fix the bug" --resume hyper_abc123
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                    hyperyolo CLI                            │
│  - Parse args (backend, prompt, --resume)                   │
│  - Look up session mapping if resuming                      │
│  - Select backend adapter                                   │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend Adapter (Claude)                   │
│  - Translate to CLI args:                                   │
│    claude -p "fix the bug" --dangerously-skip-permissions   │
│           --resume <native_id> --output-format stream-json  │
│  - Spawn subprocess                                         │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Output Handler                            │
│  - Tee: display to terminal + parse for metadata            │
│  - Extract session ID, tokens, cost                         │
│  - Store session mapping                                    │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Session Store                             │
│  - Map hyper_abc123 → {backend: "claude", nativeId: "..."}  │
│  - Persist to ~/.config/hyperyolo/sessions.json             │
└─────────────────────────────────────────────────────────────┘
```

### Backend Adapter Interface

```typescript
interface BackendAdapter {
  name: 'codex' | 'claude' | 'gemini';
  sessionIdPattern: RegExp;

  // Check if CLI is installed and report version
  isAvailable(): Promise<AvailabilityResult>;

  // Build CLI command invocation
  buildCommand(prompt: string, options: ExecutionOptions): CommandBuildResult;

  // Parse session ID from sanitized output chunk (may be called repeatedly)
  parseSessionId(chunk: string, accumulated: string): string | null;

  // Parse completion stats from full sanitized output
  parseStats(output: string): ExecutionStats | null;
}

interface AvailabilityResult {
  available: boolean;
  version?: string;
  rawVersionOutput?: string;
  warnings?: string[];
  versionStatus?: VersionCheckResult;
  error?: string;  // User-facing error when available is false
}

interface CommandBuildResult {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface ExecutionOptions {
  resumeSessionId?: string;  // Native CLI session ID
  model?: string;            // Override default model
  systemPrompt?: string;     // Future: system prompt injection
  outputFormat?: 'stream-json' | 'json' | 'text';
  rawArgs?: string[];        // Extra backend-specific args
}

interface ExecutionStats {
  tokens?: number;
  costUsd?: number;
  durationMs?: number;
  raw?: unknown;  // Raw payload for inspection
}
```

Adapter requirements for ANSI/parsing:
- hyperyolo strips ANSI codes and normalizes carriage returns before calling `parseSessionId`/`parseStats`; adapters must not depend on color codes or cursor positioning for parsing.
- `buildCommand` should request parse-friendly output modes (Claude/Gemini `stream-json`, Codex `--json`) to minimize ANSI noise; fall back to colored text only when parsing is explicitly disabled.
- Parser hooks may be stateful/incremental, but should not perform additional ANSI stripping; the executor preserves a raw stream for UI while providing sanitized slices to adapters.

### CLI Argument Translation

| hyperyolo | Codex | Claude | Gemini |
|-----------|-------|--------|--------|
| `"prompt"` | `exec "prompt"` | `-p "prompt"` | `-p "prompt"` |
| `--resume ID` | `resume <nativeId>` (after prompt) | `--resume <nativeId>` (before -p) | `-r <nativeId>` |
| (auto) | `--dangerously-bypass-approvals-and-sandbox` | `--dangerously-skip-permissions` | `-y` |
| (auto) | — | `--output-format stream-json` | `-o stream-json` |

### Session ID Extraction

Each CLI outputs session IDs differently:

- **Codex**: `session id: <uuid>` in startup text
- **Claude**: `{"session_id": "..."}` in stream-json init event
- **Gemini**: `{"type":"init","session_id":"..."}` in stream-json

hyperyolo generates its own ID (`hyper_<8hex>`) and maps to the native ID.

---

## Tech Stack Decision

Research in `docs/research/analysis.md` recommended **Go** for single-binary distribution and minimal runtime friction, but we are committing to **TypeScript/Node** for the MVP.

- **Rationale (why TypeScript now):** Fastest path for the team (existing execa streaming patterns from Beads Runner) with minimal Commander scaffolding, plus direct access to the maximalist npm UI stack (chalk/gradient-string/figlet/boxen/ora). Commander keeps the CLI surface lightweight while we validate the product; we can swap to oclif later if a plugin marketplace becomes a requirement.
- **Trade-offs we accept:** Requires Node.js 18+, larger packaged size (~50MB with a bundled runtime vs ~10MB Go), slightly slower cold start/higher memory, and manual structure for any future plugin/extensibility story (no baked-in plugin host like oclif).
- **Benefits realized:** Rapid iteration speed, easy contributor onboarding, and reuse of prior TypeScript utilities outweigh distribution simplicity for our developer audience (who already have Node installed).
- **Future considerations:** Revisit a Go rewrite if installation friction becomes a top complaint, if offline/air-gapped single-binary delivery becomes P0, or if startup/perf constraints tighten. Mitigate meanwhile with optional bundling (`pkg`, `bunx --compile`) to reduce runtime dependency while keeping the TypeScript codebase. Re-evaluate oclif when we need first-class plugin hosting or user-installable backends.

## Tech Stack

### Language: TypeScript

Chosen for:
- Developer familiarity (fastest path to shipping)
- Rich npm ecosystem for CLI aesthetics
- Proven patterns from Beads Runner (`execa` streaming)

Trade-offs accepted:
- Requires Node.js runtime (users are developers, they have it)
- Larger binary if bundled (~50MB vs ~10MB for Go)
- Slower startup (~200ms vs ~30ms) — negligible for AI tasks

### CLI Framework: Commander (MVP)

- Minimal API and small dependency surface; fastest to wire the three backend commands
- TypeScript-friendly without a generator; we own the argument parsing layout
- Auto-generated help and subcommand support cover MVP needs
- Plugin path lives in `docs/architecture/cli-framework-decision.md`; migrate to oclif later if we need user-installable backends
- Estimated time savings vs oclif: ~0.5–1 engineering day for MVP scaffolding (no generator, command class boilerplate, or plugin packaging)

### Terminal UI Libraries

| Library | Purpose |
|---------|---------|
| `chalk` | Text coloring (TrueColor support) |
| `gradient-string` | Rainbow/neon gradient text |
| `figlet` | ASCII art banners |
| `boxen` | Bordered boxes |
| `ora` | Animated spinners |
| `execa` | Subprocess management with streaming |

### Session Storage: JSON with Locking

- **Decision**: Keep a JSON store at `~/.config/hyperyolo/sessions.json`, guarded by a lockfile and atomic temp-write-then-rename on every mutation.
- **Rationale**: Small dataset (lookup by ID + list/cleanup), single-user CLI with occasional concurrent runs, zero native dependencies, and human-readable support data. Concurrency risk is mitigated with advisory locks; richer query needs can trigger a later SQLite migration.
- **Format**:

```json
{
  "hyper_abc123": {
    "backend": "claude",
    "nativeId": "claude-session-xyz",
    "createdAt": "2024-12-09T10:00:00Z",
    "lastSeenAt": "2024-12-09T10:05:00Z",
    "lastPrompt": "fix the bug",
    "invalid": false
  }
}
```

- **Concurrency rules**: Acquire an exclusive lock (e.g., via `proper-lockfile`) before read-modify-write, retry with jitter, treat stale locks as recoverable, and fall back to read-only with a warning if the lock cannot be taken. Write via `sessions.json.tmp` + atomic rename on the same filesystem. More detail in `docs/architecture/session-storage.md`.

### Session Lifecycle and Cleanup

- **Retention**: Keep hyperyolo session records for 30 days by default (configurable). Stale records generate warnings but are not deleted automatically during a run.
- **Cleanup**: Provide `hyperyolo sessions clean --older-than 30d [--invalid-only] [--max-records 200]` to prune stale/invalid entries. Offer an opt-in config to auto-prune on startup; default is manual.
- **Validation on resume**: Warn when resuming stale records; if the native CLI rejects a session, mark it `invalid` for later cleanup while still preserving the record for inspection.
- **Guardrails**: Warn when the session store exceeds 5 MB or 500 records; future hard cap (e.g., 20 MB) requires an explicit override.
- **More detail**: `docs/architecture/session-lifecycle.md` captures lifecycle states, cleanup triggers, and the planned session command set.

---

## Project Structure

```
hyperyolo/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Entry point + exports
│   ├── commands/
│   │   ├── codex.ts             # hyperyolo codex
│   │   ├── claude.ts            # hyperyolo claude
│   │   └── gemini.ts            # hyperyolo gemini
│   ├── adapters/
│   │   ├── types.ts             # BackendAdapter interface + types
│   │   ├── versioning.ts        # Version baselines + semver checks
│   │   ├── codex.ts             # Codex CLI adapter
│   │   ├── claude.ts            # Claude Code adapter
│   │   └── gemini.ts            # Gemini CLI adapter
│   ├── core/
│   │   ├── errors.ts            # Error taxonomy + user-facing messages
│   │   ├── executor.ts          # Subprocess execution + timeouts
│   │   ├── session-id.ts        # Session ID regex + parser interface
│   │   └── session-store.ts     # Session mapping + JSON persistence
│   └── ui/
│       ├── banner.ts            # ASCII art header
│       ├── footer.ts            # Completion summary
│       └── theme.ts             # Colors, gradients, capability detection
├── docs/
│   ├── PRD.md                   # This document
│   ├── architecture/            # Design docs
│   └── research/                # Research outputs + CLI verification
└── tests/
    ├── mocks/
    │   └── mock-adapter.ts      # Test adapter implementation
    ├── executor.timeout.test.ts
    └── session-store.test.ts
```

---

## MVP Scope (v0.1.0)

### Included

- [ ] Three backend adapters (Codex, Claude, Gemini)
- [ ] Unified `--resume <id>` flag
- [ ] Session ID extraction and mapping
- [ ] Session persistence to JSON
- [ ] Real-time streaming output
- [ ] Decorated header with backend/mode/session info
- [ ] Decorated footer with duration and resume command
- [ ] CLI availability detection (error if `codex`/`claude`/`gemini` not installed)
- [ ] Maximalist ASCII art banner
- [ ] Graceful degradation for non-color terminals

### Excluded (Future)

- System prompt injection (`--system-prompt`)
- Interactive multi-backend mode (`@claude`, `@gemini` switching)
- Cross-CLI session transfer (continue Codex session in Claude)
- Multi-agent orchestration
- Plugin architecture for additional backends
- Windows support (macOS/Linux only for MVP)

---

## Future Features

Designed for but not implemented in MVP:

### 1. System Prompt Parity

```bash
hyperyolo claude "task" --system-prompt "You are a senior engineer"
hyperyolo codex "task" --system-prompt-file ./prompts/reviewer.md
```

Implementation varies by backend:
- Claude: `--append-system-prompt` (native support)
- Codex: `-c experimental_instructions_file="path"` (experimental)
- Gemini: Prepend to prompt (no native flag yet)

### 2. Interactive Mode

```bash
hyperyolo interactive
> @claude analyze this code
> @gemini now research the best approach
> @codex implement the solution
```

Requires:
- REPL loop with readline
- Backend tag parsing
- Context handoff between backends

### 3. Cross-Session Injection

Continue a session started in one CLI using another:

```bash
hyperyolo claude --resume hyper_abc123 --migrate-from codex
```

Requires:
- Parsing native session storage formats
- Translating conversation history
- Injecting as context into new backend

### 4. Multi-Agent Orchestration

Define workflows where agents call each other:

```yaml
# hyperyolo-workflow.yaml
steps:
  - backend: gemini
    prompt: "Research best practices for auth"
  - backend: claude
    prompt: "Design implementation based on research"
  - backend: codex
    prompt: "Implement the design"
```

---

## Known Limitations

### Per-Backend (from verification)

- **Codex CLI**
  - Tool authorization: no `--yolo`; full auto requires `--dangerously-bypass-approvals-and-sandbox`, which also disables sandboxing. Workaround: use Codex directly with `--full-auto --sandbox read-only` if you need guardrails.
  - Environment guard: exits outside a git repo unless `--skip-git-repo-check` is set. Run inside a repo or add the flag when launching from temp directories.
  - Session resume: invalid IDs silently start a brand-new session. hyperyolo must validate IDs before resuming; if validation fails, start a fresh run.
  - Output format: structured stats only appear with `--json`; text mode is noisy but still emits `session id: ...`. hyperyolo will request JSON; if parsing fails, resume/stats are skipped for that run.
  - Model availability: ChatGPT accounts reject `gpt-4.1-codex`; stick to `gpt-5.1-codex-max` with fallback to `gpt-5.1-codex`.

- **Claude Code CLI**
  - Output format: `--output-format stream-json` requires `--verbose` or the CLI exits 1. hyperyolo always pairs them.
  - Tool authorization: headless `--print` denies Write/Bash without `--dangerously-skip-permissions`; use that flag for unattended runs or run interactively when you want approvals.
  - Session IDs: text output does not include `session_id`; JSON/stream modes are required for resume/stats.
  - Resume handling: invalid `--resume` values error out; stale hyperyolo IDs will fail fast. Start a new session if the underlying session file was pruned.
  - Model availability: default alias `sonnet` maps to `claude-3-7-sonnet-latest`; alternate models can be rejected. Fall back to `sonnet` when validation fails.

- **Gemini CLI**
  - Tool authorization: in headless mode shell/edit/write tools are removed unless `-y/--approval-mode yolo` is set; otherwise `tool_not_registered` errors appear. Use `-y` for automation.
  - Sandbox: `-y` does not enable sandboxing; destructive commands run on host unless `--sandbox`/`GEMINI_SANDBOX` is set.
  - Session IDs/output: default text output lacks session IDs; use `-o stream-json`/`json` for resume/stats. hyperyolo relies on stream JSON.
  - Error surfaces: invalid API keys return `[object Object]` with exit code 144 and drop temp error files under `/var/folders/.../T`.
  - Model availability: `-m auto` resolves to `gemini-2.5-pro` with an internal fallback to `gemini-2.5-flash`; preview models depend on account capabilities.

### hyperyolo Wrapper

- Does not expose provider-specific surfaces (`mcp`, `plugin/extension` management, approval/sandbox/model tuning flags, allowed-tools lists); use the native CLIs for those workflows.
- macOS/Linux only; requires Node 18+ (Gemini CLI needs Node 20+). Windows is unsupported.
- Session store is a single-user JSON file; concurrent runs rely on advisory locks and are not multi-machine safe. Resume will fail if the native CLI has pruned its session file even when hyperyolo still has a mapping.
- Session retention defaults to 30 days; stale IDs are not auto-deleted and may fail to resume. Start a fresh session or prune via `hyperyolo sessions clean`.
- If CLI output formats change or ANSI/TTY quirks block parsing, hyperyolo falls back to streaming without stats/resume for that run; use the native CLI directly when parsing-sensitive features break.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| CLI breaking changes | High | Version documentation, adapter isolation, integration tests |
| CLI not outputting session ID | Medium | Fallback to generating our own, skip resume for that session |
| TTY detection issues | Low | All CLIs have proper headless modes |
| User confusion (thinks hyperyolo is the AI) | Low | Clear messaging that it wraps existing CLIs |
| Native CLI not installed | Low | Detect and show helpful error message |

---

## Success Criteria

### MVP Launch

- [ ] Can run `hyperyolo <backend> "prompt"` for all three backends
- [ ] Can resume sessions with `--resume`
- [ ] Output looks distinctive and polished
- [ ] Works on macOS and Linux
- [ ] Published to npm (`npx hyperyolo`)

### Post-MVP

- [ ] System prompt support for Claude (native) and workarounds for others
- [ ] Interactive mode with backend switching
- [ ] Community adoption / GitHub stars
- [ ] Additional backend adapters via plugins

---

## References

- [AI CLI Comparison Doc](./ai-cli-comparison.md) — Detailed CLI flag documentation
- [Research Analysis](./research/analysis.md) — Comparison of Claude/Gemini/ChatGPT planning outputs
- [Original Prompt](./research/prompt.md) — Initial research prompt
- [Pre-Implementation Plan](./pre-implementation-plan.md) — Readiness checklist, locked decisions, and version baselines
