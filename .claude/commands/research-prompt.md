# Generate Research Prompt

Generate a research prompt for ChatGPT Deep Research based on an RFC document.

## Instructions

You are generating a research prompt that will be pasted into ChatGPT (with repo access) to research an RFC's open questions.

**Target RFC:** $ARGUMENTS

## Steps

1. **Locate the RFC**
   - Look in `docs/futures/` for the specified file
   - If no extension provided, append `.md`
   - If file not found, list available RFCs and ask user to clarify

2. **Parse the RFC**
   - Extract: Title, Status, The Idea, Why, Open Questions, Notes, Related
   - Identify any files/paths mentioned in the document

3. **Gather codebase context**
   - Read files mentioned in the RFC's "Related" section
   - Read any source files referenced in the document
   - Include relevant architecture docs if the RFC touches core systems
   - Keep context focused — only include what's directly relevant

4. **Generate the research prompt**

   Output a markdown prompt with this structure:

   ```markdown
   # Research Request: [RFC Title]

   ## Project Context

   hyperyolo is a TypeScript CLI that wraps Codex, Claude Code, and Gemini CLI into a unified interface for autonomous AI execution. It spawns official CLIs as subprocesses and normalizes their interfaces.

   **Tech stack:** Node.js 18+, TypeScript, Commander, execa
   **Repository structure:** src/adapters/ (backend adapters), src/core/ (executor, sessions), docs/ (architecture, research)

   ## The Proposal

   [RFC "The Idea" section]

   ## Motivation

   [RFC "Why" section]

   ## Open Questions to Research

   [Numbered list of open questions from RFC, each as a clear research task]

   ## Current Implementation Context

   <details>
   <summary>[filename]</summary>

   ```typescript
   [file contents]
   ```

   </details>

   [Repeat for each relevant file]

   ## Additional Notes from RFC

   [RFC "Notes" section if present]

   ## Deliverables

   Please research the open questions above and provide:

   1. **Findings** — Answer each open question with evidence and sources
   2. **Recommendations** — Suggested approach with rationale
   3. **Risks & Concerns** — Potential issues or tradeoffs to consider
   4. **Implementation Phases** — If applicable, suggested order of work
   5. **References** — Links to relevant docs, examples, or prior art

   Format your response so it can be pasted back into the RFC document to update the research findings.
   ```

5. **Output the prompt**
   - Display the complete prompt in a code block
   - Tell user to copy and paste into ChatGPT with repo access enabled

## Example Usage

```
/research-prompt model-management
```

Generates a research prompt for `docs/futures/model-management.md`

## Notes

- Keep codebase context focused — too much noise hurts research quality
- If an RFC has no open questions, suggest the user add some first
- The prompt should be self-contained — ChatGPT shouldn't need to ask clarifying questions
