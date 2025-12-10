# HyperYOLO: Product Requirements Document

> A unified CLI wrapper for autonomous AI code execution across Codex, Claude Code, and Gemini CLI.

---

## Overview

HyperYOLO normalizes three AI coding CLIs into a single interface optimized for maximum autonomous execution. It wraps the official CLI tools as subprocesses rather than reimplementing their functionality via APIs.

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

**CLI Wrappers** (HyperYOLO):
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

HyperYOLO preserves all of this by delegating to the real CLIs.

### Existing Tools

- **[Crush](https://github.com/charmbracelet/crush)** — Charm team's multi-provider agent. Uses APIs directly. Successor to OpenCode.
- **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)** — Exposes CLIs as OpenAI-compatible APIs (reverse of HyperYOLO).
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

HyperYOLO always applies maximum settings:

| Backend | YOLO Flag | Model | Other |
|---------|-----------|-------|-------|
| Codex | `--dangerously-bypass-approvals-and-sandbox` | `gpt-5.1-codex-max` | `--skip-git-repo-check` recommended outside git repos |
| Claude | `--dangerously-skip-permissions` | (default) | `--max-turns` unset |
| Gemini | `--yolo` or `-y` | (default) | Auto-sandboxed |

No confirmations, no safety prompts, no iteration limits.

### 3. Session Continuity

Unified `--resume` flag regardless of backend:

```bash
# First run outputs: SESSION: hyper_abc123
hyperyolo claude "analyze the codebase"

# Resume with unified syntax
hyperyolo claude "now fix the issues" --resume hyper_abc123
```

HyperYOLO maintains a session registry mapping its IDs to native CLI session IDs.

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

---

## Architecture

### High-Level Data Flow

```
User: hyperyolo claude "fix the bug" --resume hyper_abc123
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                    HyperYOLO CLI                            │
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

  // Check if CLI is installed
  isAvailable(): Promise<boolean>;

  // Build CLI command arguments
  buildArgs(prompt: string, options: ExecutionOptions): string[];

  // Parse session ID from output stream
  parseSessionId(output: string): string | null;

  // Parse completion stats from output
  parseStats(output: string): ExecutionStats | null;
}

interface ExecutionOptions {
  resumeSessionId?: string;  // Native CLI session ID
  model?: string;            // Override default model
  systemPrompt?: string;     // Future: system prompt injection
}

interface ExecutionStats {
  tokens?: number;
  cost?: number;
  duration: number;
}
```

Adapter requirements for ANSI/parsing:
- HyperYOLO strips ANSI codes and normalizes carriage returns before calling `parseSessionId`/`parseStats`; adapters must not depend on color codes or cursor positioning for parsing.
- `buildArgs` should request parse-friendly output modes (Claude/Gemini `stream-json`, Codex `--json`) to minimize ANSI noise; fall back to colored text only when parsing is explicitly disabled.
- Parser hooks may be stateful/incremental, but should not perform additional ANSI stripping; the executor preserves a raw stream for UI while providing sanitized slices to adapters.

### CLI Argument Translation

| HyperYOLO | Codex | Claude | Gemini |
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

HyperYOLO generates its own ID (`hyper_<8hex>`) and maps to the native ID.

---

## Tech Stack Decision

Research in `docs/research/analysis.md` recommended **Go** for single-binary distribution and minimal runtime friction, but we are committing to **TypeScript/Node** for the MVP.

- **Rationale (why TypeScript now):** Fastest path for the team (existing execa streaming patterns from Beads Runner), direct access to the maximalist npm UI stack (chalk/gradient-string/figlet/boxen/ora), and oclif’s plugin model fits the multi-backend CLI layout without extra scaffolding.
- **Trade-offs we accept:** Requires Node.js 18+, larger packaged size (~50MB with a bundled runtime vs ~10MB Go), slightly slower cold start/higher memory, and distribution via npm/tarballs instead of a single static binary.
- **Benefits realized:** Rapid iteration speed, easy contributor onboarding, and reuse of prior TypeScript utilities outweigh distribution simplicity for our developer audience (who already have Node installed).
- **Future considerations:** Revisit a Go rewrite if installation friction becomes a top complaint, if offline/air-gapped single-binary delivery becomes P0, or if startup/perf constraints tighten. Mitigate meanwhile with optional bundling (`pkg`, `bunx --compile`) to reduce runtime dependency while keeping the TypeScript codebase.

## Tech Stack

### Language: TypeScript

Chosen for:
- Developer familiarity (fastest path to shipping)
- Rich npm ecosystem for CLI aesthetics
- Proven patterns from Beads Runner (`execa` streaming)
- `oclif` plugin architecture for future extensibility

Trade-offs accepted:
- Requires Node.js runtime (users are developers, they have it)
- Larger binary if bundled (~50MB vs ~10MB for Go)
- Slower startup (~200ms vs ~30ms) — negligible for AI tasks

### CLI Framework: oclif

- TypeScript-native
- Plugin architecture built-in
- Subcommand support (`hyperyolo codex`, `hyperyolo claude`, etc.)
- Auto-generated help

### Terminal UI Libraries

| Library | Purpose |
|---------|---------|
| `chalk` | Text coloring (TrueColor support) |
| `gradient-string` | Rainbow/neon gradient text |
| `figlet` | ASCII art banners |
| `boxen` | Bordered boxes |
| `ora` | Animated spinners |
| `execa` | Subprocess management with streaming |

### Session Storage: JSON File

Simple JSON at `~/.config/hyperyolo/sessions.json`:

```json
{
  "hyper_abc123": {
    "backend": "claude",
    "nativeId": "claude-session-xyz",
    "createdAt": "2024-12-09T10:00:00Z",
    "lastPrompt": "fix the bug"
  }
}
```

SQLite considered but unnecessary for MVP. JSON is human-readable and sufficient for single-user session tracking.

### Session Lifecycle and Cleanup

- **Retention**: Keep HyperYOLO session records for 30 days by default (configurable). Stale records generate warnings but are not deleted automatically during a run.
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
│   ├── index.ts                 # Entry point
│   ├── commands/
│   │   ├── codex.ts             # hyperyolo codex
│   │   ├── claude.ts            # hyperyolo claude
│   │   └── gemini.ts            # hyperyolo gemini
│   ├── adapters/
│   │   ├── types.ts             # BackendAdapter interface
│   │   ├── codex.ts             # Codex CLI adapter
│   │   ├── claude.ts            # Claude Code adapter
│   │   └── gemini.ts            # Gemini CLI adapter
│   ├── core/
│   │   ├── executor.ts          # Subprocess execution + streaming
│   │   ├── session.ts           # Session ID mapping + persistence
│   │   └── output.ts            # Output parsing + tee logic
│   └── ui/
│       ├── banner.ts            # ASCII art header
│       ├── footer.ts            # Completion summary
│       └── theme.ts             # Colors, gradients, styles
├── docs/
│   ├── PRD.md                   # This document
│   └── research/                # Research outputs
└── tests/
    └── ...
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

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| CLI breaking changes | High | Version documentation, adapter isolation, integration tests |
| CLI not outputting session ID | Medium | Fallback to generating our own, skip resume for that session |
| TTY detection issues | Low | All CLIs have proper headless modes |
| User confusion (thinks HyperYOLO is the AI) | Low | Clear messaging that it wraps existing CLIs |
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
