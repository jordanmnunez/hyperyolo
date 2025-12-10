# ANSI Output Handling and Dual-Stream Parsing

Strategy for keeping hyperyolo’s maximalist styling while making parsing robust against ANSI escape codes, cursor moves, and terminal quirks.

## Goals
- Preserve colored/gradient output for users who want it while degrading cleanly for `NO_COLOR`, non-TTY, and low-capability terminals.
- Keep parsing ANSI-agnostic so session ID and stats extraction never depend on color codes or cursor control sequences.
- Keep streaming: no buffering that delays display or parser events; maintain chunk order across both branches.

## Challenges
- Native CLIs emit color, cursor rewrites (`\r`, `\u001b[2K`), and mixed stdout/stderr.
- Parsing via regex/JSON fails when ANSI codes are left in place; stripping must not collapse log lines or re-order output.
- Users may force or disable color via env (`NO_COLOR`, `FORCE_COLOR`, `CI`) or by redirecting output (non-TTY).

## Libraries and capability detection
- Use [`strip-ansi`](https://github.com/chalk/strip-ansi) in the parser branch; avoid bespoke regexes.
- Capability source of truth: `supports-color` (respects `NO_COLOR`/`FORCE_COLOR`/TTY) and `is-unicode-supported` for emoji/box drawing. Follows the tiering in `docs/research/terminal-capabilities.md`.
- Terminal branch keeps raw chunks unless the selected tier is Monochrome, in which case styling is suppressed before printing; parser branch always strips.

## Streaming pipeline (executor)
- Tee every stdout/stderr chunk from `execa` to two branches:
  - **Display branch**: apply theme based on the chosen tier; do not re-chunk or buffer. If the tier is Monochrome, omit ANSI entirely.
  - **Parser branch**: immediately `strip-ansi` and normalize carriage returns (treat `\r` as line separators so progress-style rewrites still surface as distinct parseable lines). Feed sanitized text to parsing hooks incrementally.
- Maintain ordering: the same chunk index is processed by both branches before reading the next chunk. Do not wait for line breaks to display; parser may buffer minimal context (e.g., first N lines for session ID).
- Mixed streams: stderr joins the tee unless explicitly silenced by a flag; parsers see the combined stripped text so stats/IDs are catchable from either stream.

## Adapter interface expectations
- `buildArgs` should prefer parse-friendly output modes (Claude/Gemini `stream-json`, Codex `--json` where available) to minimize ANSI noise. Only fall back to colored text modes when parsing is disabled.
- `parseSessionId` and `parseStats` receive **ANSI-stripped, CR-normalized** text slices; adapter implementations must not rely on color codes or cursor positioning. They may be stateful to accumulate partial JSON fragments as chunks arrive.
- Adapters must not emit additional stripping of their own; the executor guarantees sanitized input to parser hooks while preserving the raw stream for UI.

## Environment and user intent
- Obey `NO_COLOR` by selecting the Monochrome tier; `FORCE_COLOR` can elevate capability for TTYs/non-TTYs per `supports-color`.
- Non-TTY stdout defaults to Monochrome unless `FORCE_COLOR` is set. Width uses the same detection rules as `docs/research/terminal-capabilities.md`.
- Documentation and help should note that redirecting output will disable styling but will not affect parsing or session detection.

## Testing guidance
- Fixture streams that mix ANSI colors, carriage-return rewrites, and JSON lines; assert that stripped parser input is free of escape codes and preserves logical line order.
- Snapshot the display branch across tiers (Maximal → Monochrome) to confirm degradation removes styling without altering content.
- Simulate `NO_COLOR`, `FORCE_COLOR`, and non-TTY conditions to ensure both branches react consistently and parsing still succeeds.
