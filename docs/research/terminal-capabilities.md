# Terminal Capability Detection Strategy

Research on how HyperYOLO should detect terminal capabilities and degrade visuals without breaking streaming output or readability.

---

## Goals

- Detect what the terminal can safely render (color depth, Unicode/emoji, width) and pick the maximal aesthetic that will not glitch.
- Respect user intent (`NO_COLOR`, `FORCE_COLOR`, CI) before auto-detection.
- Keep detection cheap (run once, cache; update width on `SIGWINCH`) so streaming performance is unaffected.

## Signals to Collect

- **Color depth**: none/16-color/256-color/TrueColor.
- **TTY + env intent**: `process.stdout.isTTY`, `TERM`, `COLORTERM`, `NO_COLOR`, `FORCE_COLOR`, `CI`.
- **Unicode**: general Unicode support and emoji quality.
- **Width**: current `process.stdout.columns` with a sane fallback (80) when absent.

## Detection Approach (Node 18+)

- **Color**
  - Use [`supports-color`](https://github.com/chalk/supports-color) (Chalk dependency) as the single source of truth; it already honors `NO_COLOR`, `FORCE_COLOR`, `TERM`, `COLORTERM`, and CI defaults.
  - Treat `color.level` per supports-color:
    - `3`: TrueColor -> gradients, full Chalk palette.
    - `2`: 256-color -> reduced gradients (palette-mapped).
    - `1`: basic 16-color -> single-hue accents, no gradients.
    - `0`: monochrome -> no ANSI beyond bold/underline (strip if `NO_COLOR`).
  - Non-TTY stdout defaults to level 0 unless `FORCE_COLOR` is set.
- **Unicode / Emoji**
  - Use [`is-unicode-supported`](https://github.com/sindresorhus/is-unicode-supported) for general Unicode.
  - Emoji: treat macOS/Linux with Unicode support as "full"; otherwise assume "ascii-only" and swap emojis for ASCII tokens.
  - Never emit box-drawing characters when Unicode support is false; swap to ASCII `+---+` boxes and `---` separators.
- **Width**
  - `const width = process.stdout.isTTY ? process.stdout.columns ?? 80 : 80;`
  - Listen for `SIGWINCH` and recompute width; cache the latest value in UI state.
  - Clamp to a minimum layout width (e.g., 60) to avoid negative padding when terminals are extremely narrow.

Example capability shape:

```typescript
type ColorLevel = 0 | 1 | 2 | 3;

interface TerminalCapabilities {
  colorLevel: ColorLevel;
  unicode: boolean;
  emoji: 'full' | 'ascii';
  width: number;
  isTTY: boolean;
  noColor: boolean; // derived from supports-color.isTTY === false or colorLevel === 0 with NO_COLOR present
}
```

## Fallback Chain (apply highest valid tier)

1. **Maximal** - `colorLevel=3`, `unicode=true`, `emoji=full`, width >= 80  
   - Full gradients via `gradient-string`, figlet banners, boxen borders with heavy box chars, emoji callouts, glowing separators.
2. **Vivid** - `colorLevel=2`, `unicode=true`  
   - Palette-mapped gradients (no RGB), keep figlet but simplify fills, retain box-drawing characters, keep emoji.
3. **Minimal Color** - `colorLevel=1`, `unicode=true`  
   - Single-hue accents (bold + bright), no gradients, box-drawing retained, replace emoji with ASCII markers (e.g., `* COMPLETE *`).
4. **Monochrome** - `colorLevel=0` or `NO_COLOR` or non-TTY without `FORCE_COLOR`  
   - Strip ANSI, ASCII borders (`+---+`), plain separators (`-----`), no emoji/figlet (use simple headings), ensure streaming output is raw.

## UI Implementation Requirements

- Respect `NO_COLOR` and `CI` by immediately selecting the Monochrome tier unless `FORCE_COLOR` overrides.
- Cache capabilities at process start; expose a helper (e.g., `getCapabilities()`) for banner/footer/theme to avoid redundant checks.
- On `SIGWINCH`, recompute width and ask renderers to adjust padding/wrapping; do not rerender historical stream content.
- Keep parser branch ANSI-agnostic: parse against `strip-ansi` output, while UI branch uses the tiered styling above.
- Document the chosen tier in debug logs to aid bug reports ("terminal tier=Vivid colorLevel=2 unicode=true width=120").

## Testing Suggestions

- Unit-test tier selection by stubbing `supports-color` outputs (`level` 0/1/2/3), `is-unicode-supported`, and env vars (`NO_COLOR`, `FORCE_COLOR`, `CI`).
- Snapshot banner/footer rendering for each tier to ensure ASCII fallbacks do not wrap or clip at widths 60/80/120.
- CLI smoke in CI: run with `NO_COLOR=1` and `FORCE_COLOR=3` to ensure both overrides behave as expected.
