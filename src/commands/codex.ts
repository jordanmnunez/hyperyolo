/**
 * Codex Command - Execute with Codex CLI (OpenAI)
 */

import { codexAdapter } from '../adapters/index.js';
import { executeWithAdapter, type CommandOptions, type GlobalOptions } from './shared.js';

export async function runCodex(
  prompt: string,
  options: CommandOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  await executeWithAdapter(codexAdapter, prompt, options, globalOptions);
}
