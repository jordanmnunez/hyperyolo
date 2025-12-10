# CLI Framework Decision (MVP)

## Recommendation
- Use **Commander** for the MVP CLI surface. It keeps the dependency tree lean, avoids generator boilerplate, and gets the three backend commands running fastest.
- Estimated time savings versus oclif: **~0.5–1 engineering day** for initial scaffolding (no command class boilerplate, topic plugins, or generator cleanup).
- This choice is reversible: maintain a thin command layer so we can swap to oclif when a plugin ecosystem becomes a requirement.

## oclif vs Commander (MVP scope)
- **oclif strengths:** First-class plugin host, opinionated project layout, autoloaded commands, polished help UX. Downsides for MVP: heavier boilerplate, larger dependency graph, steeper ramp for contributors unfamiliar with its patterns.
- **Commander strengths:** Tiny API surface, minimal dependencies, explicit wiring for subcommands/flags, TypeScript support without a generator. Downsides: no built-in plugin loader or file-system autoloading; advanced UX (topics, command aliases, config scaffolding) is manual.

## Plugin story while on Commander
- Keep a registry-driven adapter/command layer so new backends can be added by registering modules in code rather than relying on framework plugins.
- If we need user-installable backends later, two options:
  - **Lightweight Commander plugins:** define a plugin manifest shape (e.g., exports a `register(program)` function) and dynamically load `hyperyolo-plugin-*` packages from `node_modules`. Validate versions, sandbox unsafe plugins, and surface provenance in help output.
  - **Migration to oclif:** preserve backend command handlers as reusable functions so we can wrap them in oclif command classes; map existing args/flags to oclif’s parser and enable the official plugin system for discoverability.
- Guardrails: keep CLI-facing arg/flag definitions centralized, avoid Commander-specific globals, and test command modules independently so a framework swap only touches the thin wiring layer.

## Revisit triggers
- First request for third-party/backyard backends, marketplace/discovery of commands, or complex topic/help UX needs.
- Maintenance pain from bespoke plugin loading that would be simpler in oclif.
