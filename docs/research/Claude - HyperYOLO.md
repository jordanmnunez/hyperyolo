# HyperYOLO: Technical architecture for unified AI CLI execution

**Go with Charm/Bubble Tea is the recommended stack** for building HyperYOLO—a maximalist CLI wrapper that unifies Codex CLI, Claude Code, and Gemini CLI. This choice balances the project's core requirements: stunning visual aesthetics, reliable process management, simple distribution, and single-developer maintainability. The architecture uses an adapter pattern with SQLite session storage and a kubectl-style plugin system for future extensibility.

## The case for Go and the Charm ecosystem

After evaluating TypeScript, Rust, Go, and Python against HyperYOLO's specific requirements, **Go with the Charm ecosystem emerges as the clear winner** with a weighted score of 37/40 compared to TypeScript's 32, Rust's 32, and Python's 27.

The Charm ecosystem (Bubble Tea, Lip Gloss, Bubbles) was purpose-built for exactly this use case. Over **4,000 applications** have been built with Bubble Tea, including production tools from AWS, NVIDIA, Microsoft Azure, and CockroachDB. Lip Gloss provides CSS-like declarative styling with full color support, borders, and padding. The Elm-inspired Model-Update-View architecture naturally handles concurrent stream updates without race conditions.

Three factors make Go particularly suited to HyperYOLO:

1. **Process management perfection**: Goroutines and `io.MultiWriter` make the tee pattern trivial to implement—spawning subprocess streams while simultaneously displaying and parsing output requires just a few lines of idiomatic Go code.

2. **Distribution simplicity**: `CGO_ENABLED=0 go build` produces a static binary with zero runtime dependencies. Cross-compilation is built into the toolchain: `GOOS=linux GOARCH=amd64 go build`. No Docker, no complex toolchains, no "works on my machine" issues.

3. **Developer velocity**: Go's simple syntax, `go fmt` enforcement, and fast compile times (~seconds for incremental builds) mean a single developer can iterate quickly. The 3-6 week learning curve to productivity is acceptable for a passion project.

**TypeScript with oclif + Ink is the viable alternative** if you have strong React/TypeScript experience. Claude Code, Gemini CLI, and many Charm-style tools use this exact stack. The `ink-gradient` and `ink-big-text` packages achieve the hyperpop aesthetic with minimal code. However, distribution complexity (Bun compile produces ~50MB binaries with slower startup) and the need to bundle a Node runtime tip the scales toward Go.

## CLI framework architecture with Cobra

**Cobra** is the industry-standard Go CLI framework, powering kubectl, docker, gh CLI, and Hugo. Its hierarchical command structure maps naturally to HyperYOLO's interface:

```
hyperyolo                      # Interactive backend selector
hyperyolo codex "prompt"       # Direct Codex invocation
hyperyolo claude "prompt"      # Direct Claude invocation  
hyperyolo gemini "prompt"      # Direct Gemini invocation
hyperyolo --continue           # Resume last session (any backend)
hyperyolo --resume <id>        # Resume specific session
hyperyolo sessions list        # Session management
```

Cobra's integration with **Viper** provides configuration precedence: command-line flags override environment variables override per-project config override global config override defaults. This is the exact pattern established by professional CLI tools.

The key architectural decision is **argument passthrough**. Each backend CLI has different flag conventions:

| HyperYOLO | Codex CLI | Claude Code | Gemini CLI |
|-----------|-----------|-------------|------------|
| `--continue` | `resume --last` | `--continue` | `/chat resume` |
| `--resume ID` | `resume <ID>` | `--resume <ID>` | `/chat resume <tag>` |
| `--model X` | `--model X` | `-m X` | `-m X` |
| `"prompt"` | positional | `-p "prompt"` | `-p "prompt"` |

The adapter layer translates HyperYOLO's normalized interface to backend-specific arguments using declarative TOML mappings.

## Backend adapter pattern design

The adapter pattern isolates HyperYOLO from the volatility of underlying CLIs. **OpenCode, a similar multi-provider AI CLI tool, was archived in September 2025** after maintaining support for 7+ providers became unsustainable. HyperYOLO's adapter architecture is designed to prevent this fate.

