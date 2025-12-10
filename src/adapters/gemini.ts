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
import { GEMINI_INIT_SESSION_ID_REGEX } from '../core/session-id.js';

const execAsync = promisify(exec);

/**
 * UUID pattern for session IDs.
 */
const SESSION_ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Pattern to extract stats from result event.
 * Matches: {"type":"result",...,"stats":{"total_tokens":128,...,"duration_ms":1142,...}}
 */
const RESULT_STATS_PATTERN = /"type"\s*:\s*"result"[^\n]*"stats"\s*:\s*\{[^}]*"total_tokens"\s*:\s*(\d+)[^}]*"duration_ms"\s*:\s*(\d+)/;

/**
 * Fallback pattern for just session_id in init event.
 */
const INIT_SESSION_ID_PATTERN = /"type"\s*:\s*"init"[^\n]*"session_id"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i;

export const geminiAdapter: BackendAdapter = {
  name: 'gemini',
  sessionIdPattern: SESSION_ID_PATTERN,

  async isAvailable(): Promise<AvailabilityResult> {
    try {
      const { stdout, stderr } = await execAsync('gemini --version');
      const output = stdout || stderr;
      const version = extractSemver(output);

      const baseResult: AvailabilityResult = {
        available: true,
        version: version ?? undefined,
        rawVersionOutput: output.trim()
      };

      return annotateAvailabilityWithVersion('gemini', baseResult, output);
    } catch (error) {
      const err = error as { code?: string; message?: string };

      // Check if command not found
      if (err.code === 'ENOENT' || err.message?.includes('not found')) {
        return {
          available: false,
          error: 'Gemini CLI not found. Install it with: npm install -g @google/gemini-cli (or brew install gemini-cli / npx https://github.com/google-gemini/gemini-cli). Then authenticate with: gemini login --api-key <GEMINI_API_KEY> (or browser login). More info: https://geminicli.com/docs'
        };
      }

      return {
        available: false,
        error: `Failed to check Gemini CLI: ${err.message ?? 'Unknown error'}`
      };
    }
  },

  buildCommand(prompt: string, options: ExecutionOptions): CommandBuildResult {
    const args: string[] = [];

    // YOLO mode (-y enables tools in headless mode)
    // Note: -y does NOT auto-enable sandbox (contrary to some docs)
    args.push('-y');

    // Output format
    args.push('-o', 'stream-json');

    // Model option
    if (options.model) {
      args.push('--model', options.model);
    }

    // Resume: -r <session-id>
    if (options.resumeSessionId) {
      args.push('-r', options.resumeSessionId);
    }

    // The prompt flag and value
    args.push('-p', prompt);

    // Append any raw args at the end
    if (options.rawArgs?.length) {
      args.push(...options.rawArgs);
    }

    return {
      command: 'gemini',
      args
    };
  },

  parseSessionId(chunk: string, accumulated: string): string | null {
    const combined = accumulated + chunk;

    // Try the init event pattern first
    const initMatch = combined.match(GEMINI_INIT_SESSION_ID_REGEX);
    if (initMatch?.[1]) {
      return initMatch[1];
    }

    // Fallback to simpler pattern
    const fallbackMatch = combined.match(INIT_SESSION_ID_PATTERN);
    if (fallbackMatch?.[1]) {
      return fallbackMatch[1];
    }

    return null;
  },

  parseStats(output: string): ExecutionStats | null {
    // Extract stats from result event
    const match = output.match(RESULT_STATS_PATTERN);
    if (match) {
      return {
        tokens: parseInt(match[1], 10),
        durationMs: parseInt(match[2], 10)
      };
    }

    return null;
  }
};
