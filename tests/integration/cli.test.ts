/**
 * CLI Integration Tests
 *
 * Tests the full CLI invocation with mock backend CLIs
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execa, type ExecaError } from 'execa';
import { join } from 'node:path';
import { chmod } from 'node:fs/promises';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');
const FIXTURES_PATH = join(process.cwd(), 'tests', 'fixtures');

describe('CLI Integration', () => {
  let mockBinDir: string;

  beforeAll(async () => {
    // Build the CLI
    await execa('npm', ['run', 'build']);

    // Make mock CLIs executable
    const mockClis = ['mock-codex.js', 'mock-claude.js', 'mock-gemini.js'];
    for (const cli of mockClis) {
      await chmod(join(FIXTURES_PATH, cli), 0o755);
    }

    // Create mock backend binaries on PATH that capture args and emit minimal output
    mockBinDir = await mkdtemp(path.join(os.tmpdir(), 'hyperyolo-mock-bin-'));

    const makeWrapper = async (name: string, version: string, outputLine: string) => {
      const scriptPath = join(mockBinDir, name);
      const script = `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--version') {
  console.log('${name} ${version}');
  process.exit(0);
}

const captureFile = process.env.HYPERYOLO_TEST_ARGS_FILE;
if (captureFile) {
  appendFileSync(captureFile, JSON.stringify({ argv: args }) + '\\n');
}

const sessionId = randomUUID();
console.log(${outputLine});
process.exit(0);
`;
      await writeFile(scriptPath, script, 'utf8');
      await chmod(scriptPath, 0o755);
    };

    await makeWrapper(
      'codex',
      '0.66.0',
      "JSON.stringify({ type: 'thread.started', thread_id: sessionId })"
    );
    await makeWrapper(
      'claude',
      '2.0.62',
      "JSON.stringify({ type: 'system', subtype: 'init', session_id: sessionId })"
    );
    await makeWrapper('gemini', '0.19.3', "JSON.stringify({ type: 'init', session_id: sessionId })");
  });

  afterAll(async () => {
    if (mockBinDir) {
      await rm(mockBinDir, { recursive: true, force: true });
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

  describe('Model defaults (env/config)', () => {
    async function readCapturedArgs(filePath: string): Promise<string[]> {
      const raw = await readFile(filePath, 'utf8');
      const lines = raw.split('\n').filter(Boolean);
      const last = lines[lines.length - 1];
      const parsed = JSON.parse(last) as { argv: string[] };
      return parsed.argv;
    }

    async function withTempConfigHome<T>(
      fn: (configHome: string) => Promise<T>
    ): Promise<T> {
      const dir = await mkdtemp(path.join(os.tmpdir(), 'hyperyolo-config-'));
      try {
        return await fn(dir);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }

    const FAST_EXPECTATIONS: Record<string, string> = {
      codex: 'gpt-5.2-chat-latest',
      claude: 'haiku',
      gemini: 'flash'
    };

    for (const [backend, expectedModel] of Object.entries(FAST_EXPECTATIONS)) {
      it(`${backend} uses HYPERYOLO_MODEL when --model omitted`, async () => {
        await withTempConfigHome(async (configHome) => {
          const argsFile = join(configHome, `${backend}-args.jsonl`);
          const result = await execa('node', [CLI_PATH, backend, 'ping'], {
            env: {
              ...process.env,
              PATH: `${mockBinDir}:${process.env.PATH ?? ''}`,
              XDG_CONFIG_HOME: configHome,
              HYPERYOLO_MODEL: 'fast',
              HYPERYOLO_TEST_ARGS_FILE: argsFile
            }
          });

          expect(result.exitCode).toBe(0);
          const argv = await readCapturedArgs(argsFile);
          const modelIndex = argv.indexOf('--model');
          expect(modelIndex).toBeGreaterThanOrEqual(0);
          expect(argv[modelIndex + 1]).toBe(expectedModel);
        });
      });
    }

    it('backend-specific env var overrides global env var', async () => {
      await withTempConfigHome(async (configHome) => {
        const argsFile = join(configHome, 'codex-args.jsonl');
        const result = await execa('node', [CLI_PATH, 'codex', 'ping'], {
          env: {
            ...process.env,
            PATH: `${mockBinDir}:${process.env.PATH ?? ''}`,
            XDG_CONFIG_HOME: configHome,
            HYPERYOLO_MODEL: 'fast',
            HYPERYOLO_CODEX_MODEL: 'best',
            HYPERYOLO_TEST_ARGS_FILE: argsFile
          }
        });

        expect(result.exitCode).toBe(0);
        const argv = await readCapturedArgs(argsFile);
        const modelIndex = argv.indexOf('--model');
        expect(modelIndex).toBeGreaterThanOrEqual(0);
        expect(argv[modelIndex + 1]).toBe('gpt-5.2-pro');
      });
    });

    it('config default is used when env/--model are absent', async () => {
      await withTempConfigHome(async (configHome) => {
        const configPath = join(configHome, 'hyperyolo', 'config.json');
        await mkdir(path.dirname(configPath), { recursive: true });
        await writeFile(
          configPath,
          JSON.stringify({ defaults: { codex: 'fast' } }),
          'utf8'
        );

        const argsFile = join(configHome, 'codex-args.jsonl');
        const result = await execa('node', [CLI_PATH, 'codex', 'ping'], {
          env: {
            ...process.env,
            PATH: `${mockBinDir}:${process.env.PATH ?? ''}`,
            XDG_CONFIG_HOME: configHome,
            HYPERYOLO_TEST_ARGS_FILE: argsFile
          }
        });

        expect(result.exitCode).toBe(0);
        const argv = await readCapturedArgs(argsFile);
        const modelIndex = argv.indexOf('--model');
        expect(modelIndex).toBeGreaterThanOrEqual(0);
        expect(argv[modelIndex + 1]).toBe('gpt-5.2-chat-latest');
      });
    });

    it('--model flag overrides env/config', async () => {
      await withTempConfigHome(async (configHome) => {
        const argsFile = join(configHome, 'codex-args.jsonl');
        const result = await execa('node', [CLI_PATH, 'codex', '--model', 'gpt-5.1-codex', 'ping'], {
          env: {
            ...process.env,
            PATH: `${mockBinDir}:${process.env.PATH ?? ''}`,
            XDG_CONFIG_HOME: configHome,
            HYPERYOLO_MODEL: 'fast',
            HYPERYOLO_TEST_ARGS_FILE: argsFile
          }
        });

        expect(result.exitCode).toBe(0);
        const argv = await readCapturedArgs(argsFile);
        const modelIndex = argv.indexOf('--model');
        expect(modelIndex).toBeGreaterThanOrEqual(0);
        expect(argv[modelIndex + 1]).toBe('gpt-5.1-codex');
      });
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
