# Real CLI smoke tests

Opt-in suites that hit the installed Codex/Claude/Gemini binaries.

- Only run when `RUN_REAL_CLI_TESTS=1`; skip with a clear message otherwise.
- Preflight with `which codex|claude|gemini` and abort the suite if any are missing.
- Expect secrets from env (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`); never hardcode or default to live runs.
- Keep scenarios short and cheap: `--version`, one `--json`/`stream-json` prompt, and a resume check. Record any output drift back into `docs/research/cli-verification/*.md`.
