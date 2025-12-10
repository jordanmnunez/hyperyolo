/**
 * Adapter Registry - exports all backend adapters and provides registry functions.
 */

import type { BackendAdapter, AvailabilityResult } from './types.js';
import type { BackendName } from '../core/executor.js';
import { codexAdapter } from './codex.js';
import { claudeAdapter } from './claude.js';
import { geminiAdapter } from './gemini.js';

// Re-export individual adapters
export { codexAdapter } from './codex.js';
export { claudeAdapter } from './claude.js';
export { geminiAdapter } from './gemini.js';

// Re-export types
export * from './types.js';
export * from './versioning.js';

/**
 * Map of all registered adapters by name.
 */
export const ADAPTERS: Record<BackendName, BackendAdapter> = {
  codex: codexAdapter,
  claude: claudeAdapter,
  gemini: geminiAdapter
};

/**
 * Get a specific adapter by name.
 */
export function getAdapter(name: BackendName): BackendAdapter {
  return ADAPTERS[name];
}

/**
 * Get all registered adapters.
 */
export function getAllAdapters(): BackendAdapter[] {
  return Object.values(ADAPTERS);
}

/**
 * Get available adapters (those that pass isAvailable check).
 */
export async function getAvailableAdapters(): Promise<
  Array<{ adapter: BackendAdapter; availability: AvailabilityResult }>
> {
  const results = await Promise.all(
    getAllAdapters().map(async (adapter) => {
      const availability = await adapter.isAvailable();
      return { adapter, availability };
    })
  );

  return results.filter((r) => r.availability.available);
}

/**
 * Check which adapters are available.
 */
export async function checkAdapterAvailability(): Promise<
  Record<BackendName, AvailabilityResult>
> {
  const results = await Promise.all(
    getAllAdapters().map(async (adapter) => {
      const availability = await adapter.isAvailable();
      return [adapter.name, availability] as const;
    })
  );

  return Object.fromEntries(results) as Record<BackendName, AvailabilityResult>;
}
