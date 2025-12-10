import { describe, it, expect } from 'vitest';
import { claudeAdapter } from '../../src/adapters/claude.js';
import type { ExecutionOptions } from '../../src/adapters/types.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLAUDE_JSON_OUTPUT = readFileSync(
  join(__dirname, '../fixtures/cli-output/claude/stream-json.jsonl'),
  'utf8'
);

describe('claudeAdapter', () => {
  describe('name and pattern', () => {
    it('has name "claude"', () => {
      expect(claudeAdapter.name).toBe('claude');
    });

    it('has UUID session ID pattern', () => {
      expect(claudeAdapter.sessionIdPattern.test('bd54f558-0647-47ef-a830-451fbea4d555')).toBe(true);
      expect(claudeAdapter.sessionIdPattern.test('invalid-id')).toBe(false);
    });
  });

  describe('buildCommand', () => {
    it('builds basic command with permission flags', () => {
      const result = claudeAdapter.buildCommand('hello world', {});

      expect(result.command).toBe('claude');
      expect(result.args).toContain('-p');
      expect(result.args).toContain('hello world');
      expect(result.args).toContain('--dangerously-skip-permissions');
      expect(result.args).toContain('--output-format');
      expect(result.args).toContain('stream-json');
      expect(result.args).toContain('--verbose');
    });

    it('places resume flag BEFORE -p', () => {
      const options: ExecutionOptions = {
        resumeSessionId: 'bd54f558-0647-47ef-a830-451fbea4d555'
      };
      const result = claudeAdapter.buildCommand('continue task', options);

      // Resume flag must come before -p
      const resumeIndex = result.args.indexOf('--resume');
      const printIndex = result.args.indexOf('-p');
      expect(resumeIndex).toBeLessThan(printIndex);
      expect(result.args[resumeIndex + 1]).toBe('bd54f558-0647-47ef-a830-451fbea4d555');
    });

    it('handles model option', () => {
      const options: ExecutionOptions = { model: 'claude-3-sonnet-20240229' };
      const result = claudeAdapter.buildCommand('task', options);

      expect(result.args).toContain('--model');
      expect(result.args).toContain('claude-3-sonnet-20240229');
    });

    it('appends rawArgs at the end', () => {
      const options: ExecutionOptions = {
        rawArgs: ['--extra-flag', 'value']
      };
      const result = claudeAdapter.buildCommand('task', options);

      const extraIndex = result.args.indexOf('--extra-flag');
      expect(extraIndex).toBeGreaterThan(0);
      expect(result.args[extraIndex + 1]).toBe('value');
    });
  });

  describe('parseSessionId', () => {
    it('parses session_id from stream-json output', () => {
      const result = claudeAdapter.parseSessionId(CLAUDE_JSON_OUTPUT, '');
      expect(result).toBe('bd54f558-0647-47ef-a830-451fbea4d555');
    });

    it('handles chunked input by using accumulated buffer', () => {
      // First chunk has partial JSON
      const chunk1 = '{"type":"system","subtype":"init","session_id":"';
      let result = claudeAdapter.parseSessionId(chunk1, '');
      expect(result).toBeNull();

      // Second chunk completes it
      const chunk2 = 'abc12345-def6-7890-abcd-ef1234567890","uuid":"xyz"}';
      result = claudeAdapter.parseSessionId(chunk2, chunk1);
      expect(result).toBe('abc12345-def6-7890-abcd-ef1234567890');
    });

    it('returns null when no session ID found', () => {
      const result = claudeAdapter.parseSessionId('random output', '');
      expect(result).toBeNull();
    });
  });

  describe('parseStats', () => {
    it('parses stats from stream-json output', () => {
      const result = claudeAdapter.parseStats(CLAUDE_JSON_OUTPUT);
      expect(result).not.toBeNull();
      expect(result?.durationMs).toBe(3500);
    });

    it('extracts token counts from usage', () => {
      const result = claudeAdapter.parseStats(CLAUDE_JSON_OUTPUT);
      expect(result?.tokens).toBeDefined();
    });

    it('returns null when no stats found', () => {
      const result = claudeAdapter.parseStats('no stats here');
      expect(result).toBeNull();
    });
  });
});
