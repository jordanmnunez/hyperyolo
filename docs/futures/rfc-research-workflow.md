# RFC Research Workflow

Status: intake
Created: 2025-12-12
Last Updated: 2025-12-12

## The Idea

A command that generates a research prompt for ChatGPT Deep Research, pre-loaded with RFC context and relevant codebase snippets. The user pastes this into ChatGPT (which has repo access via Codex or connected repo), and ChatGPT does the heavy lifting of researching open questions, analyzing tradeoffs, and producing findings. The output can then be fed back to update the RFC.

## Why

The current RFC lifecycle has a gap between `intake` and `planned`:

```
[Intake] → ??? → [Researched] → [Planned]
```

Research is the hard part:
- Answering open questions requires web searches, reading docs, comparing approaches
- Understanding how an idea fits with existing code requires codebase exploration
- Evaluating tradeoffs takes time and context

ChatGPT with Deep Research is good at this:
- Can browse the web for current information
- Can analyze connected repos
- Can synthesize findings into structured output
- Works asynchronously — fire and forget

The command would bridge hyperyolo's RFC system with ChatGPT's research capabilities.

## Proposed Workflow

```
/research model-management.md
```

1. **Read the RFC** — Parse the futures doc, extract:
   - The idea summary
   - The "why" / motivation
   - All open questions
   - Related files mentioned

2. **Gather codebase context** — Automatically include:
   - Relevant source files mentioned in RFC
   - Related architecture docs
   - Current patterns/implementations that the RFC would touch

3. **Generate research prompt** — Output a structured prompt like:

```markdown
# Research Request: Model Management for hyperyolo

## Context
hyperyolo is a CLI wrapper for AI coding agents (Codex, Claude, Gemini).
[... brief project summary ...]

## The Proposal
[... RFC idea section ...]

## Motivation
[... RFC why section ...]

## Open Questions to Research
1. What's the current model selection behavior in similar tools?
2. How do other CLI tools handle user configuration?
3. [... each open question from RFC ...]

## Relevant Codebase Files
<details>
<summary>src/adapters/types.ts</summary>
[file contents]
</details>
[... other relevant files ...]

## Deliverables
Please research the open questions above and provide:
1. Findings for each question with sources
2. Recommended approach with rationale
3. Potential risks or concerns
4. Suggested implementation phases
```

4. **User pastes into ChatGPT** — With repo connected, ChatGPT can:
   - Browse for current best practices
   - Look at how other tools solve this
   - Analyze the codebase for impacts
   - Produce structured findings

5. **Feed results back** — A second command or manual process to:
   - Update RFC with research findings
   - Mark open questions as answered
   - Change status to `researched`
   - Optionally generate implementation tasks

## Open Questions

- [ ] How much codebase context to include? (Too little = missing info, too much = noise)
- [ ] Should we auto-detect relevant files or require explicit listing in RFC?
- [ ] Output format — clipboard copy? File? Direct paste somehow?
- [ ] How to structure the return flow? (manual paste-back vs. command to import findings)
- [ ] Should this work with other research tools? (Perplexity, Claude web, etc.)
- [ ] What if the user doesn't have ChatGPT repo access? Fallback behavior?

## Notes

This is essentially a "prompt compiler" — it takes structured RFC input and compiles it into an optimal research prompt with full context.

Could also work in reverse: `/research-import` takes ChatGPT's output and updates the RFC automatically.

The key insight is that hyperyolo already wraps AI CLIs — this extends that philosophy to the planning/research phase, not just execution.

## Related

- `/rfc` command — Creates the intake documents this would process
- `docs/futures/README.md` — Defines the RFC lifecycle
- `.claude/agents/rfc-intake.md` — Intake agent guidelines
- Missing: `/plan` command to go from researched → planned
