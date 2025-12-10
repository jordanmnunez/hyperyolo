import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  BackendAdapter,
  AvailabilityResult,
  CommandBuildResult,
  ExecutionOptions,
  ExecutionStats
} from './types.js';
import { annotateAvailabilityWithVersion, extractSemver } from './versioning.js';
import { CLAUDE_SESSION_ID_REGEX } from '../core/session-id.js';

const execAsync = promisify(exec);

/**
 * UUID pattern for session IDs.
 */
const SESSION_ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Pattern to extract result event with duration.
 */
const RESULT_EVENT_PATTERN = /"type"\s*:\s*"result"[^\n]*"duration_ms"\s*:\s*(\d+)/;

/**
 * Pattern to extract usage from assistant message.
 */
const USAGE_PATTERN = /"usage"\s*:\s*\{[^}]*"input_tokens"\s*:\s*(\d+)[^}]*"output_tokens"\s*:\s*(\d+)/;

export const claudeAdapter: BackendAdapter = {
  name: 'claude',
  sessionIdPattern: SESSION_ID_PATTERN,

  async isAvailable(): Promise<AvailabilityResult> {
    try {
      const { stdout, stderr } = await execAsync('claude --version');
      const output = stdout || stderr;
      const version = extractSemver(output);

      const baseResult: AvailabilityResult = {
        available: true,
        version: version ?? undefined,
        rawVersionOutput: output.trim()
      };

      return annotateAvailabilityWithVersion('claude', baseResult, output);
    } catch (error) {
      const err = error as { code?: string; message?: string };

      // Check if command not found
      if (err.code === 'ENOENT' || err.message?.includes('not found')) {
        return {
          available: false,
          error: 'Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code. Then authenticate with: ANTHROPIC_API_KEY=<your key> claude setup-token. More info: https://docs.anthropic.com/claude/docs/claude-code-cli'
        };
      }

      return {
        available: false,
        error: `Failed to check Claude CLI: ${err.message ?? 'Unknown error'}`
      };
    }
  },

  buildCommand(prompt: string, options: ExecutionOptions): CommandBuildResult {
    const args: string[] = [];

    // Permission flags first
    args.push('--dangerously-skip-permissions');

    // Output format - stream-json REQUIRES --verbose
    args.push('--output-format', 'stream-json');
    args.push('--verbose');

    // Model option
    if (options.model) {
      args.push('--model', options.model);
    }

    // Resume: --resume <nativeId> BEFORE -p flag
    if (options.resumeSessionId) {
      args.push('--resume', options.resumeSessionId);
    }

    // The prompt flag and value
    args.push('-p', prompt);

    // Append any raw args at the end
    if (options.rawArgs?.length) {
      args.push(...options.rawArgs);
    }

    return {
      command: 'claude',
      args
    };
  },

  parseSessionId(chunk: string, accumulated: string): string | null {
    const combined = accumulated + chunk;

    // Look for session_id in JSON output
    const match = combined.match(CLAUDE_SESSION_ID_REGEX);
    if (match?.[1]) {
      return match[1];
    }

    return null;
  },

  parseStats(output: string): ExecutionStats | null {
    const stats: ExecutionStats = {};
    let foundSomething = false;

    // Extract duration from result event
    const resultMatch = output.match(RESULT_EVENT_PATTERN);
    if (resultMatch) {
      stats.durationMs = parseInt(resultMatch[1], 10);
      foundSomething = true;
    }

    // Extract token usage
    const usageMatch = output.match(USAGE_PATTERN);
    if (usageMatch) {
      const inputTokens = parseInt(usageMatch[1], 10);
      const outputTokens = parseInt(usageMatch[2], 10);
      stats.tokens = inputTokens + outputTokens;
      stats.raw = { inputTokens, outputTokens };
      foundSomething = true;
    }

    return foundSomething ? stats : null;
  }
};
