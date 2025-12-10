# hyperyolo - AI Agent Guide

Instructions for AI agents (Claude, Codex, Gemini) working on this codebase.

## Project Overview

hyperyolo is a TypeScript CLI that wraps Codex, Claude Code, and Gemini CLI into a unified interface for autonomous AI execution.

**Key concept**: This is a CLI *wrapper*, not an API client. It spawns the official CLIs as subprocesses and normalizes their interfaces.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **CLI Framework**: Commander (MVP); oclif later if plugin support needed
- **Subprocess**: execa
- **Terminal UI**: chalk, gradient-string, figlet, boxen, ora
- **Testing**: Vitest or Bun test

## Project Structure

```
hyperyolo/
├── src/
│   ├── index.ts                 # Entry point/exports
│   ├── adapters/                # Adapter contracts
│   │   ├── types.ts             # BackendAdapter interface + ExecutionOptions/Stats
│   │   └── versioning.ts        # Version baselines + semver checks
│   └── core/
│       ├── errors.ts            # Error taxonomy + user-facing messages
│       ├── executor.ts          # Subprocess execution + timeouts
│       ├── session-id.ts        # Regex helpers for ID parsing
│       └── session-store.ts     # Session mapping persistence
├── docs/
│   ├── PRD.md                   # Product requirements
│   ├── architecture/            # Design docs (adapter contract, session ID, etc.)
│   └── research/                # Research and planning
└── tests/
    ├── executor.timeout.test.ts
    ├── session-store.test.ts
    └── mocks/mock-adapter.ts
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

Canonical interface (source of truth: `src/adapters/types.ts`):

```typescript
interface BackendAdapter {
  name: 'codex' | 'claude' | 'gemini';
  sessionIdPattern: RegExp;

  isAvailable(): Promise<{ available: boolean; version?: string; error?: string }>;

  buildCommand(prompt: string, options: ExecutionOptions): {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };

  parseSessionId(chunk: string, accumulated: string): string | null;
  parseStats(output: string): ExecutionStats | null;
}
```

- `parseSessionId` receives sanitized chunks and can return `null` indefinitely; caller warns and skips session persistence when no ID is found.
- `parseStats` may return `null` without failing the run; UI shows “stats unavailable.”
- `isAvailable` must not throw—return `{ available: false, error }` on detection failures.
- `sessionIdPattern` validates both parsed IDs and user-supplied resume IDs.

### CLI Argument Translation

| hyperyolo | Codex | Claude | Gemini |
|-----------|-------|--------|--------|
| `"prompt"` | `exec "prompt"` | `-p "prompt"` | `-p "prompt"` |
| `--resume ID` | `resume <id>` (after prompt) | `--resume <id>` (before -p) | `-r <id>` |
| (auto) | `--dangerously-bypass-approvals-and-sandbox` | `--dangerously-skip-permissions` | `-y` |
| (auto) | `--json` | `--output-format stream-json --verbose` | `-o stream-json` |

### Session Management

hyperyolo generates its own session IDs (`hyper_<8hex>`) and maps them to native CLI session IDs:

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
