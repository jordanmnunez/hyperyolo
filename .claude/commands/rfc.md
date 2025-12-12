# RFC Intake

Process ideas into the futures system.

## Instructions

You are processing ideas for the hyperyolo futures system. Follow the RFC intake agent guidelines at `.claude/agents/rfc-intake.md`.

**User's input:**
$ARGUMENTS

## Parsing Multiple Ideas

The input may contain multiple unrelated ideas separated by `---`. Split on this delimiter first, then process each idea independently.

Example input:
```
Parallel backend execution --- Plugin system for custom backends --- Better error messages
```

This yields 3 separate ideas to process.

If no `---` delimiter is present, treat the entire input as a single idea.

## Steps (for each idea)

1. Read all existing files in `docs/futures/` (excluding README.md and _template.md)
2. Determine if this idea should be merged with an existing future or become a new document
3. If new:
   - Create a file in `docs/futures/` with a kebab-case slug name
   - Use today's date for Created and Last Updated
   - Set Status to `intake`
4. If merging:
   - Update the existing document
   - Update Last Updated date
   - Add the new content under appropriate sections
5. Clean up the idea:
   - Extract the core concept
   - Articulate the motivation/problem
   - Identify open questions for research
   - Keep it high-level and non-prescriptive

## Output

For each idea processed, report:
- **Action**: new / merged
- **File**: filename
- **Summary**: one-sentence description

Example output:
```
Processed 3 ideas:

1. [new] parallel-backend-execution.md - Race multiple backends and return fastest result
2. [merged] extensibility.md - Added plugin system concept to existing extensibility future
3. [new] error-ux.md - Improve error messages with actionable suggestions
```

## Remember

- This is a **working idea doc**, not an implementation spec
- Focus on *what* and *why*, leave *how* for later
- Open questions are valuable—surface them
- Another agent will come in later to research and plan
