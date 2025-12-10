# Integration Testing Strategy

How hyperyolo will validate end-to-end behavior across adapters, the executor, and real backend CLIs.

## Objectives
- Prove adapter argument building and parsing without hitting live CLIs.
- Exercise streaming/timeout/session persistence paths with deterministic shims.
- Catch regressions from upstream CLI releases with opt-in smoke tests.

## Test layers
- **Unit/contract (always on)**: adapter `buildCommand`/`parseSessionId`/`parseStats` against fixtures, session-store concurrency, executor timeout/signal handling.
- **Mock CLI integration (always on)**: run Node shims in `tests/integration/mock-clis/` to emulate each backend. Cover streaming tee, session ID capture in the first chunk, stats parsing, resume mapping, timeout/idle handling, ANSI stripping, and error exit codes. Shims configurable via env/args for delays/errors/resume ID injection.
- **Real CLI smoke (opt-in)**: only when binaries exist and `RUN_REAL_CLI_TESTS=1`. Cover happy-path `--json`/`stream-json`, resume semantics, YOLO flags, and version warning UX. Use `describe.skipIf` guards to keep CI fast when unavailable.
- **CLI surface audits (docs only)**: compare `--help`/`--version` outputs to docs to spot drift; no assertions needed in code.

## Mock CLI specification
- Baseline: Node executables under `tests/integration/mock-clis/` with `#!/usr/bin/env node`.
- Common controls: flags `--mode text|json|stream`, `--resume <id>`, `--fail <code>`; env `MOCK_DELAY_MS`, `MOCK_SESSION_ID`, `MOCK_STATS_JSON`, `MOCK_ERROR_MESSAGE`. Emit stdout/stderr to exercise the tee path.
- Codex shim: banner plus `session id: <uuid>` for text; JSONL events `thread.started`, `turn.started`, `item.completed`, `turn.completed`; optional git-guard failure when `MOCK_REQUIRE_GIT=1`.
- Claude shim: require `--verbose` when `--output-format stream-json`; emit `system` init with `permissionMode` + tools, then `assistant` and `result`; exit 1 with `No conversation found...` when resume ID is `invalid`.
- Gemini shim: always emit an `init` event first with `session_id`; allow tool-use/tool-result pairs; exit 144 when `MOCK_API_KEY=invalid`; accept `--approval-mode`/`-y` flags even if ignored.
- All shims should write a `SESSION_ID=` line to stderr for debugging and return meaningful exit codes for executor assertions.

## Sample outputs from verification runs
Fixtures pulled from the research tasks live under `tests/fixtures/cli-output/`:
- `tests/fixtures/cli-output/codex/text-banner.txt` — default text banner with the `session id:` line.
- `tests/fixtures/cli-output/codex/json-events.jsonl` — JSONL event set for `--json`.
- `tests/fixtures/cli-output/claude/stream-json.jsonl` — `system` init + assistant + result stream.
- `tests/fixtures/cli-output/gemini/stream-json.jsonl` — `init` + tool-use/responses from a headless YOLO run.
Adapters and parsers can consume these fixtures directly in Vitest assertions.

## Execution in CI
- Default `npm test` runs unit + mock CLI suites; mock shims ship in-repo to avoid network/auth.
- Real CLI suites run when `RUN_REAL_CLI_TESTS=1` and binaries are present (`which codex`, `which claude`, `which gemini`). Tests should skip with a clear message when prerequisites are absent.
- Secrets for real runs come from CI env vars; do not fail when missing—log a skip reason instead.
- Record notable output deltas from real runs in `docs/research/cli-verification/*.md` to keep fixtures aligned with shipped versions.

## Directory layout
```
tests/
  integration/
    mock-clis/        # executable shims used by always-on integration suites
    real-cli/         # (future) opt-in smoke tests exercising installed CLIs
  fixtures/
    cli-output/       # captured outputs from verification runs for parser tests
```
