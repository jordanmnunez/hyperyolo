# Package Architecture

Status: researched
Created: 2025-12-11
Last Updated: 2025-12-15

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

### Proposed Layered Architecture

A more refined view splits the system into distinct service layers, each with a clear responsibility:

| Package | Responsibility |
|---------|----------------|
| **hyper-wrap** | CLI wrapper with argument mapping standards/specs. Creates equivalencies across all supported CLIs. Pure subprocess management without opinions. |
| **hyper-dto** | Transforms hyper-wrap output into normalized DTO structures. Each CLI has its own event structure; this layer unifies them into one consistent approach. |
| **hyper-equalize** | Feature matching across CLIs. Enables cross-CLI capabilities—e.g., bringing Claude commands into a Codex agent. Handles subagent interoperability. |
| **hyper-marry** | Session syncing. Pick up and resume sessions across agents. Or manage a unique hyper session that only works within hyper. Cross-agent session continuity. |
| **hyperyolo** | The culmination. Interactive or non-interactive CLI that intermingles CLIs and commands. Can call itself. Follows workflow patterns for long-lived tasks—each step is a new CLI session instance. |

The key insight: each layer is independent of the "hyperyolo mindset"—they're general-purpose tools that happen to compose into hyperyolo.

## Why

As features grow, the question of boundaries matters:
- Can someone use just the output normalization without the CLI wrapper?
- Should the tracking service be a separate installable tool?
- Does splitting help or hurt development velocity?
- What about versioning—do pieces move at different speeds?

The layered approach addresses a deeper question: what are the *abstractions* we're building, not just the features? Each layer represents a different level of capability that could be useful independently or in different combinations.

## Open Questions

- [x] What are the actual dependency relationships between these concerns?
- [x] Who are the consumers? Just end-users, or also library consumers?
- [x] Is there value in using the normalizer standalone?
- [x] How much ceremony does a monorepo add vs. benefits?
- [x] What's the maintenance burden of multiple packages?
- [x] Should this decision wait until the MVP is stable?

### Layer-specific questions

**hyper-wrap:**
- [x] What's the minimum viable argument mapping spec? What makes two CLI flags "equivalent"?
- [x] How do we handle flags that exist in one CLI but not others?

**hyper-dto:**
- [x] What's the canonical event schema? (Relates to `unified-output-schema.md`)
- [x] Should raw events be preserved alongside normalized ones?

**hyper-equalize:**
- [x] What does "bringing Claude commands into Codex" actually mean technically?
- [x] How would subagent delegation work across CLI boundaries?
- [x] Is this feature parity, or capability translation?

**hyper-marry:**
- [x] Can sessions actually be resumed across different backends? (Probably not natively)
- [x] What does a "hyper session" look like if it transcends individual CLI sessions?
- [x] How do you track context/state when switching between agents mid-task?

**hyperyolo:**
- [x] What does "can call itself" mean? Recursive invocation for subtasks?
- [x] What are "workflow patterns"? Are these user-defined, or built-in?
- [x] How does this relate to beads-runner? What makes it "unstoppable"?

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

### Layered thinking (2025-12-15)

The five-layer proposal (hyper-wrap → hyper-dto → hyper-equalize → hyper-marry → hyperyolo) represents a shift from "what code goes where" to "what abstractions exist in this problem space."

Key framing: these aren't just code organization choices—they're stories about how CLI orchestration could work. The descriptions are aspirational, not requirements.

The "unstoppable" quality mentioned for hyperyolo comes from treating long-lived tasks as workflows where each step spawns a fresh CLI session. If a step fails, you resume from that step, not from scratch. This is the beads-runner pattern.

## Related

- `unified-output-schema.md` - Directly overlaps with hyper-dto layer
- `process-tracking-service.md` - May fit into hyper-marry or be its own concern
- Current structure in `src/` is already somewhat modular (adapters, core)

---

## Research Findings (2025-12-15)

### General Architecture

**Dependency relationships:** CLI wrap → normalization → cross-CLI logic → session tracking → UI is a stack of dependencies, with minimal upward calls. The current code already separates these into modules (`src/adapters/` for CLI wrap, `src/core/` for execution/sessions, `src/ui/` for presentation). The UI layer doesn't drive logic; it formats what core provides.

**Consumers:** End-users are the primary consumers of the CLI. However, library consumers could emerge for submodules like the normalizer (e.g., a project importing `@hyperyolo/schema` to parse Codex/Claude/Gemini outputs uniformly) or session store. The unified output schema motivation explicitly mentions making it easier to build tools on top of hyperyolo.

