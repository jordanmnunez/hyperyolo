import { describe, it, expect } from 'vitest';
import { geminiAdapter } from '../../src/adapters/gemini.js';
import type { ExecutionOptions } from '../../src/adapters/types.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GEMINI_JSON_OUTPUT = readFileSync(
  join(__dirname, '../fixtures/cli-output/gemini/stream-json.jsonl'),
  'utf8'
);

describe('geminiAdapter', () => {
  describe('name and pattern', () => {
    it('has name "gemini"', () => {
      expect(geminiAdapter.name).toBe('gemini');
    });

    it('has UUID session ID pattern', () => {
      expect(geminiAdapter.sessionIdPattern.test('6f2f060c-8846-4aa4-8a61-56e60ba38c85')).toBe(true);
      expect(geminiAdapter.sessionIdPattern.test('invalid-id')).toBe(false);
    });
  });

  describe('buildCommand', () => {
    it('builds basic command with YOLO flags', () => {
      const result = geminiAdapter.buildCommand('hello world', {});

      expect(result.command).toBe('gemini');
      expect(result.args).toContain('-p');
      expect(result.args).toContain('hello world');
      expect(result.args).toContain('-y');
      expect(result.args).toContain('-o');
      expect(result.args).toContain('stream-json');
    });

    it('handles resume with session ID', () => {
      const options: ExecutionOptions = {
        resumeSessionId: '6f2f060c-8846-4aa4-8a61-56e60ba38c85'
      };
      const result = geminiAdapter.buildCommand('continue task', options);

      expect(result.args).toContain('-r');
      expect(result.args).toContain('6f2f060c-8846-4aa4-8a61-56e60ba38c85');
    });

    it('handles model option', () => {
      const options: ExecutionOptions = { model: 'gemini-2.0-pro' };
      const result = geminiAdapter.buildCommand('task', options);

      expect(result.args).toContain('--model');
      expect(result.args).toContain('gemini-2.0-pro');
    });

    it('appends rawArgs at the end', () => {
      const options: ExecutionOptions = {
        rawArgs: ['--extra-flag', 'value']
      };
      const result = geminiAdapter.buildCommand('task', options);

      const extraIndex = result.args.indexOf('--extra-flag');
      expect(extraIndex).toBeGreaterThan(0);
      expect(result.args[extraIndex + 1]).toBe('value');
    });
  });

  describe('parseSessionId', () => {
    it('parses session_id from stream-json init event', () => {
      const result = geminiAdapter.parseSessionId(GEMINI_JSON_OUTPUT, '');
      expect(result).toBe('6f2f060c-8846-4aa4-8a61-56e60ba38c85');
    });

    it('handles chunked input by using accumulated buffer', () => {
      // First chunk has partial JSON
      const chunk1 = '{"type":"init","timestamp":"2025-12-09T21:40:36.123Z","session_id":"';
      let result = geminiAdapter.parseSessionId(chunk1, '');
      expect(result).toBeNull();

      // Second chunk completes it
      const chunk2 = 'abc12345-def6-7890-abcd-ef1234567890","model":"gemini-2.5-pro"}';
      result = geminiAdapter.parseSessionId(chunk2, chunk1);
      expect(result).toBe('abc12345-def6-7890-abcd-ef1234567890');
    });

    it('returns null when no session ID found', () => {
      const result = geminiAdapter.parseSessionId('random output', '');
      expect(result).toBeNull();
    });
  });

  describe('parseStats', () => {
    it('parses stats from stream-json output', () => {
      const result = geminiAdapter.parseStats(GEMINI_JSON_OUTPUT);
      expect(result).not.toBeNull();
      expect(result?.durationMs).toBe(1142);
      expect(result?.tokens).toBe(128);
    });

    it('returns null when no stats found', () => {
      const result = geminiAdapter.parseStats('no stats here');
      expect(result).toBeNull();
    });
  });
});
