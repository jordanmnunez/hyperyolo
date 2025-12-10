/**
 * Gemini Command - Execute with Gemini CLI (Google)
 */

import { geminiAdapter } from '../adapters/index.js';
import { executeWithAdapter, type CommandOptions, type GlobalOptions } from './shared.js';

export async function runGemini(
  prompt: string,
  options: CommandOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  await executeWithAdapter(geminiAdapter, prompt, options, globalOptions);
}