**Standalone normalizer value:** Clear potential value exists. A CI system could run a CLI and pipe output into a normalizer library for standardized JSON logs. If new AI coding CLIs emerge, adapters could normalize their output for compatibility with hyperyolo-based tooling.

**Monorepo ceremony:** npm/Yarn/pnpm workspaces would suffice, possibly with Lerna or Changesets for version bumps. Lerna focuses on linking/publishing multiple packages; Nx adds build orchestration (likely overkill here). The overhead includes workspace config, inter-package dependencies, and coordinated releases. For a small team with tightly-related packages, this overhead might slow initial development.

**Maintenance burden:** Multiple packages mean multiple `package.json` files, compatibility constraints between versions, and synchronized changes across package boundaries. Changes spanning layers require coordinated updates and version decisions. Given early-stage flux in boundaries, maintaining them in separate packages would multiply effort.

**Timing:** Consensus is to avoid premature modularization. "Monolith First" principle applies—get a working system, find natural seams as it evolves, then split along stable seams. Early users will use it as a single tool; no immediate demand exists for separately installing individual layers.

### hyper-wrap Findings

**Minimum viable argument mapping:** The core options common to all backends are: prompt, session resume, model selection, system prompt, output format (JSON vs text), thinking/reasoning level, and YOLO/auto-confirm toggle. The `ExecutionOptions` interface already encapsulates these, and each `BackendAdapter.buildCommand` maps them to CLI-specific flags.

**Flag equivalence:** Two flags are "equivalent" if they achieve the same outcome. Example: Codex's `--dangerously-bypass-approvals-and-sandbox`, Claude's `--dangerously-skip-permissions`, and Gemini's `--yolo` all represent the same conceptual "yolo mode."

**Handling unique flags:** Use passthrough via `rawArgs`—backend-specific flags appended verbatim to the command. The adapter interface explicitly avoids altering these. For flags that don't translate, either warn ("Sandbox mode not applicable to Codex") or let the underlying CLI error. Initially, only map truly common features and use `rawArgs` for everything else.

### hyper-dto Findings

**Canonical event schema:** Likely fields include message type ("thought", "tool_call", "result", "error"), content/text, role (assistant/system), timestamps, and metadata (tokens, cost). Prior art:
- **CloudEvents** - standardized event envelope (type, source, timestamp)
- **OpenAI ChatCompletion format** - de facto standard; CLIProxyAPI wraps all three CLIs as OpenAI-compatible APIs
- **LangChain/agent frameworks** - internal tool invocation event normalization

Approach: enumerate common events ("assistant_reply", "tool_execution", "final_answer") and fields, then handle differences with optional/nullable fields. Start with "generous intersection"—include everything common, optionally carry additional info.

**Raw event preservation:** The **envelope pattern** (common in data engineering) argues for preserving raw events inside a wrapper alongside normalized form. Advantage: no information loss, helps debugging. Disadvantage: heavier payloads. Middle ground: configurable output (`--preserve-raw` flag) or design the DTO with an optional `rawEvent` field. Recommendation: preserve raw in debug/verbose mode, transform-in-place for normal operation.

### hyper-equalize Findings

**"Bringing Claude commands into Codex":** This means enabling features native to one agent when working with another. Technically challenging but possible—hyperyolo would act as glue, spawning the appropriate CLI when needed. Prior art exists:
- **Codex CLI Skill for Claude** - enables Claude to delegate tasks to Codex CLI
- **MyClaude's codeagent-wrapper** - `--backend codex|claude|gemini` flag for workflow steps
- **Terminal Jarvis** - "unifying multiple AI coding assistants in one interface"

Implementation: detect special commands (or agent output triggers), launch different backend to fulfill them, feed output back. Turns hyperyolo into a meta-agent orchestrator.

**Subagent delegation:** Hyperyolo would intermediate communication—pause main agent, launch second CLI for subagent, feed it a prompt derived from context, take result back to original session. The normalized DTO helps here (convert requests to prompts each backend understands). Community examples show this done via wrapper scripts; hyperyolo could make it seamless. Essentially treating one CLI as a tool for another.

**Feature parity vs. capability translation:** Lean toward **capability translation**—map requested actions to closest available capability on chosen backend. Perfect feature parity is unlikely; instead, hyperyolo implements or emulates features per backend. Example: if all agents should support "/plan" but Codex lacks it, hyperyolo implements it by prompt-engineering. Expose a superset of features, handle them per backend internally, fall back or warn where something truly can't be done.

