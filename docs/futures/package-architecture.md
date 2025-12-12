# Package Architecture

Status: intake
Created: 2025-12-11
Last Updated: 2025-12-11

## The Idea

Should hyperyolo be split into multiple packages/repos, or remain a monolith? The codebase is doing several distinct things:
1. **CLI wrapping** - Spawning and managing subprocess CLIs
2. **Output normalization** - Parsing and transforming CLI outputs
3. **Process tracking** - Managing sessions and potentially a tracking service
4. **UI/presentation** - Terminal UI, colors, banners

These could be:
- One repo, one package (current)
- One repo, multiple packages (monorepo with workspaces)
- Multiple repos, multiple packages

## Why

As features grow, the question of boundaries matters:
- Can someone use just the output normalization without the CLI wrapper?
- Should the tracking service be a separate installable tool?
- Does splitting help or hurt development velocity?
- What about versioning—do pieces move at different speeds?

## Open Questions

- [ ] What are the actual dependency relationships between these concerns?
- [ ] Who are the consumers? Just end-users, or also library consumers?
- [ ] Is there value in using the normalizer standalone?
- [ ] How much ceremony does a monorepo add vs. benefits?
- [ ] What's the maintenance burden of multiple packages?
- [ ] Should this decision wait until the MVP is stable?

## Notes

Arguments for staying monolith (for now):
- Simpler development, testing, releasing
- MVP isn't even done yet
- Premature abstraction is costly
- Can always split later when boundaries are clearer

Arguments for splitting:
- Cleaner separation of concerns
- Smaller install footprint for specific use cases
- Independent versioning
- Easier to reason about each piece

Potential split if we did it:
- `@hyperyolo/core` - CLI wrapping, subprocess management
- `@hyperyolo/schema` - Unified output types and transformers
- `@hyperyolo/tracker` - Process tracking service
- `hyperyolo` - CLI that composes all of the above

## Related

- This decision affects `unified-output-schema.md` and `process-tracking-service.md`
- Current structure in `src/` is already somewhat modular (adapters, core)
