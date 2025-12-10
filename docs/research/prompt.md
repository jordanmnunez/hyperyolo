# hyperyolo: Deep Research & Planning Prompt

## Mission

Design and plan **hyperyolo** — a CLI wrapper that unifies Codex, Claude Code, and Gemini CLI into a single, normalized interface for maximum autonomous AI execution. The goal is to create a tool that is both technically excellent and aesthetically obnoxious in the best possible way.

---

## What We're Building

hyperyolo is a meta-CLI that:

1. **Normalizes three AI CLIs** (Codex, Claude Code, Gemini) into one consistent interface
2. **Always runs at maximum power** — highest model tier, highest reasoning effort, no safety guardrails, full autonomous execution
3. **Provides session continuity** across invocations via a unified `--resume` flag
4. **Is non-interactive by default** — fire and forget, get results

The name says it all: this is YOLO mode cranked to 11. No confirmations, no hand-holding, no apologies.

---

## Known CLI Behaviors (Research Foundation)

We have already documented the three target CLIs extensively. Here's what we know:

### Codex CLI

**Autonomous execution:**
```bash
codex exec --yolo "prompt"
```

**Session resume:**
```bash
codex exec --yolo "follow-up" resume <session-id>
```
- `resume` keyword goes AFTER the prompt
- Session ID printed in startup output
- Sessions stored in `~/.codex/sessions/` as JSONL

**Key flags:**
- `--yolo` — auto-approve all tool calls
- `--model <name>` — model selection (default: `gpt-5.1-codex-max`)
- `-c key=value` — config overrides
- `-c experimental_instructions_file="path"` — system prompt (experimental, may reject)

**System prompt:** Uses `AGENTS.md` in repo root (auto-loaded), or experimental config override

**Output:** Streams to stdout by default, includes session ID in header

---

### Claude Code CLI

**Autonomous execution:**
```bash
claude -p "prompt" --dangerously-skip-permissions
```

**Session resume:**
```bash
claude --resume <session-id> -p "follow-up"
claude --continue -p "follow-up"  # most recent session
```
- Flags go BEFORE the `-p` prompt
- `--continue` / `-c` for most recent (no ID needed)
- `--resume` / `-r` for specific session ID
- Session ID available in JSON output

**Key flags:**
- `-p, --print <prompt>` — non-interactive mode
- `--dangerously-skip-permissions` — YOLO equivalent
- `--output-format json|stream-json` — structured output
- `--max-turns N` — iteration limit
- `--allowedTools "Tool1,Tool2"` — tool restrictions
- `--append-system-prompt "..."` — add system instructions
- `--system-prompt-file <path>` — system prompt from file

**System prompt:** Full support via `--append-system-prompt` or `--system-prompt-file`, plus `CLAUDE.md` in repo

**Output formats:**
- Plain text (default)
- JSON (`--output-format json`) — includes `session_id`, `total_cost_usd`, `result`
- Stream JSON (`--output-format stream-json`) — newline-delimited events

---

### Gemini CLI

**Autonomous execution:**
```bash
gemini -y "prompt"
gemini -p "prompt" --yolo
```

**Session resume:**
```bash
gemini -y "follow-up" -r <session-id>
```
- `-r` flag for resume
- Session ID from `stream-json` output's `init` event
- Sessions stored in `~/.gemini/tmp/<project-hash>/`

**Key flags:**
- `-p <prompt>` — non-interactive/headless mode
- `-y, --yolo` — auto-approve all tool calls
- `-m, --model <name>` — model selection
- `-o, --output-format json|stream-json` — structured output
- `-r, --resume <session-id>` — session resume
- `-s, --sandbox` — Docker sandbox (auto-enabled in YOLO mode)
- `--allowed-tools "..."` — tool restrictions
- `--approval-mode yolo|auto_edit|default` — approval behavior
- `--checkpointing` — save snapshots before file changes

**System prompt:** No CLI flag yet — uses `GEMINI.md` files only

**Output formats:**
- Plain text (default)
- JSON (`-o json`)
- Stream JSON (`-o stream-json`) — includes `{"type":"init","session_id":"..."}` event

**Safety note:** YOLO mode auto-enables Docker sandbox by default

---

## Desired hyperyolo Interface

### Basic Usage

