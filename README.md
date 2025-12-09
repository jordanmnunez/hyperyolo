# HyperYOLO

A unified CLI wrapper for autonomous AI code execution. One interface for Codex, Claude Code, and Gemini CLI.

```bash
# Instead of three different syntaxes:
codex exec --yolo "fix the bug"
claude -p "fix the bug" --dangerously-skip-permissions
gemini -p "fix the bug" --yolo

# Use one:
hyperyolo codex "fix the bug"
hyperyolo claude "fix the bug"
hyperyolo gemini "fix the bug"
```

## What It Does

- **Wraps official CLIs** — Runs `codex`, `claude`, and `gemini` as subprocesses
- **Normalizes the interface** — Same syntax for all three backends
- **Maximum autonomy** — Always applies YOLO/full-auto flags
- **Session continuity** — Unified `--resume` flag across all backends
- **Looks good** — Maximalist terminal aesthetic

## What It Doesn't Do

- **Not an API client** — Does not call OpenAI/Anthropic/Google APIs directly
- **Not a reimplementation** — Does not rebuild tool execution, sandboxing, or MCP support
- **Preserves CLI features** — Sandboxing, context compaction, and native session storage all work as designed

## Requirements

- Node.js 18+
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
╔══════════════════════════════════════════════════════════════╗
║  H Y P E R Y O L O                                           ║
║  MAXIMUM AUTONOMOUS EXECUTION                                ║
╚══════════════════════════════════════════════════════════════╝

⚡ BACKEND: Claude Code
⚡ MODE: --dangerously-skip-permissions
⚡ SESSION: hyper_abc123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[streaming output from the underlying CLI]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💥 EXECUTION COMPLETE 💥
Duration: 47.3s | Tokens: 12,847 | Cost: $0.42

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

| HyperYOLO | Codex | Claude | Gemini |
|-----------|-------|--------|--------|
| `"prompt"` | `exec "prompt"` | `-p "prompt"` | `-p "prompt"` |
| `--resume ID` | `resume <id>` | `--resume <id>` | `-r <id>` |
| (auto) | `--yolo` | `--dangerously-skip-permissions` | `-y` |

## Why Wrapper, Not API Client?

Tools like [Crush](https://github.com/charmbracelet/crush) and [Aider](https://github.com/paul-gauthier/aider) call AI APIs directly. They're full implementations with their own tool execution, sandboxing, and session management.

HyperYOLO wraps the official CLIs instead. This preserves:
- Native sandboxing (Gemini's Docker isolation)
- Native context compaction (Claude's summarization)
- Native MCP support
- Native session storage
- Your existing CLI authentication

You get all the work each CLI team has done, with a consistent interface.

## Project Status

**Pre-release** — MVP in development.

See [docs/PRD.md](docs/PRD.md) for the full product requirements document.

## License

MIT
