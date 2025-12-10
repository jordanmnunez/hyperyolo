# CLI Version Compatibility

Source of truth for which Codex, Claude Code, and Gemini CLI versions HyperYOLO supports, how versions are detected, and how we react to breaking changes.

## Detection and parsing

HyperYOLO adapters run the native `--version` command and extract the first semantic version they find. The raw output is preserved for debugging.

| CLI | Version command | Expected output shape | Parse rule | Notes |
|-----|-----------------|-----------------------|------------|-------|
| Codex | `codex --version` | `codex-cli 0.66.0` | First `\d+.\d+.\d+` | Rust binary; Homebrew and npm ship identical surface. |
| Claude Code | `claude --version` | `2.0.62 (Claude Code)` | First `\d+.\d+.\d+` | Node 18+; keep the Claude suffix when logging raw output. |
| Gemini | `gemini --version` | `0.19.3` | First `\d+.\d+.\d+` | Requires Node 20+; some releases are tagged `gemini-cli/<ver>`. |

If parsing fails, adapters surface a warning and continue with best-effort availability results.

## Compatibility matrix

| CLI | Min supported | Max tested | Blocking versions | Notes |
|-----|---------------|------------|-------------------|-------|
| Codex | 0.66.0 | 0.66.0 | None | No `--yolo`; `--skip-git-repo-check` required outside git; JSON streaming is preferred for parsing. |
| Claude Code | 2.0.62 | 2.0.62 | None | `--output-format stream-json` requires `--verbose`; headless writes need `--dangerously-skip-permissions`. |
| Gemini | 0.19.3 | 0.19.3 | None | Node 20+ required; `-y` does not auto-enable sandboxing; headless without YOLO strips tool access. |

Max tested is not a hard cap—runs continue with a warning when the detected version exceeds the tested range.

## Breaking change notes

- **Codex**
  - Resume silently creates a new session when the id is invalid; HyperYOLO must validate ids itself.
  - Outside a git repo the CLI exits unless `--skip-git-repo-check` is provided.
  - No `--yolo`; the closest flag (`--dangerously-bypass-approvals-and-sandbox`) changes sandboxing semantics.
- **Claude Code**
  - `--output-format stream-json` exits with code 1 unless paired with `--verbose`.
  - Session ids only appear in JSON/stream outputs; plain text mode cannot be resumed reliably.
  - Headless writes/bash require `--dangerously-skip-permissions`; without it, tool calls remain blocked.
- **Gemini**
  - Headless `-p` mode strips tools unless `-y/--approval-mode yolo` is set; even then sandboxing is opt-in.
  - Sandbox mode depends on Docker availability; failures should degrade gracefully to non-sandboxed runs.
  - CLI enforces Node 20+ and exits with code 144 for auth failures, which callers should treat as fatal.

## Version warning and enforcement

Adapters normalize versions against the compatibility matrix:
- **OK** when `detected >= min` and `detected <= max tested`.
- **Warning** when parsing fails or the version is newer than `max tested`; surface guidance but continue.
- **Unsupported** when below `min supported` or explicitly blocked; adapters return availability with a warning so the CLI can decide to block or allow with `--ignore-version-warnings`.

The version check keeps the parsed version, the raw output, and the minimum/tested thresholds so the CLI layer can render a clear message (`Detected 0.64.0, minimum 0.66.0`).

## Update monitoring strategy

- Subscribe to Codex (GitHub releases), Claude Code (`npm info @anthropic-ai/claude-code`), and Gemini CLI (GitHub releases) announcements.
- When a new version ships, rerun the verification commands from `docs/research/cli-verification/*.md` and update the matrix.
- Record any behavioral drift in `docs/cli-version-changelog.md` and bump the tested version once smoke tests pass.
- If a release is broken, add it to the blocking list and keep the mitigation steps in the changelog until resolved.

## Related docs

- `docs/pre-implementation-plan.md` for the original baselines
- `docs/cli-version-changelog.md` for per-release impact notes
- `docs/research/cli-verification/README.md` for per-CLI verification templates and schemas
