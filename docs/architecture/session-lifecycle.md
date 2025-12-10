# Session Lifecycle, Expiration, and Cleanup

Design notes for how HyperYOLO tracks, validates, and eventually removes session metadata that maps `hyper_*` IDs to native CLI session IDs.

## Lifecycle
- **Create**: On every run, generate `hyper_<8hex>`, persist `{ backend, nativeId, createdAt, lastSeenAt, lastPrompt }` once the native session ID is parsed. Writes use the session store’s lock/atomic write rules.
- **Resume**: Look up the mapping by HyperYOLO ID, surface a warning if the record is stale (see retention), and pass the native ID to the adapter. Update `lastSeenAt` and `lastPrompt` when the run ends, even if the native CLI rejected the resume.
- **Invalidation**: If the native CLI reports an unknown/expired session, mark the record as `invalid: true` and keep it until the next cleanup pass so the user can inspect it. On successful resumes, clear `invalid`.

## Lifespan and retention assumptions
- Native CLIs do not document retention guarantees; HyperYOLO therefore treats native session validity as best-effort and does not block resuming based on age alone.
- HyperYOLO retention is configurable, defaulting to **30 days** (aligned with the pre-implementation plan). Records older than the retention window are considered **stale**.
- Stale handling: log a warning when using a stale record; if the resume fails, mark the record invalid and recommend cleanup. Successful stale resumes refresh `lastSeenAt` and move the record back inside the window.

## Cleanup strategy
- **Manual first**: Provide a `hyperyolo sessions clean --older-than <duration>` command (default `30d`) to prune stale records and any marked `invalid`. Cleaning is always out-of-band; never delete during an active run.
- **Warning threshold**: If the session store exceeds **5 MB** or **500 records**, emit a non-blocking warning suggesting cleanup.
- **Optional auto-prune**: Allow an opt-in config flag (e.g., `cleanup.onStartup=true`) to prune stale + invalid records on startup. Default is off to avoid surprising deletions.
- **No implicit truncation**: Never delete the most recent N records automatically; cleanup is explicit (manual command or opt-in startup pruning).

## Validation before resume
- **Local checks**: Verify the record schema, backend match, and corruption before attempting resume. If corrupted, mark `invalid` and skip resume.
- **Optimistic remote validation**: Do not preflight the native CLI; attempt resume and rely on native errors. If the CLI rejects the session, capture the error text, flag the record invalid, and surface guidance to re-run without `--resume`.
- **Cache results**: Store the last resume attempt status (`lastResumeStatus: "ok" | "rejected" | "unknown"`) to inform warnings without blocking retries.

## Storage limits
- Default retention window: 30 days (configurable per user; applied by cleanup commands).
- Size guardrails: warn at 5 MB; future enhancement to block writes above a hard cap (e.g., 20 MB) with an override flag.
- Count guardrails: warn above 500 records; cleanup command supports `--max-records` to keep the newest N while dropping older ones.

## User-facing session commands (future)
- `hyperyolo sessions list` — Show HyperYOLO IDs, backend, age, `invalid`/stale flags, and last prompt snippet.
- `hyperyolo sessions show <id>` — Detailed record view including native ID, timestamps, and last resume status.
- `hyperyolo sessions clean [--older-than 30d] [--invalid-only] [--max-records 200]` — Prune stale/invalid records while keeping the newest ones.
- `hyperyolo sessions delete <id>` — Delete a single record (no impact on native CLI storage).
- `hyperyolo sessions export` — Optional future command to dump JSON for backup/debugging.