### hyper-marry Findings

**Cross-backend session resume:** Native session IDs are backend-specific (can't use Claude session ID in Codex). However, hyperyolo can enable cross-backend sessions by preserving conversation/task context independently. State to preserve: conversation history, intermediate artifacts (files modified, test results), high-level goal.

Prior art: **Charmbracelet's Crush** switches LLMs mid-session while preserving context via persistent files (AGENTS.md). Hyperyolo could maintain its own transcript log for a "hyper session"—if user switches backends under same hyper ID, inject prior conversation (or summary) into new backend's prompt.

**Hyper session structure:** An abstraction layer above native sessions. A hyper session ID (e.g., `hyper_abcd1234`) could map to multiple backend-specific sessions grouped under it. Could store multiple `SessionRecord` entries or an array of backend states. Alternatively, treat each step as stateless from CLI perspective (always fresh CLI run) but feed accumulated context each time—aligned with "beads-runner" pattern.

**Tracking context across switches:** Maintain a shared log—save CLI output (reasoning, decisions) to a log file or memory structure. When switching, prepend log (or summary) to new agent's prompt as system message: "Here's what happened so far: [steps]… Continue." The Claude-Codex bridge skill does this by converting CLAUDE.md to AGENTS.md format. Hyperyolo's unified schema helps—record abstract events ("Agent created file X", "Agent ran tests, 2 failed") in backend-agnostic way, present facts to next agent. Risk: context length limits may require summarization.

### hyperyolo (Orchestrator) Findings

**"Can call itself":** Recursive/nested invocation—hyperyolo process spawns another instance as subprocess for subtasks. Reasons:
- Reuse the whole pipeline for subtasks (invoke `hyperyolo <backend> "<subtask>"`)
- Each run is isolated, starts with fresh environment (new CLI session)
- Unix philosophy of chaining commands
- Fault tolerance: if child crashes, doesn't take down the chain

This is exactly how beads-runner achieves fault tolerance—stringing together independent runs, restart at last failed bead. Treat hyperyolo as both coordinator and worker.

**Workflow patterns:** Predefined sequences for tasks (plan → code → test → refine, or generate → critique → improve loops). Likely **both** user-defined and built-in:
- **Built-in:** Common patterns like MyClaude's `/dev`, `/debug`, `/test` commands; an "unstoppable code fix" that plans, fixes, tests until all tests pass
- **User-defined:** YAML/JSON defining sequences of hyperyolo calls (mixing backends)

Commander vs oclif decision hints at eventual plugin support for custom workflows. Start with built-in patterns, design for user extensibility later.

**Beads-runner pattern:** Breaking long tasks into discrete, self-contained steps (beads on a string). Each step is a fresh CLI session producing output/partial result for the next. If one step fails, progress is saved at each checkpoint—retry that step or continue from there. Like workflow tools (Airflow, Nextflow) allowing resume from last successful node. Trade-off: starting new processes and re-feeding context adds latency, but gains fault tolerance. Essentially resilient orchestration with incremental checkpointing.

---

## Recommendations

1. **Defer splitting until core functionality is stable.** Maintain monolith through MVP and initial user feedback. Focus on internal modularity (clear interfaces between layers) within single codebase. A later split will be straightforward if boundaries are respected now.

2. **Use monorepo with workspaces if/when splitting.** Keep packages in one repository (npm/pnpm workspaces). Allows atomic commits across layers, eases coordination. Introduce Lerna or Changesets for publishing when needed. Avoids overhead of multiple repos (issue tracking, PRs).

3. **Identify candidate modules for separation when external demand exists.** Output normalization (`hyper-dto` / `@hyperyolo/schema`) stands out—others might use it independently. Session tracking (`hyper-marry`) could be useful outside hyperyolo. But don't spin out until at least one real consumer besides main app exists.

4. **Continue refining abstraction layers conceptually.** Organize code by domains (clear namespaces/directories), enforce boundaries through interfaces like `BackendAdapter`. When adding features, consider which layer they belong to. This future-proofs extraction and has immediate maintainability benefits.

5. **Prefer gradual extraction: monorepo multi-package first, multi-repo only if necessary.** Multi-repo is for vastly different contexts or separate teams. For hyperyolo, `packages/core`, `packages/schema`, etc. in one repo gives modularity while keeping coordination costs low.

6. **Set up infrastructure for multiple packages even while monolithic.** Use Changesets for versioning, structure CI for per-package tests/builds. Smooth transition when the switch happens.

7. **Balance velocity with modularization as project evolves.** Prioritize shipping features now. Periodically evaluate: Is the single package unwieldy? Are contributors working in different domains? Those are signals to modularize.

8. **Plan for plugin architecture as future driver.** If plugins become a priority (new backends, custom workflows), possibly migrate to oclif. Design the core with clear extension points (`BackendAdapter` interface well-defined and separable).

9. **Validate each layer with real use-cases before spinning out.** Each layer should earn its place:
   - **hyper-wrap** and **hyper-dto** are relatively independent—candidates for earlier extraction
   - **hyper-equalize** and **hyper-marry** are inherently integrative—keep in core longer
   - **UI** can remain with top-level (small, user-facing)

10. **Embrace "monolith first, modularize later" as official plan.** Document that the project will likely transition to modular architecture, but is intentionally monolithic during incubation. Sets expectations, avoids bikeshedding on structure.

---

## Risks & Concerns

**Over-modularizing too soon:** Changes cutting across layers require synchronized updates in multiple packages, potential version skew, bugs from imperfect coordination. Maintenance burden multiplies. In early stage, this could slow development significantly.

**Staying monolithic too long:** Concerns may entangle if modularity isn't respected. "Big ball of mud" risk. Makes eventual extraction painful. Install size bloats if users only need parts.

**Multiple packages maintenance complexity:** Version compatibility becomes a concern. May need lockstep versioning (all packages share same version, released together)—somewhat negates independent versioning advantage but reduces confusion. Requires good integration tests spanning packages.

**Performance overhead of beads-runner:** Fresh processes for each step adds latency; re-feeding context uses tokens and time. Trade-off: might be slower than one continuous session. Mitigation: allow "all-in-one" mode for simpler tasks, optimize context transfer with summaries.

**Complexity of hyper-equalize & hyper-marry:** Ambitious features that could significantly increase codebase complexity. Cross-agent mixing might lead to unpredictable outcomes without human oversight. May need to scope down MVP to same-backend workflows first.

**Unified schema maintenance as CLIs evolve:** Normalizer needs constant updates as Codex/Claude/Gemini change output formats. If schema is too rigid, changes break everything. Mitigation: robust parsers, test fixtures from each CLI version.

---

## Implementation Phases

**Phase 0: MVP Completion (Monolith)**
- Finish core features (CLI wrap, output parsing, session store, basic UI) in single package
- Continue organizing code by domains (`core/`, `adapters/`, `ui/`)
- Possibly start using monorepo structure (even if not publishing separately)

**Phase 1: Internal Modularization**
- Once MVP is usable, refactor to solidify boundaries
- Create internal libraries/classes for each layer (`OutputNormalizer`, `SessionManager`, etc.)
- Add unit tests for each piece in isolation
- Pay off tech debt, prepare code for extraction

**Phase 2: Monorepo Workspaces Setup (Optional)**
- Convert to npm/pnpm workspaces with multiple `package.json` files
- Keep all versions same and marked private initially
- Adjust imports and builds (TypeScript project references)
- Ensure everything works as before

**Phase 3: Publish Library Packages (If Justified)**
- When clear use-case exists, publish core parts (`@hyperyolo/core`, `@hyperyolo/schema`)
- Use lockstep versioning initially
- Provide documentation for standalone use
- Ensure CI handles multi-package publishing

**Phase 4: Plugin Architecture (Post-1.0)**
- If plugins needed, possibly migrate to oclif
- Split CLI into `@hyperyolo/cli-core` + plugin packages for each adapter
- Allow third-party plugins

**Phase 5: Evaluate Multi-Repo (If Needed)**
- Only if components used in vastly different contexts with separate teams
- Set up sync mechanisms (dependency update bots, etc.)
- Until then, remain in monorepo

---

## References

- [Martin Fowler – Monolith First](https://martinfowler.com/bliki/MonolithFirst.html) - Why building a monolith initially is advantageous
- [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) - Wraps Codex/Claude/Gemini behind unified OpenAI-compatible API
- [Charmbracelet Crush](https://github.com/charmbracelet/crush) - AI CLI supporting LLM switching mid-session
- [MyClaude codeagent-wrapper](https://github.com/cexll/myclaude) - `--backend` flag for choosing Codex/Claude/Gemini in workflows
- [MarkLogic Envelope Pattern](https://docs.marklogic.com/guide/app-dev/entity-services-intro) - Preserving raw data alongside normalized data
- [Nextflow](https://www.nextflow.io/) - Workflow orchestration with resume-on-failure patterns
