# hyperyolo Project Status

Current alignment between the PRD/architecture plans and the implemented code. Use this as the first stop before making changes.

## Alignment Snapshot

| Area | Plan / Expected | Current Code | Gap / Risk |
| --- | --- | --- | --- |
| CLI surface | Expose autonomy by default plus flags for `--resume`, model overrides, timeout controls (`--timeout`, `--idle-timeout`, `--no-timeout`), sandbox passthrough (Gemini), and version-warning overrides. | `src/cli.ts` wires `resume`, `model`, `raw-args`, `--ignore-version-warnings`; no timeout or sandbox flags; global color/verbose flags unused in execution. | Timeouts/sandbox/model fallback knobs from PRD are missing; UX cannot disable/extend timers or request sandboxing. |
| Executor & signals | Streaming tee, absolute/idle timeouts (30m/5m defaults), SIGTERM→SIGKILL grace, signal forwarding, width/color detection feeding UI. | `src/core/executor.ts` implements defaults and timers but is not connected to CLI options; `src/core/signal-handler.ts` exists but never used; no terminal capability detection tied into execution. | No signal forwarding or resize handling in the runtime; timeout configuration is dead code. |
| Adapters | Apply YOLO flags, request stream/json output, translate resume, validate session IDs, detect versions with warnings, and handle model fallback (Codex max→standard, Claude fallback to sonnet, Gemini auto). | `src/adapters/*.ts` add YOLO/stream-json flags and version checks; parse session IDs with regex; no model fallback logic, no CLI capability probing (sandbox/tool limits), no stats/cost parsing beyond tokens/duration. | Missing fallback and capability messaging; resume/stat parsing depends on brittle regex; sandbox/tool expectations from PRD are not surfaced. |
| Session store & resume | JSON store at `~/.config/hyperyolo/sessions.json` with lock/atomic writes, fields for timestamps/lastPrompt/invalid, retention warnings, CLI commands for cleanup. | `src/core/session-store.ts` matches lock/atomic design; `src/commands/shared.ts` only writes `backend`, `nativeId`, `createdAt`; no lastSeen/invalid tracking, no pruning commands, warnings only when locks fail. | Resume metadata is minimal; retention policy and cleanup commands from PRD are absent; session-id parsers in `src/core/session-id.ts` are unused in the run path. |
| Output & UI | Maximalist banner/footer with capability-aware gradients/ASCII fallbacks, always tee raw output, show backend/mode/session/resume hints. | `src/ui/*` implements banner/footer/theme but the CLI uses hand-rolled `printHeader/printFooter` in `src/commands/shared.ts`; no capability detection, no backend mode display. | UI work is unused; current UX is plain and does not reflect the PRD aesthetic or capability tiers. |
| Stats & parsing | Parse session IDs robustly (ring buffer), stats (tokens/duration/cost), warn without failing runs, keep parsing ANSI-agnostic. | `src/core/stream-tee.ts` strips ANSI; adapters parse IDs with simple regex; stats parsing is minimal (no cost, weak JSON parsing). | Missing cost/model reporting; no buffering/flush path from `session-id.ts`; parsing may break on chunked JSON. |
| Testing | Adapter arg/session/stat tests, executor timeout/signal tests, session store concurrency, mock CLIs, version warning behavior. | Tests cover executor timeouts and session store concurrency only. No adapter tests or end-to-end command coverage. | High risk of regressions in adapters/CLI flow; version warning handling untested. |

## Priority Next Steps

1) Wire CLI flags to executor (absolute/idle/no-timeout), add sandbox passthrough for Gemini, and plumb verbose/color through the UI layer.  
2) Integrate `ui/banner` and `ui/footer` into the command path with capability detection (color/unicode/width), showing backend + mode + resume hints.  
3) Adopt `session-id` parsers in the stream path; harden stats parsing (cost/model reporting) and keep resume writes guarded when IDs are missing.  
4) Implement adapter fallbacks and capability messages: Codex max→standard retry, Claude fallback to `sonnet`, Gemini `-m auto` + sandbox/tool warnings.  
5) Enrich session store writes with `lastSeenAt`, `lastPrompt`, `invalid` markers and add a `sessions clean`/`sessions list` command.  
6) Add tests for adapter arg translation, session/stat parsing (chunked fixtures), and a CLI smoke test per backend using mock executables.  
7) Update README/CLI help once the above ship; keep `docs/cli-version-changelog.md` in sync with any parser/flag changes.

## Doc Pointers

- Product direction: `docs/PRD.md`, `docs/pre-implementation-plan.md`
- Architecture: `docs/architecture/` (adapter contract, timeouts, session storage, ANSI handling, etc.)
- Compatibility: `docs/cli-compatibility.md`, `docs/cli-version-changelog.md`
- Research: `docs/research/` (CLI verification, prompts, analysis)
- Design backlog & tasks: keep this status file and `docs/pre-implementation-plan.md` updated as work lands
