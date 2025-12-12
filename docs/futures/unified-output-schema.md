# Unified Output Schema

Status: intake
Created: 2025-12-11
Last Updated: 2025-12-11

## The Idea

Normalize the JSON stream outputs from Codex, Claude, and Gemini CLIs into a single, unified DTO (data transfer object). Instead of consumers needing to understand three different output formats, hyperyolo would emit a consistent event stream regardless of which backend is running.

## Why

Each CLI has its own output format with different field names, event types, and structures. This creates friction for:
- Building tools on top of hyperyolo
- Switching between backends
- Aggregating results from multiple backends
- Creating consistent UIs/dashboards

A unified schema means consumers can treat all backends identically.

## Open Questions

- [ ] What are the actual output schemas for each CLI? (Research needed)
- [ ] What events/actions are common across all three? (e.g., "tool call", "text output", "error")
- [ ] What's backend-specific and should be preserved vs. dropped?
- [ ] Should we start with a minimal common schema and extend, or map everything?
- [ ] How do we handle fields that exist in one backend but not others?
- [ ] Should the original/raw events be preserved alongside normalized ones?

## Notes

Initial approach could be:
1. Research each CLI's stream-json output format
2. Identify the intersection (guaranteed common fields)
3. Identify the union (all possible fields, some optional)
4. Decide on a strategy: strict intersection vs. generous union with optionals

Start general, get specific over time—don't over-engineer the first pass.

## Related

- `docs/research/cli-verification/` - Contains some output format details
- `docs/architecture/output-formats.md` - Current output handling
