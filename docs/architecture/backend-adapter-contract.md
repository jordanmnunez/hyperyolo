# Backend Adapter Contract

Canonical interface for mapping HyperYOLO inputs to backend CLIs while keeping streaming, resume, and stats parsing consistent across Codex, Claude Code, and Gemini.

## Interface
Source of truth lives in `src/adapters/types.ts`.

```ts
export interface BackendAdapter {
  name: BackendName;
  sessionIdPattern: RegExp;

  isAvailable(): Promise<{
    available: boolean;
    version?: string;
    error?: string;
  }>;

  buildCommand(prompt: string, options: ExecutionOptions): {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };

  parseSessionId(chunk: string, accumulated: string): string | null;
  parseStats(output: string): ExecutionStats | null;
}
```

- `ExecutionOptions` include `resumeSessionId`, `model`, `systemPrompt`, `outputFormat`, and passthrough `rawArgs`.
- Parsers receive sanitized text (ANSI stripped, `\r` normalized) and may be called many times; they must be idempotent and side-effect free.

## Edge-case expectations
- **Missing session ID**: `parseSessionId` may return `null` forever; executor continues streaming and shows “resume disabled,” and no session record is written.
- **Missing stats**: `parseStats` may return `null`; UI shows “stats unavailable” without failing the run.
- **Availability errors**: `isAvailable` must not throw. Detection failures return `{ available: false, error }`; callers surface the message and mark the backend unavailable.
- **Validation**: `sessionIdPattern` is used to validate parsed IDs and user-supplied resume IDs; adapters should pick the most restrictive regex supported by the CLI.

## CLI-specific quirks to encode
- **Codex**: `resume <id>` comes *after* the prompt (`codex exec "prompt" resume <id>`). Always apply `--yolo` and `--skip-git-repo-check` when present; prefer JSON/stream output when available.
- **Claude Code**: Resume flag precedes the prompt (`--resume <id> -p "prompt"`). Enforce `--dangerously-skip-permissions` and `--output-format stream-json`; tolerate stderr JSON fragments for session IDs.
- **Gemini**: Resume via `-r <id>`; headless `-p` plus `-y` cannot authorize new tools—surface a warning and prefer `-o stream-json` for parsing. If the CLI is pinned to sandbox mode, bubble that limitation via `isAvailable.error`.

### Model selection expectations
- Honor user-supplied `--model` without changes. Surface the effective model in the footer for transparency.
- Codex: default to `gpt-5.1-codex-max`; if the CLI returns “model not supported”, retry with `gpt-5.1-codex` and annotate the downgrade.
- Claude Code: let the CLI resolve its default alias (`sonnet` → latest Sonnet tier). If an explicit model is rejected, retry with `sonnet` and surface the original error.
- Gemini: pass `-m auto` (CLI resolves to `gemini-2.5-pro` or `gemini-3-pro-preview` when preview features are enabled). Rely on the CLI’s built-in fallback to `gemini-2.5-flash` and display whichever model the CLI reports.

## Testing contract
- **Mocks**: `tests/mocks/mock-adapter.ts` provides a lightweight `BackendAdapter` implementation for unit tests (customizable availability, session IDs, and stats). Use it to exercise executor flows without invoking real CLIs.
- **Integration**: Fake CLIs should cover: valid session IDs on stdout/stderr, split/chunked JSON, resume rejection (ID mismatch), and missing-ID cases (ensure no session store write).
- **Validation helpers**: Tests should assert that adapters honor `sessionIdPattern` and never throw from `parseSessionId`/`parseStats` even on malformed output.
