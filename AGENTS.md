# HyperYOLO - AI Agent Guide

Instructions for AI agents (Claude, Codex, Gemini) working on this codebase.

## Project Overview

HyperYOLO is a TypeScript CLI that wraps Codex, Claude Code, and Gemini CLI into a unified interface for autonomous AI execution.

**Key concept**: This is a CLI *wrapper*, not an API client. It spawns the official CLIs as subprocesses and normalizes their interfaces.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **CLI Framework**: oclif
- **Subprocess**: execa
- **Terminal UI**: chalk, gradient-string, figlet, boxen, ora
- **Testing**: Vitest or Bun test

## Project Structure

```
hyperyolo/
├── src/
│   ├── index.ts                 # Entry point
│   ├── commands/                # oclif commands
│   │   ├── codex.ts
│   │   ├── claude.ts
│   │   └── gemini.ts
│   ├── adapters/                # Backend CLI adapters
│   │   ├── types.ts             # BackendAdapter interface
│   │   ├── codex.ts
│   │   ├── claude.ts
│   │   └── gemini.ts
│   ├── core/
│   │   ├── executor.ts          # Subprocess execution
│   │   ├── session.ts           # Session ID mapping
│   │   └── output.ts            # Output parsing
│   └── ui/
│       ├── banner.ts            # ASCII art header
│       ├── footer.ts            # Completion summary
│       └── theme.ts             # Colors and styles
├── docs/
│   ├── PRD.md                   # Product requirements
│   └── research/                # Research and planning
└── tests/
```

## Key Commands

```bash
npm run dev                      # Run in development
npm run build                    # Build for production
npm test                         # Run tests
npm run lint                     # Lint code
```

## Architecture

### Backend Adapter Interface

Each adapter must implement:

```typescript
interface BackendAdapter {
  name: 'codex' | 'claude' | 'gemini';
  isAvailable(): Promise<boolean>;
  buildArgs(prompt: string, options: ExecutionOptions): string[];
  parseSessionId(output: string): string | null;
  parseStats(output: string): ExecutionStats | null;
}
```

### CLI Argument Translation

| HyperYOLO | Codex | Claude | Gemini |
|-----------|-------|--------|--------|
| `"prompt"` | `exec "prompt"` | `-p "prompt"` | `-p "prompt"` |
| `--resume ID` | `resume <id>` (after prompt) | `--resume <id>` (before -p) | `-r <id>` |
| (auto) | `--yolo` | `--dangerously-skip-permissions` | `-y` |
| (auto) | — | `--output-format stream-json` | `-o stream-json` |

### Session Management

HyperYOLO generates its own session IDs (`hyper_<8hex>`) and maps them to native CLI session IDs:

```json
{
  "hyper_abc123": {
    "backend": "claude",
    "nativeId": "claude-native-session-xyz",
    "createdAt": "2024-12-09T10:00:00Z"
  }
}
```

Stored at `~/.config/hyperyolo/sessions.json`.

## Code Patterns

### Adding a New Backend Adapter

1. Create `src/adapters/<name>.ts` implementing `BackendAdapter`
2. Add command in `src/commands/<name>.ts`
3. Register in the adapter registry
4. Add tests

### Output Streaming

Use execa with streaming to tee output:
- Display to terminal in real-time
- Parse for session ID and stats
- Don't block on parsing

### Error Handling

- Check if CLI binary exists before spawning
- Handle subprocess exit codes
- Parse stderr for error messages
- Show helpful errors ("Codex CLI not found - please install it")

## Testing

Mock the underlying CLIs by:
- Creating fake executables that output known patterns
- Testing adapter parsing logic in isolation
- Integration tests with real CLIs (optional, CI-gated)

## Documentation

- `docs/PRD.md` — Full product requirements
- `docs/ai-cli-comparison.md` — Detailed CLI flag reference
- `docs/research/` — Research outputs and analysis

## Important Notes

1. **Non-interactive by default** — No prompts, no confirmations
2. **Maximum autonomy** — Always apply YOLO/full-auto flags
3. **Preserve CLI output** — Stream through, don't filter
4. **Maximalist aesthetic** — Bold colors, ASCII art, emoji
5. **Graceful degradation** — Work in non-color terminals
