# Documentation Map

> **hyperyolo** — A cobbled execution unit. Built to be an OSHA violation.

Use this index to navigate the docs. Know what you're strapping in.

## Start Here
- `docs/status.md` — Current implementation vs PRD, gaps, and next steps.
- `docs/PRD.md` — Product requirements and scope.
- `docs/pre-implementation-plan.md` — Locked decisions, version baselines, and implementation order.

## Architecture & Implementation
- `docs/architecture/backend-adapter-contract.md` — Canonical adapter interface and parsing rules.
- `docs/architecture/timeout-handling.md` / `docs/architecture/signal-handling.md` — Runtime guardrails.
- `docs/architecture/session-storage.md` / `docs/architecture/session-lifecycle.md` — Session persistence, locking, and cleanup.
- `docs/architecture/ansi-handling.md` / `docs/architecture/output-formats.md` — Streaming, teeing, and parsing without ANSI issues.
- `docs/architecture/error-handling.md` — Error taxonomy and user-facing messaging.

## Compatibility & Changelog
- `docs/cli-compatibility.md` — Version matrix and detection rules.
- `docs/cli-version-changelog.md` — Release-by-release impact notes.

## Research & References
- `docs/ai-cli-comparison.md` — Flag translations and provider feature parity.
- `docs/research/` — CLI verification reports, prompts, and analysis.
- `docs/architecture/cli-framework-decision.md` — Commander vs oclif rationale.

## Contributing Workflow
- Read `docs/status.md` to understand current gaps.
- Align changes with `docs/PRD.md` and the architecture docs for the area you are touching.
- Update `docs/status.md` and `docs/cli-version-changelog.md` after shipping meaningful behavior changes.
