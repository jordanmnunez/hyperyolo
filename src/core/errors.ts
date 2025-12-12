export type ErrorCategory =
  | 'cli-binary'
  | 'auth'
  | 'session'
  | 'process'
  | 'output-parsing'
  | 'network'
  | 'filesystem';

export type ErrorSeverity = 'fatal' | 'retryable' | 'warning';

type BaseError<Category extends ErrorCategory, Code extends string, Meta = Record<string, unknown>> = {
  category: Category;
  code: Code;
  severity?: ErrorSeverity;
  meta?: Meta;
  cause?: unknown;
};

export type CliBinaryErrorCode = 'CLI_NOT_FOUND' | 'CLI_NOT_EXECUTABLE' | 'CLI_UNSUPPORTED_PLATFORM';
export type AuthErrorCode =
  | 'AUTH_INVALID_KEY'
  | 'AUTH_EXPIRED_TOKEN'
  | 'AUTH_MISSING_CREDENTIALS'
  | 'AUTH_RATE_LIMITED';
export type SessionErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'SESSION_CORRUPTED'
  | 'SESSION_NATIVE_MISMATCH';
export type ProcessErrorCode =
  | 'PROCESS_TIMEOUT'
  | 'PROCESS_NON_ZERO_EXIT'
  | 'PROCESS_HANG'
  | 'PROCESS_INTERRUPTED';
export type OutputParsingErrorCode =
  | 'PARSE_MALFORMED_JSON'
  | 'PARSE_MISSING_FIELDS'
  | 'PARSE_SESSION_ID_MISSING'
  | 'PARSE_UNEXPECTED_FORMAT';
export type NetworkErrorCode = 'NETWORK_TIMEOUT' | 'NETWORK_DNS_FAILURE' | 'NETWORK_TLS_ERROR';
export type FileSystemErrorCode =
  | 'FS_CONFIG_UNWRITABLE'
  | 'FS_SESSION_FILE_CORRUPTED'
  | 'FS_DISK_FULL';

export type HyperYoloErrorCode =
  | CliBinaryErrorCode
  | AuthErrorCode
  | SessionErrorCode
  | ProcessErrorCode
  | OutputParsingErrorCode
  | NetworkErrorCode
  | FileSystemErrorCode;

export type CliBinaryError = BaseError<
  'cli-binary',
  CliBinaryErrorCode,
  { binary?: string; path?: string; platform?: NodeJS.Platform; arch?: string }
>;
export type AuthError = BaseError<
  'auth',
  AuthErrorCode,
  { backend?: string; credentialSource?: string }
>;
export type SessionError = BaseError<
  'session',
  SessionErrorCode,
  { sessionId?: string; backend?: string; nativeSessionId?: string }
>;
export type ProcessError = BaseError<
  'process',
  ProcessErrorCode,
  { backend?: string; exitCode?: number; signal?: string; timeoutReason?: 'absolute' | 'idle' }
>;
export type OutputParsingError = BaseError<
  'output-parsing',
  OutputParsingErrorCode,
  { backend?: string; outputFormat?: string }
>;
export type NetworkError = BaseError<
  'network',
  NetworkErrorCode,
  { backend?: string; hostname?: string }
>;
export type FileSystemError = BaseError<
  'filesystem',
  FileSystemErrorCode,
  { path?: string }
>;

export type HyperYoloError =
  | CliBinaryError
  | AuthError
  | SessionError
  | ProcessError
  | OutputParsingError
  | NetworkError
  | FileSystemError;

export interface UserFacingError {
  category: ErrorCategory;
  code: HyperYoloErrorCode;
  severity: ErrorSeverity;
  headline: string;
  detail?: string;
  recovery?: string;
}

export const DEFAULT_ERROR_SEVERITY = {
  CLI_NOT_FOUND: 'fatal',
  CLI_NOT_EXECUTABLE: 'fatal',
  CLI_UNSUPPORTED_PLATFORM: 'fatal',
  AUTH_INVALID_KEY: 'fatal',
  AUTH_EXPIRED_TOKEN: 'retryable',
  AUTH_MISSING_CREDENTIALS: 'fatal',
  AUTH_RATE_LIMITED: 'retryable',
  SESSION_NOT_FOUND: 'warning',
  SESSION_EXPIRED: 'warning',
  SESSION_CORRUPTED: 'warning',
  SESSION_NATIVE_MISMATCH: 'warning',
  PROCESS_TIMEOUT: 'retryable',
  PROCESS_NON_ZERO_EXIT: 'fatal',
  PROCESS_HANG: 'retryable',
  PROCESS_INTERRUPTED: 'warning',
  PARSE_MALFORMED_JSON: 'warning',
  PARSE_MISSING_FIELDS: 'warning',
  PARSE_SESSION_ID_MISSING: 'warning',
  PARSE_UNEXPECTED_FORMAT: 'warning',
  NETWORK_TIMEOUT: 'retryable',
  NETWORK_DNS_FAILURE: 'retryable',
  NETWORK_TLS_ERROR: 'fatal',
  FS_CONFIG_UNWRITABLE: 'fatal',
  FS_SESSION_FILE_CORRUPTED: 'warning',
  FS_DISK_FULL: 'fatal'
} satisfies Record<HyperYoloErrorCode, ErrorSeverity>;

