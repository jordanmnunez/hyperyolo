# hyperyolo Research Analysis: Claude vs Gemini vs ChatGPT

A comparative analysis of three AI research outputs for the hyperyolo project.

---

## Why hyperyolo? (Prior Art Analysis)

### Two Approaches to Multi-Model AI CLIs

**1. API-Based Tools** — These call AI provider APIs directly (OpenAI API, Anthropic API, Google AI API):
- Build their own TUI/interface from scratch
- Implement their own tool execution, file editing, sandboxing
- Can switch models because they're just swapping API endpoints
- Examples: [Crush](https://github.com/charmbracelet/crush) (Charm team), [Aider](https://github.com/paul-gauthier/aider), OpenCode (archived)

**2. CLI Wrappers** — These wrap the official CLI tools (claude, codex, gemini) as subprocesses:
- The official CLIs handle tool execution, sandboxing, context management
- Wrapper just normalizes the interface and parses output
- Preserves all the work the CLI teams put into their tools

### What the Official CLIs Provide

The official CLIs (Claude Code, Codex, Gemini CLI) include features that API-based tools must reimplement from scratch:

| Feature | API-based tools | Official CLIs |
|---------|-----------------|---------------|
| Tool execution | Implement yourself | Built-in |
| Sandbox/safety | Implement yourself | Built-in (e.g., Gemini's Docker sandbox) |
| Session storage | Implement yourself | Native, CLI-managed |
| Context compaction | Implement yourself | Built-in (e.g., Claude's summarization) |
| MCP support | Implement yourself | Native integration |
| Auth/billing | Requires API keys | Uses existing CLI auth |

### Existing Tools

- **[Crush](https://github.com/charmbracelet/crush)** — Charm team's multi-provider AI agent. Uses APIs directly, not a CLI wrapper. Successor to OpenCode.
- **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)** — Exposes CLI tools as OpenAI-compatible APIs (reverse direction from hyperyolo).
- **[ai-code-interface.el](https://github.com/tninja/ai-code-interface.el)** — Emacs-specific unified interface for multiple AI CLIs.

### Where hyperyolo Fits

hyperyolo is a **CLI wrapper**, not an API client. It:
- Runs the official CLIs as subprocesses
- Normalizes the interface (unified `--resume`, consistent YOLO flags)
- Parses output for session IDs and stats
- Lets you pick which CLI runs a given task

This preserves the work each CLI team has done (sandboxing, MCP, tool execution) while providing a consistent interface across all three.

---

---

## Executive Summary

| Dimension | Claude | Gemini | ChatGPT |
|-----------|--------|--------|---------|
| **Language** | Go | Rust | TypeScript/Node |
| **CLI Framework** | Cobra | Clap (implied) | oclif |
| **TUI Library** | Charm/Bubble Tea/Lip Gloss | Ratatui | chalk/figlet/boxen/ora |
| **Session Storage** | SQLite | Sled (embedded KV) | JSON file |
| **Complexity** | Medium | High | Low |
| **Aesthetic Focus** | Balanced | Maximum (glitch art, sixel) | Practical maximalism |

---

## Where They Align (Consensus)

### 1. Adapter Pattern Architecture
All three recommend an **adapter/provider pattern** to abstract backend differences:

- **Claude**: `BackendAdapter` interface with `Execute()`, `ResumeSession()`, `IsAvailable()`
- **Gemini**: `LLMProvider` trait with `start_session()`, `send_input()`, `event_stream()`
- **ChatGPT**: `AIBackendAdapter` interface with `invoke(prompt, resumeId)`

This is unanimous - the abstraction layer is essential.

### 2. Stream Tee Pattern
All agree on the core technical challenge: **display output in real-time while simultaneously parsing it for metadata**.

- **Claude**: Goroutines + `io.MultiWriter` for concurrent stream handling
- **Gemini**: Tokio async runtime with separate UI/Logic/IO threads
- **ChatGPT**: Node streams with async event handlers

### 3. Session ID Mapping
All propose a **hyperyolo-managed session registry** that maps unified IDs to backend-native IDs:

- **Claude**: SQLite with `{id, backend, backend_session_id, ...}`
- **Gemini**: Sled KV store with `session:{uuid}:meta` keys
- **ChatGPT**: JSON file at `~/.config/hyperyolo/sessions.json`

### 4. XDG-Style Config Paths
All follow conventional config directory patterns:

- `~/.config/hyperyolo/` for config
- Platform-appropriate data/cache directories

### 5. MVP Scope Agreement
All define similar MVP boundaries:
- Three backend adapters (Codex, Claude, Gemini)
- Unified `--resume` flag
- Real-time streaming with decorations
- Session persistence
- Maximalist visual output

### 6. Future Feature Deferral
All explicitly defer the same features:
- System prompt parity (partially)
- Interactive multi-backend mode
- Cross-CLI session injection
- Multi-agent orchestration

---

## Where They Diverge

### 1. Language Choice (Major Divergence)

| Opinion | Recommendation | Reasoning |
|---------|----------------|-----------|
| **Claude** | **Go** | "Distribution simplicity" (static binaries), Charm ecosystem maturity (4000+ apps), goroutines for stream handling, 3-6 week learning curve |
| **Gemini** | **Rust** | Zero-cost abstractions, no GC pauses for 60fps rendering, `portable-pty` for TTY spoofing, Ratatui performance benchmarks |
| **ChatGPT** | **TypeScript/Node** | Rich npm ecosystem for CLI aesthetics (chalk, figlet, gradient-string), rapid development, familiar to most developers |

**Analysis:**
- **Claude** prioritizes pragmatism and distribution (single binary, no runtime)
- **Gemini** prioritizes performance and low-level control (PTY manipulation, frame rate)
- **ChatGPT** prioritizes developer velocity and ecosystem richness

### 2. CLI Framework

| Opinion | Framework | Notes |
|---------|-----------|-------|
| **Claude** | Cobra + Viper | "Industry standard" (kubectl, docker, gh), config precedence built-in |
| **Gemini** | (Implied Clap) | Rust ecosystem default, not explicitly discussed |
| **ChatGPT** | oclif | Plugin architecture out-of-box, TypeScript native, supports extensions |

### 3. TUI/Aesthetic Implementation

| Opinion | Approach | Complexity |
|---------|----------|------------|
| **Claude** | Lip Gloss styling, manual gradient interpolation, Bubbles spinners | Medium |
| **Gemini** | Ratatui immediate-mode, custom GlitchParagraph widget, VTE parser, Sixel images, **audio integration** | Very High |
| **ChatGPT** | chalk + gradient-string + figlet + boxen + ora composition | Low |

**Gemini goes furthest** with the maximalist vision:
- Zalgo text (glitch effects with Unicode diacritics)
- Chromatic aberration (RGB offset layers)
- Matrix rain particle systems
- Sixel inline images
- **Sound effects** via rodio crate

**ChatGPT is most pragmatic** - uses proven npm libraries, explicitly avoids Ink/React complexity.

### 4. Session Storage

| Opinion | Storage | Rationale |
|---------|---------|-----------|
| **Claude** | SQLite | Query performance, ACID guarantees, concurrent access |
| **Gemini** | Sled | Lock-free, ordered keys, binary-safe, Rust-native |
| **ChatGPT** | JSON file | Simplicity, human-readable, sufficient for single-user |

### 5. Process Handling Philosophy

| Opinion | Approach |
|---------|----------|
| **Claude** | Standard subprocess with `os/exec`, pipe stdout/stderr |
| **Gemini** | **PTY spoofing** via `portable-pty` to trick CLIs into thinking they're interactive |
| **ChatGPT** | `child_process.spawn` with stdio pipes |

**Gemini's PTY approach is unique** - it argues that some CLIs detect non-TTY and disable features, so spoofing a real terminal is necessary for full compatibility.

### 6. YOLO Mode Implementation

| Opinion | Approach |
|---------|----------|
| **Claude** | Pass-through flags (`--yolo`, `--dangerously-skip-permissions`) |
| **Gemini** | **Heuristic risk engine** - detects confirmation prompts, calculates risk score, auto-approves or pauses |
| **ChatGPT** | Pass-through flags, trust underlying CLI's YOLO mode |

**Gemini proposes the most sophisticated approach:**
- Regex prompt detection (`r"(?i)(allow|confirm|proceed|y\/n)"`)
- Risk matrix scoring (Low < 10, Medium < 50, High > 80)
- Self-healing retry loops on failures

### 7. Risk Assessment Focus

| Opinion | Primary Concerns |
|---------|------------------|
| **Claude** | CLI breaking changes, session format changes, OpenCode's archival as cautionary tale |
| **Gemini** | TTY detection, defensive design bypassing, GC pauses disrupting animations |
| **ChatGPT** | Dependency on underlying CLIs, terminal compatibility, user misunderstanding (thinking hyperyolo IS the AI) |

---

## Unique Ideas Per Source

### Claude Only
- **Kubectl-style plugin system** for future backends
- **Version pinning** documentation strategy
- **`go-cmd` library** recommendation over raw `os/exec`
- Explicit warning about **OpenCode's demise** as architectural lesson

### Gemini Only
- **Virtual Terminal Emulator (VTE) parser** for ANSI stripping
- **Chromatic aberration** text effect
- **Sixel graphics** for inline images/avatars
- **Audio feedback** (success chimes, error static)
- **Directory sandboxing** - creates isolated config dirs per session
- **Self-healing loops** - feeds errors back to model for retry

### ChatGPT Only
- **Lazy loading** of figlet/gradient libs for startup performance
- **Terminal width detection** with graceful degradation
- **Bell character** (`\x07`) for audio notification
- Explicit **GPL/AGPL license** recommendation for copyleft protection
- Most detailed **error message** UX (e.g., "Codex CLI not found - please install it")

---

## Recommendation Matrix

| If you prioritize... | Choose... | Because... |
|----------------------|-----------|------------|
| **Fastest MVP** | ChatGPT (TypeScript) | Richest ecosystem, lowest friction, familiar to most |
| **Best distribution** | Claude (Go) | Single static binary, no runtime dependency |
| **Maximum aesthetic** | Gemini (Rust) | 60fps rendering, glitch effects, images, audio |
| **Plugin extensibility** | Claude (oclif) or ChatGPT | Both have mature plugin systems |
| **Low-level control** | Gemini (Rust) | PTY spoofing, zero-cost abstractions |

---

## Synthesis: A Recommended Hybrid Approach

Based on the analysis, here's a synthesized recommendation:

### Language: **Go** (Claude's recommendation)
- Single binary distribution is a killer feature for CLI tools
- Charm ecosystem is battle-tested and specifically designed for this use case
- Learning curve is acceptable for a passion project
- TypeScript/Node would be viable alternative if Go is unfamiliar

### Architecture: **Adapter pattern** (unanimous)
- `BackendAdapter` interface per Claude's design
- SQLite session storage (over JSON for query capability, over Sled for simplicity)
- XDG-compliant config paths

### Aesthetic: **Layered approach**
- Start with Lip Gloss basics (Claude)
- Add gradient text and ASCII art (all three)
- **Consider** Gemini's glitch effects as Phase 2 polish
- Skip audio/Sixel for MVP (too complex, not cross-terminal)

### YOLO Implementation: **Pass-through first** (Claude/ChatGPT)
- Rely on underlying CLI's YOLO modes
- Gemini's heuristic engine is fascinating but over-engineered for MVP
- Revisit if we encounter CLIs that need prompt interception

### Session Management: **SQLite** (Claude)
- More robust than JSON
- Simpler than Sled
- Supports future queries (list sessions, cleanup old ones)

### MVP Scope: **Convergent agreement**
1. Three backend adapters
2. Unified `--resume <id>` interface
3. Real-time streaming with tee pattern
4. Session registry with SQLite
5. Maximalist header/footer decorations
6. Basic error handling and CLI detection

---

## Open Questions for Decision

1. **Go vs TypeScript?** - Both are viable. Go for distribution, TS for ecosystem.

2. **How aggressive on aesthetics?** - Gemini's vision is compelling but complex. Start conservative?

3. **PTY spoofing needed?** - Test if standard pipes work. Only add PTY if CLIs misbehave.

4. **Plugin architecture in MVP?** - Claude suggests yes (future-proofing), ChatGPT defers. Lean towards minimal plugin hooks now.

5. **License?** - ChatGPT suggests GPL for copyleft. Confirm this aligns with goals.

---

*Analysis generated from three independent AI research outputs on the hyperyolo project specification.*
