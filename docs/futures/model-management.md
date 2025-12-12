# Model Management

Status: ready-to-implement
Created: 2025-12-12
Last Updated: 2025-12-12

## The Idea

Default to the **best** model per backend. Let users override via config or `--model` flag. Keep it simple.

## Why

hyperyolo is about autonomous execution that just works. Users shouldn't have to remember model names or worry about picking the right one. Default to maximum capability—we're here to get shit done, not save pennies.

## Research Findings

### Current Behavior

- **No hyperyolo defaults** — currently delegates entirely to backend CLI defaults
- **Codex CLI** defaults to `gpt-5.1-codex-max` with internal fallback to standard
- **Claude CLI** defaults to `sonnet` alias (maps to latest Claude Sonnet)
- **Gemini CLI** defaults to `auto` alias (maps to latest Pro model)

### What Other Tools Do

- **Claude CLI**: Uses aliases `haiku`, `sonnet`, `opus` — simple tier names
- **Gemini CLI**: Uses aliases `flash`, `pro`, `auto` — similar pattern
- **Config precedence**: Industry standard is CLI > env > project config > global config > hardcoded

### Key Insight

All three CLIs already have tier aliases. We don't need to reinvent this—we just need to:
1. Pick better defaults (best, not balanced)
2. Provide a config layer for user preferences
3. Print what model is being used

## Decisions

### Default to Best

Each backend defaults to its most capable model:

| Backend | Default Model | Why |
|---------|---------------|-----|
| codex | `gpt-5.2-pro` | Most capable for autonomous coding |
| claude | `opus` | Maximum reasoning capability |
| gemini | `pro` | Highest quality tier |

Users who want speed can use `--model fast` or configure their preference.

### Two Tiers Only

Keep it simple:
- **`best`** (default) — Maximum capability, use the flagship model
- **`fast`** — Speed optimized, for when latency matters

No "balanced", no "cheap", no "best-for-code" vs "best-for-writing". If you're using hyperyolo, you want results.

### Tier Mappings

```
best:
  codex: gpt-5.2-pro
  claude: opus
  gemini: pro

fast:
  codex: gpt-5.2-chat-latest
  claude: haiku
  gemini: flash
```

### Config File

Location: `~/.config/hyperyolo/config.json`

```json
{
  "defaults": {
    "codex": "best",
    "claude": "best",
    "gemini": "best"
  }
}
```

Users can set tier aliases OR specific model names:

```json
{
  "defaults": {
    "codex": "gpt-5.2",
    "claude": "sonnet",
    "gemini": "flash"
  }
}
```

### Precedence

1. `--model` flag (always wins)
2. Environment variable (`HYPERYOLO_MODEL` or `HYPERYOLO_CODEX_MODEL`)
3. Config file default
4. Hardcoded best-tier default

### Always Print the Model

Every run should output what model is being used:

```
hyperyolo: Using claude/opus (claude-opus-4-5-20251101)
```

This is non-negotiable. Users need to know what's running their code.

## What We're NOT Doing

- **Cost warnings** — Not our problem. Users chose YOLO mode.
- **Automatic tier selection based on prompt** — Magic is bad. Be predictable.
- **Mode-specific defaults** — Same defaults for interactive and autonomous.
- **Complex fallback chains** — If the model fails, error out. Don't silently downgrade.
- **Per-capability tiers** — "best-for-code" vs "best-for-writing" is overthinking it.

## Implementation Plan

### Phase 1: Hardcoded Best Defaults

Update each adapter to use best-tier model when no `--model` specified:
- `src/adapters/codex.ts` — default to `gpt-5.2-pro`
- `src/adapters/claude.ts` — default to `opus`
- `src/adapters/gemini.ts` — default to `pro`

Print the resolved model at execution start.

### Phase 2: Tier Alias Resolution

Add tier mapping logic:
- If `--model best` or `--model fast`, resolve to concrete model for that backend
- Keep mappings in a simple lookup table

### Phase 3: Config File Support

- Load `~/.config/hyperyolo/config.json` on startup
- Merge with defaults
- Respect precedence order

### Phase 4: Environment Variable Overrides

- `HYPERYOLO_MODEL` — global override
- `HYPERYOLO_CODEX_MODEL`, `HYPERYOLO_CLAUDE_MODEL`, `HYPERYOLO_GEMINI_MODEL` — per-backend

## Open Questions (Resolved)

- [x] What's the current model selection behavior? → No defaults, delegates to CLI
- [x] What config file format/location? → JSON at `~/.config/hyperyolo/config.json`
- [x] Should tiers be per-capability? → No, just `best` and `fast`
- [x] How do we handle edge cases? → Don't. Error if model unavailable.
- [x] Should cost awareness be part of selection? → No. YOLO.
- [x] How do we surface what model was used? → Always print it
- [x] Different defaults for interactive vs autonomous? → No. Same defaults.
- [x] How should `--model` flag interact? → It wins, always.

## Related

- `docs/futures/gpt-5.2-backend.md` — New model specs
- `src/adapters/types.ts` — `ExecutionOptions.model`
- `src/adapters/codex.ts` — Current model flag handling

## Research Sources

- ChatGPT Deep Research (Dec 2025) — CLI precedent analysis, tier patterns
- Claude CLI docs — Alias system (`haiku`/`sonnet`/`opus`)
- Gemini CLI docs — Model selection and `auto` alias
- Codex CLI source — Fallback behavior for max models
