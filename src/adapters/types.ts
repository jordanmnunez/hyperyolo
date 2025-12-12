import type { BackendName } from '../core/executor.js';
import type { ThinkingLevel } from '../core/thinking.js';

export type OutputFormat = 'stream-json' | 'json' | 'text';

export interface ExecutionOptions {
  resumeSessionId?: string;
  model?: string;
  systemPrompt?: string;
  outputFormat?: OutputFormat;
  /**
   * Thinking/reasoning effort level.
   * - Codex: Passed as --reasoning-effort flag
   * - Claude/Gemini: Prepends thinking instructions to prompt
   */
  thinking?: ThinkingLevel;
  /**
   * Extra backend-specific args to append after the generated args.
   * Callers should sanitize these; adapters must not mutate the array.
   */
  rawArgs?: string[];
}

export interface ExecutionStats {
  tokens?: number;
  costUsd?: number;
  durationMs?: number;
  // Raw payload from the backend for callers that want to log or inspect.
  raw?: unknown;
}

export type VersionStatus = 'ok' | 'warn' | 'unsupported';

export interface VersionCheckResult {
  backend: BackendName;
  detectedVersion?: string | null;
  minimumSupported: string;
  maximumTested: string;
  blockedVersions: string[];
  status: VersionStatus;
  reasons: string[];
}

export interface AvailabilityResult {
  available: boolean;
  version?: string;
  rawVersionOutput?: string;
  warnings?: string[];
  versionStatus?: VersionCheckResult;
  /**
   * User-facing error string when availability cannot be determined.
   * When set, available must be false.
   */
  error?: string;
}

export interface CommandBuildResult {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface BackendAdapter {
  name: BackendName;
  /**
   * Regex describing the native session ID format; used for validation and tests.
   */
  sessionIdPattern: RegExp;

  /**
   * Determine whether the underlying CLI is reachable and report its version.
   * Should never throw: return { available: false, error } when detection fails.
   */
  isAvailable(): Promise<AvailabilityResult>;

  /**
   * Translate the unified prompt/options into a CLI command invocation.
   * Should include mandatory flags (yolo/auto-approve, output-format, resume)
   * and leave room for caller-provided rawArgs.
   */
  buildCommand(prompt: string, options: ExecutionOptions): CommandBuildResult;

  /**
   * Inspect the latest sanitized output chunk plus accumulated transcript to find a session ID.
   * Called repeatedly; must return the first discovered ID or null when not found.
   * Must not throw if the ID never appears—callers treat null as "resume disabled."
   */
  parseSessionId(chunk: string, accumulated: string): string | null;

  /**
   * Parse completion stats from the full sanitized output. Return null when stats
   * are unavailable or malformed rather than throwing; callers surface a warning.
   */
  parseStats(output: string): ExecutionStats | null;
}

export type { BackendName };
