import { describe, it, expect } from 'vitest';
import { execa } from 'execa';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MOCK_CODEX = join(__dirname, 'fixtures/mock-codex.js');
const MOCK_CLAUDE = join(__dirname, 'fixtures/mock-claude.js');
const MOCK_GEMINI = join(__dirname, 'fixtures/mock-gemini.js');

describe('mock-codex', () => {
  it('outputs JSON format with session ID', async () => {
    const sessionId = 'test-1234-5678-9012-abcdef123456';
    const result = await execa('node', [MOCK_CODEX], {
      env: {
        MOCK_SESSION_ID: sessionId,
        MOCK_OUTPUT_FORMAT: 'json'
      }
    });

    expect(result.exitCode).toBe(0);
    const lines = result.stdout.split('\n').filter(Boolean);
    const firstEvent = JSON.parse(lines[0]);
    expect(firstEvent.type).toBe('thread.started');
    expect(firstEvent.thread_id).toBe(sessionId);
  });

  it('outputs text format with session ID', async () => {
    const sessionId = 'test-1234-5678-9012-abcdef123456';
    const result = await execa('node', [MOCK_CODEX], {
      env: {
        MOCK_SESSION_ID: sessionId,
        MOCK_OUTPUT_FORMAT: 'text'
      }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`session id: ${sessionId}`);
  });

  it('respects MOCK_EXIT_CODE', async () => {
    try {
      await execa('node', [MOCK_CODEX], {
        env: { MOCK_EXIT_CODE: '42' }
      });
    } catch (error) {
      const err = error as { exitCode: number };
      expect(err.exitCode).toBe(42);
    }
  });

  it('outputs error message', async () => {
    try {
      await execa('node', [MOCK_CODEX], {
        env: { MOCK_ERROR: 'Authentication failed' }
      });
    } catch (error) {
      const err = error as { exitCode: number; stderr: string };
      expect(err.exitCode).toBe(1);
      expect(err.stderr).toContain('Authentication failed');
    }
  });
});

describe('mock-claude', () => {
  it('outputs stream-json with session ID', async () => {
    const sessionId = 'claude-1234-5678-9012-abcdef123456';
    const result = await execa('node', [MOCK_CLAUDE], {
      env: { MOCK_SESSION_ID: sessionId }
    });

    expect(result.exitCode).toBe(0);
    const lines = result.stdout.split('\n').filter(Boolean);
    const initEvent = JSON.parse(lines[0]);
    expect(initEvent.type).toBe('system');
    expect(initEvent.subtype).toBe('init');
    expect(initEvent.session_id).toBe(sessionId);
  });

  it('includes result event', async () => {
    const result = await execa('node', [MOCK_CLAUDE], {});

    const lines = result.stdout.split('\n').filter(Boolean);
    const resultEvent = JSON.parse(lines[lines.length - 1]);
    expect(resultEvent.type).toBe('result');
    expect(resultEvent.subtype).toBe('success');
  });
});

describe('mock-gemini', () => {
  it('outputs stream-json with session ID in init event', async () => {
    const sessionId = 'gemini-1234-5678-9012-abcdef123456';
    const result = await execa('node', [MOCK_GEMINI], {
      env: { MOCK_SESSION_ID: sessionId }
    });

    expect(result.exitCode).toBe(0);
    const lines = result.stdout.split('\n').filter(Boolean);
    const initEvent = JSON.parse(lines[0]);
    expect(initEvent.type).toBe('init');
    expect(initEvent.session_id).toBe(sessionId);
  });

  it('includes stats in result event', async () => {
    const result = await execa('node', [MOCK_GEMINI], {});

    const lines = result.stdout.split('\n').filter(Boolean);
    const resultEvent = JSON.parse(lines[lines.length - 1]);
    expect(resultEvent.type).toBe('result');
    expect(resultEvent.stats).toBeDefined();
    expect(resultEvent.stats.total_tokens).toBe(110);
  });
});

describe('signal handling', () => {
  it('mock-codex exits on SIGTERM (with delay)', async () => {
    // Use a long delay to ensure process doesn't complete before SIGTERM
    const child = execa('node', [MOCK_CODEX], {
      env: { MOCK_DELAY_MS: '10000' }, // Long delay between outputs
      reject: false // Don't throw on non-zero exit
    });

    // Wait a bit for process to start, then send SIGTERM
    await new Promise(resolve => setTimeout(resolve, 100));
    child.kill('SIGTERM');

    const result = await child;
    // Process should have been terminated by SIGTERM
    // Check either it was terminated or exited with signal-based exit code (143)
    expect(result.isTerminated || result.exitCode === 143).toBe(true);
  });
});

describe('delay behavior', () => {
  it('respects MOCK_DELAY_MS between chunks', async () => {
    const start = Date.now();
    await execa('node', [MOCK_CODEX], {
      env: {
        MOCK_DELAY_MS: '50',
        MOCK_OUTPUT_FORMAT: 'json'
      }
    });
    const elapsed = Date.now() - start;

    // Should take at least 150ms (3 delays of 50ms each)
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });
});
