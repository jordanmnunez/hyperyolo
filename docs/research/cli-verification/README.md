# CLI Verification Playbook

This folder standardizes how we capture and compare Codex, Claude Code, and Gemini CLI behavior. Each CLI has a dedicated markdown file that follows a shared template so verification runs stay consistent and diff-friendly.

## Folder map
- `claude.md`, `codex.md`, `gemini.md`: Per-CLI verification docs using the template below.
- `schemas/`: JSON Schemas for streamed or structured outputs (`claude-stream-json.schema.json`, `codex-output.schema.json`, `gemini-stream-json.schema.json`).
- `docs/cli-compatibility.md`: Central compatibility matrix that consumes findings from these runs.

## How to record a verification run
1. Install the target CLI and record the version plus installation method.
2. Copy the section headers from an existing CLI doc and fill in the required fields (version, install/auth, commands/flags, session handling, output formats, YOLO/permissions, regexes, known issues).
3. Capture commands you executed and note whether they ran in TTY or headless mode.
4. If streamed output changed, update or extend the matching schema under `schemas/` and link it from the CLI doc.
5. Call out anything that could affect HyperYOLO adapters (breaking changes, flag renames, resume behavior).

## Tips for consistency
- Prefer `--output-format` values that expose session identifiers.
- Note default behaviors that differ between TTY and non-TTY runs.
- Keep regexes precise enough for adapter parsing but flexible enough to survive minor cosmetic changes.
- Link to external references sparingly; keep the critical facts in these docs.
