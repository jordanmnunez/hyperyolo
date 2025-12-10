# Session Storage Decision (JSON with Locking)

This document records the final decision for the hyperyolo session store and the implementation rules that follow from it.

## Requirements Considered
- **Single-user CLI** with occasional concurrent runs from multiple terminals.
- **Data shape** is small: a map of hyperyolo IDs to native session IDs plus timestamps/prompts.
- **Queries** needed for MVP are trivial (lookup by ID, list all, cleanup); no aggregations.
- **Reliability** matters more than raw performance; corruption on crash must be avoided.
- **Distribution** should stay dependency-light (no native modules or external daemons).

## Decision
Use a **JSON file** stored at `~/.config/hyperyolo/sessions.json`, protected by advisory locking and atomic writes.

## Rationale
- Keeps the MVP dependency-free (no SQLite native bindings) and matches the Node/oclif toolchain.
- The dataset is tiny; JSON reads/writes are cheap and human-inspectable for support.
- Concurrency needs are modest; a lockfile plus atomic rename prevents corruption even with parallel runs.
- Aligns with the pre-implementation plan while leaving a clear migration path to SQLite if future features demand richer queries.

## Data Format
```json
{
  "hyper_abc123": {
    "backend": "claude",
    "nativeId": "claude-session-xyz",
    "createdAt": "2024-12-09T10:00:00Z",
    "lastSeenAt": "2024-12-10T15:00:00Z",
    "lastPrompt": "fix the bug",
    "invalid": false
  }
}
```

## Locking and Write Discipline
- **Locking**: Use `proper-lockfile` (or equivalent) to take an exclusive lock on `sessions.json` before any read-modify-write. Retry with jitter; treat locks older than a reasonable stale window (e.g., 30s) as stale and recover.
- **Atomic writes**: Under the lock, write to `sessions.json.tmp`, `fsync`/close, then `rename` to `sessions.json` (atomic on the same filesystem). Always ensure the parent directory exists with `0700` perms.
- **Read isolation**: Read-only operations may take the same lock briefly to avoid tearing during concurrent writes; if we allow unlocked reads, retry once on JSON parse errors to guard against mid-write views.
- **Failure handling**: If the lock cannot be acquired after retries, emit a clear warning and treat the store as read-only for that operation rather than risking corruption.
- **Implementation defaults**: Lock attempts use `proper-lockfile` with `stale=30s`, `retries` (10 attempts, jittered 25–250ms), and `realpath=false` so the file does not need to pre-exist. Reads try to take the lock and fall back to an unlocked read with a warning if they cannot; writes/updates fail fast on lock errors to avoid corruption. Temp files are `sessions.json.tmp` and are removed if rename fails.

## When to Revisit SQLite
Switch to SQLite if/when:
- We ship built-in `sessions list/show/clean` commands with filtering/sorting over large record sets.
- Multi-user or daemonized usage appears (shared hosts, background agents).
- Session metadata grows beyond the guardrails (e.g., routinely >500 records or >5 MB) and JSON load times become noticeable.
