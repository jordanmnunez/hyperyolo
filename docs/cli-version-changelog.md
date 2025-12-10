# CLI Version Impact Log

Track CLI releases that affect hyperyolo behavior or supportability. Add a dated entry when the compatibility matrix changes or when a release introduces/removes flags, output formats, or session semantics.

## 2025-12-10 — Baseline lock

- **Codex 0.66.0**
  - Output: `codex-cli 0.66.0`; JSON streaming available via `--json`.
  - Resume accepts invalid ids and silently starts a new session; hyperyolo must validate ids before calling resume.
  - Outside git, requires `--skip-git-repo-check`; without it the CLI exits before starting a session.
- **Claude Code 2.0.62**
  - Output: `2.0.62 (Claude Code)`.
  - `--output-format stream-json` requires `--verbose`; without verbose the CLI exits 1 and emits partial JSON to stderr.
  - Headless writes/bash only work with `--dangerously-skip-permissions`; otherwise tool calls are blocked.
- **Gemini 0.19.3**
  - Output: `0.19.3`.
  - Node 20+ enforced; exits with 144 on auth failures.
  - Headless `-p` without `-y/--approval-mode yolo` strips tools; `-y` does not auto-enable sandboxing.

## How to update this log

1. Capture the new `--version` output for each CLI and add it to the entry.
2. Summarize any flag renames/removals, output format changes, session format changes, or auth flow changes.
3. Update `docs/cli-compatibility.md` with new min/tested versions and blocked ranges if needed.
4. Link any mitigation steps (e.g., fallback flags) so adapters can respond to the regression.
