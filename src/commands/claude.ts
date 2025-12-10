/**
 * Claude Command - Execute with Claude Code CLI (Anthropic)
 */

import { claudeAdapter } from '../adapters/index.js';
import { executeWithAdapter, type CommandOptions, type GlobalOptions } from './shared.js';

export async function runClaude(
  prompt: string,
  options: CommandOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  await executeWithAdapter(claudeAdapter, prompt, options, globalOptions);
}
