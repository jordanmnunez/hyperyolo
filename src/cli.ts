#!/usr/bin/env node
/**
 * HyperYOLO CLI Entry Point
 *
 * A unified CLI wrapper for autonomous AI code execution across
 * Codex, Claude Code, and Gemini CLI.
 */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read version from package.json
function getVersion(): string {
  try {
    const packagePath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// Create the main program
const program = new Command();

program
  .name('hyperyolo')
  .description('Unified CLI wrapper for autonomous AI code execution')
  .version(getVersion(), '-V, --version', 'Output the version number')
  .option('--verbose', 'Enable verbose output')
  .option('--no-color', 'Disable colorized output')
  .option('--ignore-version-warnings', 'Suppress CLI version compatibility warnings');

// Codex subcommand
program
  .command('codex <prompt>')
  .description('Execute with Codex CLI (OpenAI)')
  .option('-r, --resume <id>', 'Resume from session ID')
  .option('-m, --model <model>', 'Model to use')
  .option('--raw-args <args...>', 'Additional arguments to pass to the CLI')
  .action(async (prompt: string, options) => {
    const { runCodex } = await import('./commands/codex.js');
    await runCodex(prompt, options, program.opts());
  });

// Claude subcommand
program
  .command('claude <prompt>')
  .description('Execute with Claude Code CLI (Anthropic)')
  .option('-r, --resume <id>', 'Resume from session ID')
  .option('-m, --model <model>', 'Model to use')
  .option('--raw-args <args...>', 'Additional arguments to pass to the CLI')
  .action(async (prompt: string, options) => {
    const { runClaude } = await import('./commands/claude.js');
    await runClaude(prompt, options, program.opts());
  });

// Gemini subcommand
program
  .command('gemini <prompt>')
  .description('Execute with Gemini CLI (Google)')
  .option('-r, --resume <id>', 'Resume from session ID')
  .option('-m, --model <model>', 'Model to use')
  .option('--raw-args <args...>', 'Additional arguments to pass to the CLI')
  .action(async (prompt: string, options) => {
    const { runGemini } = await import('./commands/gemini.js');
    await runGemini(prompt, options, program.opts());
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(`Unknown command: ${program.args.join(' ')}`);
  console.error('Run "hyperyolo --help" for available commands.');
  process.exit(1);
});

// Parse and execute
program.parse();
