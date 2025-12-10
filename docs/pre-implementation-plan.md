# Pre-Implementation Plan and Readiness

This document locks in the research outputs and decisions needed before writing code for HyperYOLO. It summarizes verified CLI behaviors, architectural choices, and the version baselines we will target. Use it as the starting checklist for implementation.

## Readiness Checklist

| Item | Status | Evidence |
|------|--------|----------|
| CLI verification for all backends | Ready | Codex 0.66.0 (`docs/research/cli-verification/codex.md`), Claude 2.0.62 (`docs/research/cli-verification/claude.md`), Gemini 0.19.3 (`docs/research/cli-verification/gemini.md`) |
| Documentation structure | Ready | `docs/research/cli-verification/` contains per-CLI reports and schemas |
| Architecture decisions | Ready | Locked below (runtime, storage, streaming, parsing, error handling) |
| Version baselines | Ready | See compatibility matrix below |
| Implementation path | Ready | See implementation plan below |

## Locked Decisions (with rationale)

- **Runtime and CLI framework**: TypeScript on Node 18+ with Commander for the MVP. Keeps the CLI surface light and fastest to ship; migrate to oclif later if user-installable plugins become required (`docs/architecture/cli-framework-decision.md`).
- **Subprocess execution**: `execa` in streaming mode. Tee stdout/stderr to (a) terminal passthrough and (b) parser pipeline. Honor backpressure by writing chunks directly to `process.stdout`/`stderr` without buffering beyond parser needs.
- **Timeouts**: Default absolute timeout 30m per run (configurable flag); idle timeout 5m of no output triggers a graceful kill. Strategy: send SIGTERM, wait 5s, then SIGKILL; surface a clear timeout error with partial session info.
- **Signal handling**: Forward SIGINT/SIGTERM to child; stop accepting new output, flush session mapping, then exit with the child’s code (or 130 for Ctrl+C). Document that SIGKILL cannot be trapped.
- **Session storage**: JSON at `~/.config/hyperyolo/sessions.json` (per PRD). Use a lockfile (e.g., `proper-lockfile`) plus atomic temp-write-and-rename to avoid corruption when multiple HyperYOLO instances run. Chosen to avoid native deps for the small MVP dataset; migrate to SQLite only if we later need filtered queries over large record sets (`docs/architecture/session-storage.md`).
- **Session cleanup/expiration**: Keep sessions for 30 days by default; add a manual `sessions clean --older-than <duration>` command later. Do not auto-delete within a run; warn when the store exceeds a size threshold (e.g., >5 MB).
- **Adapter contract**: Keep `BackendAdapter` as defined in `docs/PRD.md` with `isAvailable`, `buildArgs`, `parseSessionId`, `parseStats`. All adapters must expose their version detection command and default model.
- **Output format selection**:
  - Claude: always request `-p --output-format stream-json --verbose` for resume/parse; fall back to `--output-format json` if stream-json is unavailable.
  - Gemini: use `-o stream-json -y` (or `--approval-mode yolo`), explicitly add `--sandbox` only when requested.
  - Codex: use `--json --skip-git-repo-check` by default for parseable events; allow text mode only for pass-through runs where parsing is disabled.
- **Session ID extraction**:
  - Claude: `system` init event field `session_id` from stream JSON.
  - Gemini: `init` event `session_id` in stream JSON; buffer the first few lines until init arrives, then stream through.
  - Codex: banner line `session id: <uuid>` in text mode; `thread.started.thread_id` in JSON mode. Buffer the first chunk to catch it, then parse incrementally.
  - Fallback: if no ID is found within the first 20 lines/5s, generate a `hyper_<random>` ID, mark resume as unavailable for that run, and warn.
- **ANSI and parsing**: Parser pipeline uses `strip-ansi` before regex/JSON parsing; terminal path keeps raw output. Respect `NO_COLOR`/`FORCE_COLOR` and degrade to ASCII boxes when color/unicode are unavailable.
- **Terminal capability detection**: Use `supports-color` (via chalk) and `is-unicode-supported`; choose gradients/box drawing/emoji only when supported. Handle `SIGWINCH` to recompute widths.
- **Error handling**: Categorize errors into CLI availability (ENOENT/EACCES), auth failures, timeout/interrupt, parse failures, session lookup failures, and filesystem issues. Present actionable remedies (install/auth commands already in README).
- **Testing approach**: Vitest/Bun tests with mock CLI shims that emit scripted stream events; unit tests for adapters (arg building, session parsing) plus integration tests gated behind real CLI availability.

## Version Compatibility Matrix

| CLI | Version command | Min supported (current) | Tested version | Model defaults/highest tier | Known notes |
|-----|-----------------|-------------------------|----------------|-----------------------------|-------------|
| Codex | `codex --version` | 0.66.0 | 0.66.0 | Default `gpt-5.1-codex-max`; if rejected, fall back to `gpt-5.1-codex`. Highest tier observed: `gpt-5.1-codex-max`. | No `--yolo`; default text banner; `--json` gives events; `--skip-git-repo-check` required outside a git repo; invalid resume silently creates a new session. |
| Claude Code | `claude --version` | 2.0.62 | 2.0.62 | Default alias `sonnet` (maps to the latest Sonnet tier; current install resolves to `claude-3-7-sonnet-latest`); aliases `opus/sonnet/haiku` track the latest tier in each family. Opus requires the appropriate account tier. | `--output-format stream-json` requires `--verbose`; `--dangerously-skip-permissions` needed for headless writes; session IDs are UUIDv4. |
| Gemini CLI | `gemini --version` | 0.19.3 (Node 20+) | 0.19.3 | Default `auto` resolves to `gemini-2.5-pro` (or `gemini-3-pro-preview` when preview features are enabled); CLI fallback mode downgrades to `gemini-2.5-flash`. | `--yolo` does not auto-sandbox; headless without YOLO strips tools; `--resume` accepts UUID/index/latest; invalid API key exits with code 144. |

Monitoring plan: on startup, adapters parse the version output and warn if below the min supported; allow override with a `--ignore-version-warnings` flag for advanced users.

## Implementation Plan (order of execution)

1. Scaffold the Commander entrypoint (`src/index.ts` or `src/cli.ts`, backend subcommands) and shared types.
2. Implement session store module (JSON path resolution, locking, atomic writes, in-memory cache).
3. Build the executor with streaming tee, ANSI-aware parser branch, timeout/idle handling, and signal forwarding.
4. Implement adapters for Codex/Claude/Gemini using the format selection and ID parsing rules above; include version checks and helpful not-found errors.
5. Render UI components (banner/footer/theme) with capability detection fallbacks.
6. Add CLI-level commands/flags (`--resume`, `--timeout`, `--no-timeout`, `--ignore-version-warnings`, `--sandbox` passthrough for Gemini).
7. Write tests: adapter unit tests with fixture outputs, executor timeout/signal tests with mock CLIs, session store concurrency tests with parallel writes.
8. Add docs updates for any implementation deviations and wire the version warning behavior into README/PRD.

## Residual Risks and Mitigations

- **CLI breaking changes**: Mitigate with the version matrix above and adapter-isolated parsing; record unexpected events to debug logs for future schema updates.
- **Session store contention**: Lockfile + atomic writes reduce risk; add jittered retry for lock acquisition.
- **Timeout false positives**: Surface the last output timestamp and allow opt-out/longer timeouts for very long jobs.
- **Tool authorization quirks**: Gemini’s default tool filtering and Codex’s lack of `--yolo` require clear footer messaging about the actual mode used.

With these decisions and guardrails in place, the codebase is ready to move from research into implementation.