```bash
# Run with specific backend
hyperyolo gemini "analyze this codebase and fix all bugs"
hyperyolo claude "refactor the authentication system"
hyperyolo codex "add comprehensive test coverage"

# Resume a session
hyperyolo gemini "continue the refactor" --resume <session-id>
hyperyolo claude "what did you change?" --resume <session-id>
```

### Expected Behavior

1. **Backend selection** — first argument selects which CLI to wrap
2. **Prompt** — passed through to the underlying CLI
3. **Session resume** — unified `--resume <id>` flag, regardless of backend
4. **Maximum settings** — automatically applies:
   - Highest available model tier
   - Highest reasoning effort
   - All safety bypasses (YOLO/dangerously-skip-permissions)
   - No iteration limits
   - Full tool access
5. **Streaming output** — real-time output from the underlying CLI
6. **Session ID extraction** — parse and surface session IDs in a consistent format

### Output Normalization

hyperyolo should normalize output to provide:
- Clear indication of which backend is running
- Consistent session ID format (for use with `--resume`)
- Pass-through of the actual CLI output
- Summary statistics (tokens, duration, cost if available)

---

## Future Features (Design For, Don't Build Yet)

The architecture should accommodate these future capabilities without implementing them now:

### 1. System Prompt Parity
```bash
hyperyolo claude "task" --system-prompt "You are a senior engineer"
hyperyolo codex "task" --system-prompt-file ./prompts/reviewer.md
```
- Normalize system prompt injection across all backends
- For backends without native support, prepend to prompt or use workarounds

### 2. Interactive Mode with Backend Switching
```bash
hyperyolo interactive
> @gemini analyze this code
> @claude now review gemini's analysis
> @codex implement the suggested changes
```
- Tag-based backend switching within a session
- Automatic backend selection based on task type or rules engine
- Shared context/handoff between backends

### 3. Cross-CLI Session Injection
- Parse session data from one CLI's storage format
- Inject/translate into another CLI's session format
- Enable "continue this Codex session in Claude" workflows

### 4. Multi-Agent Orchestration
- Define patterns for agents to call each other
- Codex spawns Claude for code review, Claude spawns Gemini for research
- DAG-based or conversational agent coordination

---

## Brand & Aesthetic Direction

**hyperyolo is obnoxious maximalist.** Think hyperpop but for developer tools.

### Vibe References
- **Hyperpop music** — 100 gecs, SOPHIE, Charli XCX — overwhelming, glitchy, unapologetic excess
- **Maximalist design** — more is more, gradients on gradients, emoji as punctuation
- **Vaporwave/Y2K aesthetics** — but cranked to absurd levels
- **Meme energy** — self-aware, irreverent, fun

### What This Means for the CLI
- **Bold, colorful output** — not boring monochrome terminal text
- **Animated spinners/progress** — make waiting feel exciting
- **Playful language** — "ENGAGING MAXIMUM YOLO" not "Starting execution..."
- **Sound effects?** — terminal bells, maybe optional audio cues
- **ASCII art** — logo, status indicators, celebration on completion
- **Emoji as UI elements** — 🚀💥⚡🔥 used meaningfully, not sparingly
- **Gratuitous but good** — flashy AND functional

### Example Output Aesthetic

```
╔══════════════════════════════════════════════════════════════╗
║  ██╗  ██╗██╗   ██╗██████╗ ███████╗██████╗ ██╗   ██╗ ██████╗  ║
║  ██║  ██║╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗╚██╗ ██╔╝██╔═══██╗ ║
║  ███████║ ╚████╔╝ ██████╔╝█████╗  ██████╔╝ ╚████╔╝ ██║   ██║ ║
║  ██╔══██║  ╚██╔╝  ██╔═══╝ ██╔══╝  ██╔══██╗  ╚██╔╝  ██║   ██║ ║
║  ██║  ██║   ██║   ██║     ███████╗██║  ██║   ██║   ╚██████╔╝ ║
║  ╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝  ║
║                                                              ║
║           🔥 MAXIMUM AUTONOMOUS EXECUTION 🔥                 ║
╚══════════════════════════════════════════════════════════════╝

⚡ BACKEND: Claude Code (claude-opus-4)
⚡ MODE: --dangerously-skip-permissions (YOLO ENGAGED)
⚡ SESSION: hyper_7f3a2b1c

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[claude output streams here in real-time]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💥 EXECUTION COMPLETE 💥

   Duration: 47.3s
   Tokens: 12,847
   Cost: $0.42

   Resume this session:
   hyperyolo claude --resume hyper_7f3a2b1c "continue"

🚀🚀🚀 HYPERYOLO OUT 🚀🚀🚀
```

