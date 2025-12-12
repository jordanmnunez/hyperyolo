# Futures

A dumping ground for ideas, RFCs, and potential features for hyperyolo.

## What is this?

This directory contains working idea documents—high-level explorations of features, improvements, or directions the project might take. These are **not** implementation specs; they're starting points for discussion, research, and planning.

## Document Lifecycle

```
[Intake] → [Active] → [Researched] → [Planned/Rejected]
```

1. **Intake**: Raw idea submitted via `/rfc` command, cleaned up by the intake agent
2. **Active**: Idea is being explored or discussed
3. **Researched**: Investigation complete, findings documented
4. **Planned**: Accepted and queued for implementation (moves to architecture/ or PRD)
5. **Rejected**: Not pursuing, but kept for reference with rationale

## Document Format

Each future document follows a loose structure:

```markdown
# [Title]

Status: intake | active | researched | planned | rejected
Created: YYYY-MM-DD
Last Updated: YYYY-MM-DD

## The Idea

High-level description of what this is about.

## Why

Motivation, pain points, or opportunities this addresses.

## Open Questions

Things that need research or decisions.

## Notes

Running notes, links, related ideas.

## Related

Links to other futures or docs.
```

## How to Add Ideas

Use the `/rfc` command with your idea:

```bash
# In Claude Code session
/rfc Support for running multiple backends in parallel and merging results
```

The RFC intake agent will:
1. Check if your idea fits an existing document
2. If new, create a document with a slug-based filename
3. Clean up your idea into coherent sections
4. Leave open questions for future research

## Naming Convention

Files use kebab-case slugs: `parallel-backend-execution.md`, `mcp-server-integration.md`

## Current Futures

<!-- This section auto-updates based on directory contents -->
*No futures yet—be the first to add one!*
