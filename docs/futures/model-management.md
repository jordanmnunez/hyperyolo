# Model Management

Status: intake
Created: 2025-12-12
Last Updated: 2025-12-12

## The Idea

A system for managing model selection across backends—handling defaults, user preferences, and potentially semantic model tiers that abstract away specific model names. Instead of users needing to know `gpt-5.2-chat-latest` vs `claude-3-5-sonnet` vs `gemini-2.0-flash`, they could specify intent like "fastest" or "best" and let hyperyolo resolve to the appropriate model for the chosen backend.

## Why

Model selection is getting complicated:
- Each backend has multiple models with different tradeoffs (speed, quality, cost, context size)
- Model names are arbitrary and inconsistent across vendors (`gpt-5.2-pro` vs `claude-opus-4.5` vs `gemini-2.5-pro`)
- New models release frequently—keeping up with the "best" option is a moving target
- Users may want different defaults for different use cases (quick tasks vs. complex reasoning)
- No central place to configure "my preferred model" today

A model management system could make this frictionless.

## Core Questions

### What should be the default model?

- Per-backend defaults? (fastest/cheapest for each backend)
- Global default? (one model that hyperyolo prefers across all backends)
- Situational defaults? (different defaults based on task type or prompt complexity)
- No default—always require explicit specification?

### How should users configure defaults?

Options to consider:
- Environment variables (`HYPERYOLO_MODEL=gpt-5.2`)
- Config file (`~/.config/hyperyolo/config.json` or `.hyperyolorc`)
- CLI flag that persists (`hyperyolo config set default-model gpt-5.2`)
- Per-project config (`.hyperyolo.json` in repo root)
- Combination of the above with precedence rules

### Should we normalize models into semantic tiers?

Potential tier system:
- `best` / `flagship` — Maximum capability, highest cost (claude-opus-4.5, gpt-5.2-pro, gemini-2.5-pro)
- `balanced` / `mid` — Good tradeoff of quality and cost (claude-sonnet, gpt-5.2, gemini-2.5-flash)
- `fast` / `instant` — Speed optimized, lowest latency (gpt-5.2-chat-latest, gemini-flash)
- `cheap` / `budget` — Minimum cost (older models, smaller variants)

Benefits:
- Users don't need to track model names
- Easy to upgrade—just update the mapping
- Consistent mental model across backends
- Could auto-select tier based on task characteristics

Risks:
- Mappings are subjective and may not match user expectations
- Hides model-specific capabilities
- Another layer of abstraction to maintain
- "Best" is context-dependent (best at code? best at writing? best for long context?)

### Should tier selection be automatic?

Could hyperyolo analyze the prompt/task and pick a tier:
- Simple question → fast tier
- Code generation → balanced tier
- Complex multi-step reasoning → best tier

This adds complexity and may surprise users.

## Open Questions

- [ ] What's the current model selection behavior? (Do we have defaults? What are they?)
- [ ] What config file format/location would fit user expectations?
- [ ] Should tiers be per-capability? (best-for-code, best-for-writing, fastest, etc.)
- [ ] How do we handle models that don't fit neatly into tiers?
- [ ] Should cost awareness be part of model selection? (warn on expensive models)
- [ ] How do we surface what model was actually used? (important for debugging/billing)
- [ ] Do we need different defaults for interactive vs. autonomous mode?
- [ ] How should this interact with `--model` flag? (override everything?)

## Notes

Precedence example (lowest to highest):
1. Hardcoded defaults per backend
2. Global config file default
3. Project-level config
4. Environment variable
5. CLI flag

The tier system is appealing but needs careful thought. "Best" is not universal—a model that's best at coding might not be best at creative writing. Maybe tiers should be more specific: `best-code`, `best-reasoning`, `fastest`, `cheapest`.

Could also consider exposing raw model lists: `hyperyolo models list --backend codex` to show available options.

## Related

- `docs/futures/gpt-5.2-backend.md` — New model that sparked this discussion
- `src/adapters/types.ts` — `ExecutionOptions.model` is how models are currently passed
- `src/adapters/codex.ts` — Shows current model flag handling
