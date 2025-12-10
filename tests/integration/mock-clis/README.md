# Mock CLIs

Executable shims that mimic Codex, Claude, and Gemini for deterministic integration tests.

- Preferred naming: `codex-mock.js`, `claude-mock.js`, `gemini-mock.js` with `#!/usr/bin/env node`.
- Expected flags/env: `--mode text|json|stream`, `--resume <id>`, `--fail <code>`; env `MOCK_DELAY_MS`, `MOCK_SESSION_ID`, `MOCK_STATS_JSON`, `MOCK_ERROR_MESSAGE`, plus backend-specific toggles (e.g., `MOCK_REQUIRE_GIT`, `MOCK_API_KEY`).
- Emit both stdout and stderr (e.g., `SESSION_ID=<id>` on stderr) so executor tee/ANSI stripping is exercised.
- Keep outputs aligned with fixtures in `tests/fixtures/cli-output/` and the behaviors described in `docs/architecture/integration-testing-strategy.md`.
