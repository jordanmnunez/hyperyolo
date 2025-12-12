import type { BackendName } from './executor.js';

/**
 * Model tier aliases supported by hyperyolo.
 * - best: Maximum capability, flagship models
 * - fast: Speed optimized, for when latency matters
 */
export type ModelTier = 'best' | 'fast';

/**
 * Tier-to-model mappings per backend.
 * These resolve tier aliases to concrete model names that the underlying CLIs understand.
 *
 * Note: Codex models use gpt-5.1-codex variants because GPT-5.2 models
 * are only available for API accounts, not ChatGPT accounts. Most users
 * authenticate Codex CLI via ChatGPT, so we default to the best models
 * available to them:
 * - gpt-5.1-codex-max: Best for complex, long-horizon agentic coding
 * - gpt-5.1-codex-mini: Faster, more cost-effective for simpler tasks
 */
export const TIER_MAPPINGS: Record<ModelTier, Record<BackendName, string>> = {
  best: {
    codex: 'gpt-5.1-codex-max',
    claude: 'opus',
    gemini: 'pro'
  },
  fast: {
    codex: 'gpt-5.1-codex-mini',
    claude: 'haiku',
    gemini: 'flash'
  }
};

/**
 * Check if a string is a recognized tier alias.
 */
export function isTierAlias(model: string): model is ModelTier {
  return model === 'best' || model === 'fast';
}

/**
 * Resolve a model tier alias to a concrete model name for the given backend.
 * If the model is not a recognized tier alias, returns it unchanged (pass-through).
 *
 * @param model - The model string (tier alias like "best"/"fast" or literal model name)
 * @param backend - The backend to resolve for
 * @returns The concrete model name to pass to the underlying CLI
 */
export function resolveModelTier(model: string, backend: BackendName): string {
  if (isTierAlias(model)) {
    return TIER_MAPPINGS[model][backend];
  }
  // Not a tier alias - pass through as literal model name
  return model;
}
