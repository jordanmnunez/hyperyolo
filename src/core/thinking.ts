/**
 * Thinking/reasoning effort configuration for AI backends.
 *
 * Provides a unified interface for extended thinking across all backends:
 * - Codex: Uses native --reasoning-effort flag
 * - Claude/Gemini: Prepends a structured thinking prompt
 */

/**
 * Thinking effort levels.
 * - low: Light reasoning, faster responses
 * - medium: Balanced (default when --thinking is passed without value)
 * - high: Deep reasoning, slower but more thorough
 * - max: Maximum reasoning effort
 */
export type ThinkingLevel = 'low' | 'medium' | 'high' | 'max';

/**
 * Valid thinking level strings for validation.
 */
export const THINKING_LEVELS: readonly ThinkingLevel[] = ['low', 'medium', 'high', 'max'];

/**
 * Check if a string is a valid thinking level.
 */
export function isThinkingLevel(value: string): value is ThinkingLevel {
  return THINKING_LEVELS.includes(value as ThinkingLevel);
}

/**
 * Maps hyperyolo thinking levels to Codex CLI --reasoning-effort values.
 */
export const CODEX_REASONING_EFFORT_MAP: Record<ThinkingLevel, string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  max: 'xhigh'
};

/**
 * Thinking instruction prompts by level.
 * Used for backends that don't have native thinking support (Claude, Gemini).
 */
const THINKING_PROMPTS: Record<ThinkingLevel, string> = {
  low: `Before responding, briefly consider the key aspects of this task.`,

  medium: `Before responding, think through this problem step by step:
- Consider the requirements carefully
- Identify potential approaches
- Choose the most appropriate solution`,

  high: `Before responding, engage in thorough reasoning:
- Analyze the problem from multiple angles
- Consider edge cases and potential issues
- Evaluate trade-offs between approaches
- Structure your solution methodically
- Verify your reasoning before proceeding`,

  max: `Before responding, engage in deep, comprehensive reasoning:
- Thoroughly analyze every aspect of this problem
- Consider all possible approaches and their implications
- Identify edge cases, failure modes, and potential issues
- Evaluate trade-offs with careful consideration
- Think through the implementation step by step
- Question your assumptions and verify your logic
- Only proceed when you have a well-reasoned, robust solution`
};

/**
 * Build a prompt with thinking instructions prepended.
 * Used for backends without native thinking/reasoning support.
 *
 * @param level - The thinking effort level
 * @param prompt - The original user prompt
 * @returns The prompt with thinking instructions prepended
 */
export function buildThinkingPrompt(level: ThinkingLevel, prompt: string): string {
  const instruction = THINKING_PROMPTS[level];
  return `<thinking_instruction>
${instruction}
</thinking_instruction>

${prompt}`;
}

/**
 * Normalize a thinking option value.
 * Handles string levels and undefined.
 *
 * @param value - The raw option value from Commander
 * @returns The normalized ThinkingLevel or undefined
 */
export function normalizeThinkingOption(
  value: string | undefined
): ThinkingLevel | undefined {
  if (value === undefined) {
    return undefined;
  }

  // Validate string value
  if (isThinkingLevel(value)) {
    return value;
  }

  // Invalid level - warn and default to medium
  console.warn(`Warning: Invalid thinking level "${value}", using "medium"`);
  return 'medium';
}