```
┌─────────────────────────────────────────────────────────────┐
│                     HyperYOLO Core                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Unified Interface (BackendAdapter)          │  │
│  │  Execute(prompt, options) → AsyncIterator<Output>     │  │
│  │  ResumeSession(sessionID) → AsyncIterator<Output>     │  │
│  │  IsAvailable() → bool                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                 │
│           ┌───────────────┼───────────────┐                 │
│           ▼               ▼               ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │CodexAdapter │  │ClaudeAdapter│  │GeminiAdapter│         │
│  │ BuildCmd()  │  │ BuildCmd()  │  │ BuildCmd()  │         │
│  │ ParseOutput │  │ ParseOutput │  │ ParseOutput │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

Each adapter implements three responsibilities:

1. **Command building**: Translate HyperYOLO's normalized request into backend-specific CLI arguments. Codex uses `codex exec "prompt" --json`, Claude uses `claude -p "prompt" --output-format stream-json`, Gemini uses `gemini -p "prompt" --output-format stream-json`.

2. **Output parsing**: All three CLIs support JSON output modes. Codex emits JSONL events with types like `item.completed` and `task.completed`. Claude emits stream-json with `type: "result"` containing session_id and cost. Gemini emits newline-delimited JSON events.

3. **Session mapping**: HyperYOLO generates its own UUID session IDs that map to backend-specific identifiers. Codex uses UUIDs, Claude uses UUIDs tied to directory paths, Gemini uses user-defined tags.

## Stream tee pattern for real-time output

The core technical challenge is displaying subprocess output in real-time while simultaneously parsing it for metadata (session IDs, token counts, costs). Go's goroutines and channels solve this elegantly:

```go
func RunWithTee(cmdName string, args []string) (*ParsedOutput, error) {
    cmd := exec.Command(cmdName, args...)
    stdout, _ := cmd.StdoutPipe()
    
    var outputBuf strings.Builder
    result := &ParsedOutput{}
    var wg sync.WaitGroup
    
    cmd.Start()
    
    wg.Add(1)
    go func() {
        defer wg.Done()
        scanner := bufio.NewScanner(stdout)
        for scanner.Scan() {
            line := scanner.Text()
            
            // TEE: Display to terminal with ANSI preserved
            fmt.Println(line)
            outputBuf.WriteString(line + "\n")
            
            // PARSE: Extract metadata from JSON events
            if event, err := parseJSONEvent(line); err == nil {
                if event.SessionID != "" { result.SessionID = event.SessionID }
                if event.TokenCount > 0 { result.TokenCount = event.TokenCount }
            }
        }
    }()
    
    wg.Wait()
    cmd.Wait()
    return result, nil
}
```

**ANSI color handling is critical**. Many CLIs detect non-TTY and disable colors. Solutions include:
- Environment variables: `FORCE_COLOR=1`, `CLICOLOR_FORCE=1`
- CLI-specific flags: Codex's `--color always`
- Respecting `NO_COLOR` for accessibility

For JSON parsing, strip ANSI codes before extraction: `ansiEscape.ReplaceAllString(text, "")`.

## Session management with SQLite

**SQLite beats JSON/YAML** for session storage due to query performance, concurrent access handling, and ACID guarantees. The schema:

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,              -- HyperYOLO UUID
    backend TEXT NOT NULL,            -- 'codex', 'claude', 'gemini'
    backend_session_id TEXT,          -- Backend's native session ID
    model TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_prompt TEXT,
    total_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0.0,
    working_dir TEXT,
    metadata JSON
);
```

The `--continue` flag queries `SELECT * FROM sessions ORDER BY updated_at DESC LIMIT 1`, retrieves the backend adapter, translates the session ID to backend format, and spawns the appropriate CLI with continuation arguments.

## File and folder structure

Following XDG Base Directory conventions established by gh CLI, kubectl, and modern DevOps tools:

```
~/.config/hyperyolo/
├── config.toml              # Main configuration
├── plugins/                 # kubectl-style executable plugins
│   └── hyperyolo-localllm   # Example: local LLM backend
└── themes/                  # Custom color themes

~/.local/share/hyperyolo/
├── sessions.db              # SQLite session database
└── logs/
    └── 2024-12-09.log       # Daily log files

~/.cache/hyperyolo/
└── backend-info.json        # Cached backend availability
```

**Configuration uses TOML** for comments support, explicit typing (no YAML "Norway problem"), and alignment with Rust/Cargo/pyproject.toml conventions:

