# Error Handling Strategy

How hyperyolo detects, classifies, and reports failures without blocking streaming output or corrupting session data.

## Goals
- Normalize error surfaces across backends while keeping native CLI output intact.
- Prefer **graceful degradation**: keep streaming, disable resume/stats when parsing fails, and fall back to new sessions when mappings break.
- Return actionable, non-ambiguous messages with a recovery hint for every failure mode in scope.

## Principles
- **Non-throwing detection**: `isAvailable()` returns `{ available: false, error }` instead of throwing; parser hooks return `null` on failure.
- **Preserve stdout/stderr**: never swallow backend output; parsing occurs on sanitized copies.
- **Resume safety first**: do not persist unknown or partial session IDs; session writes stay atomic and locked.
- **Consistent taxonomy**: all errors map into the type hierarchy in `src/core/errors.ts` with defaults for severity and user copy.
- **Idempotent cleanup**: signal/timeout paths share the same teardown to avoid double-kill or partial writes.

## Taxonomy and messaging
- Types live in `src/core/errors.ts`:
  - Categories: `cli-binary`, `auth`, `session`, `process`, `output-parsing`, `network`, `filesystem`
  - Error codes: `CLI_NOT_FOUND`, `CLI_NOT_EXECUTABLE`, `CLI_UNSUPPORTED_PLATFORM`, `AUTH_INVALID_KEY`, `AUTH_EXPIRED_TOKEN`, `AUTH_MISSING_CREDENTIALS`, `AUTH_RATE_LIMITED`, `SESSION_NOT_FOUND`, `SESSION_EXPIRED`, `SESSION_CORRUPTED`, `SESSION_NATIVE_MISMATCH`, `PROCESS_TIMEOUT`, `PROCESS_NON_ZERO_EXIT`, `PROCESS_HANG`, `PROCESS_INTERRUPTED`, `PARSE_MALFORMED_JSON`, `PARSE_MISSING_FIELDS`, `PARSE_SESSION_ID_MISSING`, `PARSE_UNEXPECTED_FORMAT`, `NETWORK_TIMEOUT`, `NETWORK_DNS_FAILURE`, `NETWORK_TLS_ERROR`, `FS_CONFIG_UNWRITABLE`, `FS_SESSION_FILE_CORRUPTED`, `FS_DISK_FULL`
  - Severities: `fatal` (stop run), `retryable` (user can retry after backoff/flag tweaks), `warning` (continue with degraded features).
- `formatUserFacingError(error)` returns the headline, detail, recovery text, and severity; `DEFAULT_ERROR_SEVERITY` provides consistent defaults when `severity` is omitted.

## Category playbooks

### CLI binary errors
- Triggers: ENOENT (binary missing), EACCES (not executable), wrong platform/arch.
- Handling: check availability before spawn; short-circuit with `CLI_NOT_FOUND`/`CLI_NOT_EXECUTABLE`/`CLI_UNSUPPORTED_PLATFORM` and avoid spawning.
- User message: direct to install or fix permissions; never tell the user to “check logs”—point to PATH/permission fixes.

### Authentication errors
- Triggers: backend rejects key/token, missing credentials, or rate limit responses.
- Handling: surface `AUTH_INVALID_KEY`/`AUTH_EXPIRED_TOKEN`/`AUTH_MISSING_CREDENTIALS`; treat HTTP 429/CLI throttling as `AUTH_RATE_LIMITED` (retryable).
- Recovery: instruct login/reauth, refresh tokens, or wait/reduce concurrency; keep stderr visible for provider-specific instructions.

### Session errors
- Triggers: resume ID not in store, backend rejects native ID, corrupted store entry, or backend mismatch.
- Handling: do not write new mappings when session ID is unknown; mark resume as disabled for this run and log a warning (`SESSION_NOT_FOUND`, `SESSION_EXPIRED`, `SESSION_CORRUPTED`, `SESSION_NATIVE_MISMATCH`).
- Recovery: start fresh session, clean the store, or resume with the correct backend; keep stale records for inspection.

### Process errors
- Triggers: timeout (idle/absolute), non-zero exit, hang detection, or signal interruption.
- Handling: reuse `executeWithTimeout` + signal flow; on timeout or hang, send SIGTERM → SIGKILL after grace, then raise `PROCESS_TIMEOUT`/`PROCESS_HANG`. Non-zero exits map to `PROCESS_NON_ZERO_EXIT`; user/system signals map to `PROCESS_INTERRUPTED`.
- Recovery: suggest increasing/turning off timeouts for long jobs, upgrading CLI for hang fixes, or inspecting stdout/stderr for validation failures.

### Output parsing errors
- Triggers: malformed JSON, missing stats fields, missing session ID, or unexpected format for the selected output mode.
- Handling: keep streaming raw output; parsing failures emit `PARSE_*` warnings, disable resume/stats for the run, and avoid throwing.
- Recovery: retry with recommended flags (`--output-format stream-json`/`--json`), upgrade the CLI, or provide the raw output for debugging.

### Network errors
- Triggers: connection timeout, DNS failure, TLS handshake errors from the backend CLI.
- Handling: classify into `NETWORK_TIMEOUT`, `NETWORK_DNS_FAILURE`, or `NETWORK_TLS_ERROR` based on stderr/error codes; label as retryable except TLS (often configuration).
- Recovery: check connectivity/VPN/proxy, trust corporate CA via `NODE_EXTRA_CA_CERTS`, and retry after backoff.

### File system errors
- Triggers: unwritable config dir, corrupted session file, disk full during writes.
- Handling: guard session writes with locking + temp-write/rename; map to `FS_CONFIG_UNWRITABLE`, `FS_SESSION_FILE_CORRUPTED`, or `FS_DISK_FULL`. Fall back to read-only mode when writes fail and warn the user.
- Recovery: fix permissions or XDG path, delete/repair corrupted store, free disk space; leave temp files cleaned on failure.

## Propagation rules
- Surface user-facing errors via `formatUserFacingError`; keep the original `cause` for logging/telemetry.
- Warning-severity parsing errors must not flip the process exit code; fatal/retryable categories do.
- Always emit the footer when possible, but mark runs aborted on timeout/signal or when resume is disabled.
