# Integration tests

Home for always-on mock CLI suites and opt-in smoke tests against the real Codex/Claude/Gemini binaries.

- `mock-clis/`: Node shims exercised by parser/executor integration specs. See `docs/architecture/integration-testing-strategy.md` for behavior to emulate.
- `real-cli/`: Reserved for gated smoke tests; keep these skipped unless `RUN_REAL_CLI_TESTS=1` and binaries are present.
- Fixtures for parsers live in `tests/fixtures/cli-output/` and should be reused across adapters.
- Enable real CLI runs locally/CI with `RUN_REAL_CLI_TESTS=1 npm test`; tests must still skip when binaries or secrets are missing.