```toml
[general]
default_backend = "claude"
color_output = true
session_timeout_days = 30

[backends.codex]
enabled = true
executable = "codex"
default_model = "gpt-5-codex"
extra_args = ["--skip-git-repo-check"]

[backends.claude]
enabled = true
default_model = "claude-sonnet-4-20250514"
extra_args = ["--dangerously-skip-permissions"]

[backends.gemini]
enabled = true
default_model = "gemini-2.5-pro"
```

Per-project configuration via `.hyperyolo.toml` in project root overrides global settings.

## Achieving the maximalist hyperpop aesthetic

The Charm ecosystem provides all primitives for the maximalist aesthetic:

**Lip Gloss styling** enables CSS-like declarative design:
```go
var bannerStyle = lipgloss.NewStyle().
    Bold(true).
    Foreground(lipgloss.Color("#FAFAFA")).
    Background(lipgloss.Color("#7D56F4")).
    PaddingTop(1).
    PaddingLeft(2).
    Border(lipgloss.RoundedBorder()).
    BorderForeground(lipgloss.Color("#FF6B6B"))
```

**Gradient text** requires manual implementation via color interpolation—Lip Gloss doesn't have native gradients, but character-by-character coloring achieves the effect.

**Animated spinners** come from the Bubbles component library with presets like dot, globe, moon, and monkey.

**ASCII art banners** render via custom strings or integration with figlet fonts. The aesthetic aims for bold colors (magenta, cyan, hot pink), emoji as structural elements (🔥⚡🚀), rounded Unicode box-drawing characters, and animated loading states during AI "thinking."

For TypeScript/Ink alternative implementation, `ink-gradient` and `ink-big-text` packages achieve similar effects with less code:
```jsx
<Gradient name="vice">
  <BigText text="HYPERYOLO"/>
</Gradient>
```

## MVP feature scope definition

**Phase 1 (Core MVP)**:
- Unified command interface: `hyperyolo <backend> "prompt"`
- Three backend adapters (Codex, Claude, Gemini)
- Real-time output streaming with decorations
- Basic session storage and `--continue` support
- Configuration file support
- Maximalist banner and spinner aesthetics

**Phase 2 (Polish)**:
- Session listing and management commands
- Cost tracking and warnings
- Per-project configuration
- Shell completions (bash/zsh/fish)
- `--json` output mode for scripting

**Phase 3 (Extensibility)**:
- Plugin architecture for additional backends
- Custom themes
- MCP server integration
- Multi-agent orchestration

## Risk assessment for external CLI dependencies

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Breaking API changes** | High | Version-pin CLI dependencies, adapter isolation, integration tests |
| **TTY detection issues** | Medium | Always use non-interactive modes (`codex exec`, `claude -p`, `gemini -p`) |
| **Session format changes** | Medium | Abstract session handling behind adapter interface |
| **CLI deprecation** | Medium | Plugin architecture allows community-maintained adapters |
| **Auth complexity** | Low | Delegate auth entirely to underlying CLIs |
| **Rate limiting** | Low | Pass through to underlying CLIs, optional HyperYOLO warnings |

**Critical findings from target CLI research**:

- **Codex CLI** is written in Rust, requires Git repository by default (override with `--skip-git-repo-check`), and can panic in non-TTY without `codex exec --json`
- **Claude Code** has known bugs with intermittent hanging in stream-json mode
- **Gemini CLI** has the most generous free tier (1000 requests/day) but `-p` mode cannot authorize tools

All three are under active development with weekly releases—expect breaking changes. The adapter pattern provides isolation, and version pinning in documentation protects users.

## Recommended implementation approach

1. **Start with Go + Cobra + Bubble Tea**: Initialize project structure, implement banner/spinner aesthetic
2. **Build Claude adapter first**: Best headless support with `-p` flag, most stable JSON output
3. **Add Codex adapter**: Requires careful TTY handling with `codex exec --json`
4. **Add Gemini adapter**: Tag-based sessions need translation to UUID model
5. **Implement session registry**: SQLite storage with unified ID generation
6. **Polish aesthetics**: Gradients, animations, emoji UI elements
7. **Add configuration**: TOML parsing, XDG paths, per-project overrides
8. **Distribution**: Static binary via `go build`, GitHub releases, Homebrew formula

The **go-cmd library** (`github.com/go-cmd/cmd`) is recommended over raw `os/exec` for thread-safe real-time stdout/stderr streaming without race conditions.

This architecture balances the "correctness and aesthetics over performance" constraint with practical maintainability for a single developer. The plugin system learned from OpenCode's demise ensures HyperYOLO can survive individual backend changes without becoming a maintenance burden.