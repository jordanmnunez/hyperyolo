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
import {
  CODEX_TEXT_SESSION_ID_REGEX,
  CODEX_JSON_THREAD_ID_REGEX
} from '../core/session-id.js';
import { resolveModelTier } from '../core/model-tiers.js';
import { CODEX_REASONING_EFFORT_MAP } from '../core/thinking.js';

const execAsync = promisify(exec);

/**
 * UUID pattern for session IDs.
 */
const SESSION_ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Default model for Codex: best-tier for autonomous execution.
 *
 * Uses gpt-5.1-codex-max because GPT-5.2 models are only available
 * for API accounts, not ChatGPT accounts. Most users authenticate
 * via ChatGPT, so we use the best model available to them.
 *
 * API users can override with: --model gpt-5.2-pro
 */
export const CODEX_DEFAULT_MODEL = 'gpt-5.1-codex-max';

/**
 * Pattern to extract tokens from text output: "tokens used 357"
 */
const TEXT_TOKENS_PATTERN = /tokens used\s+(\d+)/i;

/**
 * Pattern to extract usage from JSON output.
 * Matches: "turn.completed" event with usage object
 */
const JSON_USAGE_PATTERN = /"type"\s*:\s*"turn\.completed"[^\n]*"usage"\s*:\s*\{[^}]*"input_tokens"\s*:\s*(\d+)[^}]*"output_tokens"\s*:\s*(\d+)/;

export const codexAdapter: BackendAdapter = {
  name: 'codex',
  sessionIdPattern: SESSION_ID_PATTERN,

  async isAvailable(): Promise<AvailabilityResult> {
    try {
      const { stdout, stderr } = await execAsync('codex --version');
      const output = stdout || stderr;
      const version = extractSemver(output);

      const baseResult: AvailabilityResult = {
        available: true,
        version: version ?? undefined,
        rawVersionOutput: output.trim()
      };

      return annotateAvailabilityWithVersion('codex', baseResult, output);
    } catch (error) {
      const err = error as { code?: string; message?: string };

      // Check if command not found
      if (err.code === 'ENOENT' || err.message?.includes('not found')) {
        return {
          available: false,
          error: 'Codex CLI not found. Install it with: npm install -g @openai/codex (or brew install --cask codex). Then sign in with: codex (choose "Sign in with ChatGPT"). More info: https://github.com/openai/codex'
        };
      }

      return {
        available: false,
        error: `Failed to check Codex CLI: ${err.message ?? 'Unknown error'}`
      };
    }
  },

  buildCommand(prompt: string, options: ExecutionOptions): CommandBuildResult {
    const args: string[] = ['exec'];

    // Always add YOLO flags for autonomous execution
    args.push('--dangerously-bypass-approvals-and-sandbox');
    args.push('--json');
    args.push('--skip-git-repo-check');

    // Model option: default to best-tier when not specified
    // Resolve tier aliases (best/fast) to concrete model names
    const model = resolveModelTier(options.model ?? CODEX_DEFAULT_MODEL, 'codex');
    args.push('--model', model);

    // Thinking/reasoning effort (via config override)
    if (options.thinking) {
      const effort = CODEX_REASONING_EFFORT_MAP[options.thinking];
      args.push('-c', `model_reasoning_effort="${effort}"`);
    }

    // The prompt must come before resume
    args.push(prompt);

    // Resume: append "resume <nativeId>" AFTER the prompt
    if (options.resumeSessionId) {
      args.push('resume', options.resumeSessionId);
    }

    // Append any raw args at the end
    if (options.rawArgs?.length) {
      args.push(...options.rawArgs);
    }

    return {
      command: 'codex',
      args
    };
  },

  parseSessionId(chunk: string, accumulated: string): string | null {
    const combined = accumulated + chunk;

    // Try JSON format first (thread.started event with thread_id)
    const jsonMatch = combined.match(CODEX_JSON_THREAD_ID_REGEX);
    if (jsonMatch?.[1]) {
      return jsonMatch[1];
    }

    // Fall back to text format (session id: banner)
    const textMatch = combined.match(CODEX_TEXT_SESSION_ID_REGEX);
    if (textMatch?.[1]) {
      return textMatch[1];
    }

    return null;
  },

  parseStats(output: string): ExecutionStats | null {
    // Try JSON format first
    const jsonMatch = output.match(JSON_USAGE_PATTERN);
    if (jsonMatch) {
      const inputTokens = parseInt(jsonMatch[1], 10);
      const outputTokens = parseInt(jsonMatch[2], 10);
      return {
        tokens: inputTokens + outputTokens,
        raw: { inputTokens, outputTokens }
      };
    }

    // Fall back to text format
    const textMatch = output.match(TEXT_TOKENS_PATTERN);
    if (textMatch) {
      return {
        tokens: parseInt(textMatch[1], 10)
      };
    }

    return null;
  }
};