---

## Research Questions

The plan should answer:

### Language & Framework
1. **What language should hyperyolo be written in?**
   - Consider: TypeScript/Node, Rust, Go, Python
   - Weigh: ecosystem (npm for CLI tools), performance, developer experience, terminal UI libraries

2. **What CLI framework should we use?**
   - Consider: Commander.js, oclif, clap (Rust), cobra (Go), Click (Python)
   - Weigh: argument parsing, plugin architecture, subcommand support

3. **What terminal UI library for the maximalist aesthetic?**
   - Consider: Ink (React for terminals), Charm/Bubbletea (Go), Rich (Python), crossterm (Rust)
   - Weigh: animation support, color gradients, layout flexibility, ASCII art rendering

### Architecture
4. **How should we structure the backend adapters?**
   - Interface/trait for each CLI wrapper
   - How to handle the different argument syntaxes
   - Output parsing and normalization strategy

5. **How should we handle session ID mapping?**
   - Store our own session registry?
   - Map hyperyolo IDs to underlying CLI session IDs?
   - Format: `hyper_<short-id>` → `{backend: "claude", native_id: "abc123..."}`

6. **How should we stream output while also parsing it?**
   - Tee the output stream
   - Parse for session IDs, stats, errors
   - Pass through to user in real-time

7. **Configuration and defaults**
   - Where to store config (`~/.hyperyolo/config.toml`?)
   - Per-backend model preferences
   - Custom "maximum" settings per backend

### Future-Proofing
8. **Plugin architecture for future backends?**
   - What if we want to add Cursor, Aider, OpenHands, etc.?
   - How to make backend adapters pluggable

9. **How to design for interactive mode?**
   - State machine for backend switching
   - Context sharing between backends
   - Input parsing for `@backend` tags

10. **How to design for cross-session injection?**
    - Session format translation
    - What context needs to be preserved
    - API vs file-based session storage

---

## Constraints

- **Non-interactive first** — the MVP is fire-and-forget batch execution
- **Works on macOS and Linux** — Windows support is not required initially
- **Requires underlying CLIs installed** — hyperyolo doesn't bundle them
- **No performance optimization** — correctness and aesthetics over speed
- **Single developer initially** — architecture should be understandable by one person

---

## Deliverables Expected from This Research

1. **Recommended tech stack** with justification
   - Language, CLI framework, terminal UI library
   - Build tooling, testing approach

2. **Architecture diagram**
   - Component breakdown
   - Data flow for a typical execution
   - Session management approach

3. **Backend adapter interface design**
   - What each adapter must implement
   - How to normalize inputs and outputs

4. **File/folder structure**
   - Project layout
   - Where adapters, UI components, config live

5. **MVP feature scope**
   - What's in v0.1.0
   - What's explicitly deferred

6. **Aesthetic implementation plan**
   - How to achieve the maximalist look
   - Specific libraries/techniques for visual effects

7. **Risk assessment**
   - What could go wrong
   - Dependencies on external CLI behavior
   - Breaking change vulnerabilities

---

## Context: Why This Exists

hyperyolo is born from the observation that:

1. **AI coding CLIs are converging** — Codex, Claude, Gemini all do similar things with different interfaces
2. **Power users want maximum autonomy** — we trust the AI, skip the confirmations
3. **Session continuity is fragmented** — each CLI has different resume semantics
4. **The tools take themselves too seriously** — developer tools can be fun

This is a tool for developers who want to:
- Fire off AI tasks and walk away
- Not remember three different CLI syntaxes
- Resume any session with one consistent command
- Enjoy using their terminal

---

## Final Note

This prompt is for deep research and planning. The output should be a comprehensive plan that someone could pick up and implement. Be opinionated about the tech choices — we want strong recommendations, not "it depends."

The plan should make someone excited to build this thing.

Now go design something that's technically excellent AND makes people smile when they use it. 🚀💥⚡
