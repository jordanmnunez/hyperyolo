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
 */
export const TIER_MAPPINGS: Record<ModelTier, Record<BackendName, string>> = {
  best: {
    codex: 'gpt-5.2-pro',
    claude: 'opus',
    gemini: 'pro'
  },
  fast: {
    codex: 'gpt-5.2-chat-latest',
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