export function formatUserFacingError(error: HyperYoloError): UserFacingError {
  const severity = error.severity ?? DEFAULT_ERROR_SEVERITY[error.code];
  switch (error.code) {
    case 'CLI_NOT_FOUND':
      return {
        category: 'cli-binary',
        code: error.code,
        severity,
        headline: `ENGINE NOT FOUND: ${labelForBinary(error)}`,
        detail: 'Cannot strap in an engine that does not exist.',
        recovery: 'Install the CLI and ensure it is on PATH, then retry.'
      };
    case 'CLI_NOT_EXECUTABLE':
      return {
        category: 'cli-binary',
        code: error.code,
        severity,
        headline: `${labelForBinary(error)} CLI is not executable`,
        detail: 'The binary exists but cannot be executed (permissions or file mode).',
        recovery: 'Fix permissions (chmod +x) or reinstall the CLI.'
      };
    case 'CLI_UNSUPPORTED_PLATFORM':
      return {
        category: 'cli-binary',
        code: error.code,
        severity,
        headline: `${labelForBinary(error)} CLI unsupported on this platform`,
        detail: `Detected platform ${error.meta?.platform ?? 'unknown'}/${error.meta?.arch ?? 'unknown'} is not supported by the backend CLI.`,
        recovery: 'Install a compatible build or use a supported OS/architecture.'
      };
    case 'AUTH_INVALID_KEY':
      return {
        category: 'auth',
        code: error.code,
        severity,
        headline: 'API key rejected by backend',
        detail: 'The backend CLI reported an invalid or unknown API key.',
        recovery: 'Re-authenticate with the CLI login command or update the key environment variable.'
      };
    case 'AUTH_EXPIRED_TOKEN':
      return {
        category: 'auth',
        code: error.code,
        severity,
        headline: 'Authentication token expired',
        detail: 'Credentials were accepted previously but have expired for this backend.',
        recovery: 'Log in again to refresh credentials, then rerun the command.'
      };
    case 'AUTH_MISSING_CREDENTIALS':
      return {
        category: 'auth',
        code: error.code,
        severity,
        headline: 'Credentials missing for backend',
        detail: 'No usable credentials were found for the requested backend.',
        recovery: 'Run the backend CLI login flow or set the required environment variables.'
      };
    case 'AUTH_RATE_LIMITED':
      return {
        category: 'auth',
        code: error.code,
        severity,
        headline: 'Requests are being rate limited',
        detail: 'The backend throttled requests because of rate limits.',
        recovery: 'Wait and retry, reduce concurrency, or use a higher quota account.'
      };
    case 'SESSION_NOT_FOUND':
      return {
        category: 'session',
        code: error.code,
        severity,
        headline: `Session ${error.meta?.sessionId ?? 'ID'} not found`,
        detail: 'The requested session ID could not be located in the store or by the backend.',
        recovery: 'Start a new session or list existing sessions before resuming.'
      };
    case 'SESSION_EXPIRED':
      return {
        category: 'session',
        code: error.code,
        severity,
        headline: `Session ${error.meta?.sessionId ?? 'ID'} has expired`,
        detail: 'The backend rejected the session because it is no longer active.',
        recovery: 'Start a fresh run; hyperyolo will keep the stale mapping for inspection.'
      };
    case 'SESSION_CORRUPTED':
      return {
        category: 'session',
        code: error.code,
        severity,
        headline: `Session record ${error.meta?.sessionId ?? ''} is corrupted`,
        detail: 'The session store entry was unreadable or missing required fields.',
        recovery: 'Remove or repair the session record; new runs will create fresh sessions.'
      };
    case 'SESSION_NATIVE_MISMATCH':
      return {
        category: 'session',
        code: error.code,
        severity,
        headline: 'Native session mismatch',
        detail: 'The stored native session ID does not match the backend or was rejected.',
        recovery: 'Resume with the correct backend or start a new session to continue.'
      };
    case 'PROCESS_TIMEOUT':
      return {
        category: 'process',
        code: error.code,
        severity,
        headline: 'ENGINE STALLED',
        detail:
          error.meta?.timeoutReason === 'idle'
            ? 'The engine went silent. No output before idle timeout.'
            : 'The burn exceeded the runtime limit.',
        recovery: 'Rerun with higher timeout values or --no-timeout if intentionally long-running.'
      };
    case 'PROCESS_NON_ZERO_EXIT':
      return {
        category: 'process',
        code: error.code,
        severity,
        headline: `ENGINE FAILURE — exit code ${error.meta?.exitCode ?? 'non-zero'}`,
        detail: 'The engine terminated abnormally. Check output for details.',
        recovery: 'Inspect the CLI output for validation errors, fix inputs, and retry.'
      };
    case 'PROCESS_HANG':
      return {
        category: 'process',
        code: error.code,
        severity,
        headline: 'ENGINE UNRESPONSIVE',
        detail: 'The engine stopped producing output. Possible hang condition.',
        recovery: 'Retry with timeouts enabled or upgrade the backend CLI if a fix is available.'
      };
    case 'PROCESS_INTERRUPTED':
      return {
        category: 'process',
        code: error.code,
        severity,
        headline: `BURN INTERRUPTED — ${error.meta?.signal ?? 'signal'}`,
        detail: 'The burn was stopped by a user or system signal.',
        recovery: 'Re-run the command when ready; partial output may be incomplete.'
      };
    case 'PARSE_MALFORMED_JSON':
      return {
        category: 'output-parsing',
        code: error.code,
        severity,
        headline: 'Backend emitted malformed JSON',
        detail: 'Streamed JSON could not be parsed; stats and session parsing were skipped.',
        recovery: 'Retry without extra logging or upgrade the CLI to a version with stable output.'
      };
    case 'PARSE_MISSING_FIELDS':
      return {
        category: 'output-parsing',
        code: error.code,
        severity,
        headline: 'Expected fields were missing from backend output',
        detail: 'The parsed payload lacked required stats fields.',
        recovery: 'Collect the raw output for debugging and file a bug with the backend CLI.'
      };
    case 'PARSE_SESSION_ID_MISSING':
      return {
        category: 'output-parsing',
        code: error.code,
        severity,
        headline: 'Session ID not found in output',
        detail: 'The backend did not expose a session identifier; resume is disabled for this run.',
        recovery: 'Resume manually with a native session ID if available or start a new session.'
      };
    case 'PARSE_UNEXPECTED_FORMAT':
      return {
        category: 'output-parsing',
        code: error.code,
        severity,
        headline: 'Output format was not recognized',
        detail: 'The backend emitted output in an unexpected format for the selected mode.',
        recovery: 'Retry with the recommended output flags or capture the output for debugging.'
      };
    case 'NETWORK_TIMEOUT':
      return {
        category: 'network',
        code: error.code,
        severity,
        headline: 'Network request timed out',
        detail: 'The backend could not reach its service endpoint before timing out.',
        recovery: 'Check connectivity or retry later; shorter prompts may help in poor networks.'
      };
    case 'NETWORK_DNS_FAILURE':
      return {
        category: 'network',
        code: error.code,
        severity,
        headline: 'DNS resolution failed for backend endpoint',
        detail: `The hostname ${error.meta?.hostname ?? ''} could not be resolved.`,
        recovery: 'Verify DNS settings, VPN/proxy configuration, and try again.'
      };
    case 'NETWORK_TLS_ERROR':
      return {
        category: 'network',
        code: error.code,
        severity,
        headline: 'TLS/SSL handshake failed',
        detail: 'Secure connection to the backend failed due to certificate or proxy issues.',
        recovery: 'Trust the corporate proxy certificate (NODE_EXTRA_CA_CERTS) or retry on a clean network.'
      };
    case 'FS_CONFIG_UNWRITABLE':
      return {
        category: 'filesystem',
        code: error.code,
        severity,
        headline: 'Config directory is not writable',
        detail: 'hyperyolo cannot write to the configuration directory.',
        recovery: 'Adjust permissions or set XDG_CONFIG_HOME to a writable path.'
      };
    case 'FS_SESSION_FILE_CORRUPTED':
      return {
        category: 'filesystem',
        code: error.code,
        severity,
        headline: 'Session store is corrupted',
        detail: 'The session file could not be read or parsed.',
        recovery: 'Back up and delete the session file; hyperyolo will recreate it on the next run.'
      };
    case 'FS_DISK_FULL':
      return {
        category: 'filesystem',
        code: error.code,
        severity,
        headline: 'Disk is full',
        detail: 'Writing session or config data failed because the disk is full.',
        recovery: 'Free disk space and rerun; temporary files may need cleanup.'
      };
    default: {
      const _exhaustiveCheck: never = error;
      return _exhaustiveCheck;
    }
  }
}

function labelForBinary(error: CliBinaryError): string {
  return error.meta?.binary ?? 'Backend';
}
