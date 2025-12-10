/**
 * CLI Integration Tests
 *
 * Tests the full CLI invocation with mock backend CLIs
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execa, type ExecaError } from 'execa';
import { join } from 'node:path';
import { chmod } from 'node:fs/promises';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');
const FIXTURES_PATH = join(process.cwd(), 'tests', 'fixtures');

describe('CLI Integration', () => {
  beforeAll(async () => {
    // Build the CLI
    await execa('npm', ['run', 'build']);

    // Make mock CLIs executable
    const mockClis = ['mock-codex.js', 'mock-claude.js', 'mock-gemini.js'];
    for (const cli of mockClis) {
      await chmod(join(FIXTURES_PATH, cli), 0o755);
    }
  });

  describe('Help and Version', () => {
    it('shows help when invoked with --help', async () => {
      const result = await execa('node', [CLI_PATH, '--help']);
      expect(result.stdout).toContain('hyperyolo');
      expect(result.stdout).toContain('codex');
      expect(result.stdout).toContain('claude');
      expect(result.stdout).toContain('gemini');
    });

    it('shows version when invoked with --version', async () => {
      const result = await execa('node', [CLI_PATH, '--version']);
      expect(result.stdout).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('shows help for subcommands', async () => {
      const codexHelp = await execa('node', [CLI_PATH, 'codex', '--help']);
      expect(codexHelp.stdout).toContain('--resume');
      expect(codexHelp.stdout).toContain('--model');

      const claudeHelp = await execa('node', [CLI_PATH, 'claude', '--help']);
      expect(claudeHelp.stdout).toContain('--resume');
      expect(claudeHelp.stdout).toContain('--model');

      const geminiHelp = await execa('node', [CLI_PATH, 'gemini', '--help']);
      expect(geminiHelp.stdout).toContain('--resume');
      expect(geminiHelp.stdout).toContain('--model');
    });
  });

  describe('Error Handling', () => {
    it('shows error for unknown command', async () => {
      try {
        await execa('node', [CLI_PATH, 'unknown']);
        expect.fail('Should have thrown');
      } catch (error) {
        const execaError = error as ExecaError;
        expect(execaError.exitCode).toBe(1);
        expect(execaError.stderr).toContain('Unknown command');
      }
    });

    it('shows error when prompt is missing', async () => {
      try {
        await execa('node', [CLI_PATH, 'codex']);
        expect.fail('Should have thrown');
      } catch (error) {
        const execaError = error as ExecaError;
        expect(execaError.exitCode).toBe(1);
        // Commander shows missing argument error
        expect(execaError.stderr).toMatch(/missing.*argument|required.*prompt/i);
      }
    });
  });

  describe('Global Options', () => {
    it('--no-color is accepted', async () => {
      const result = await execa('node', [CLI_PATH, '--no-color', '--help']);
      expect(result.exitCode).toBe(0);
    });

    it('--verbose is accepted', async () => {
      const result = await execa('node', [CLI_PATH, '--verbose', '--help']);
      expect(result.exitCode).toBe(0);
    });

    it('--ignore-version-warnings is accepted', async () => {
      const result = await execa('node', [CLI_PATH, '--ignore-version-warnings', '--help']);
      expect(result.exitCode).toBe(0);
    });
  });
});
