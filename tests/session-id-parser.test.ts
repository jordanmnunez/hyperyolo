import { describe, it, expect } from 'vitest';
import {
  createSessionIdParser,
  CodexSessionIdParser,
  ClaudeSessionIdParser,
  GeminiSessionIdParser
} from '../src/core/session-id.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CODEX_JSON = readFileSync(
  join(__dirname, 'fixtures/cli-output/codex/json-events.jsonl'),
  'utf8'
);

const CODEX_TEXT = readFileSync(
  join(__dirname, 'fixtures/cli-output/codex/text-banner.txt'),
  'utf8'
);

const CLAUDE_JSON = readFileSync(
  join(__dirname, 'fixtures/cli-output/claude/stream-json.jsonl'),
  'utf8'
);

const GEMINI_JSON = readFileSync(
  join(__dirname, 'fixtures/cli-output/gemini/stream-json.jsonl'),
  'utf8'
);

describe('CodexSessionIdParser', () => {
  it('parses thread_id from JSON events', () => {
    const parser = new CodexSessionIdParser();
    const result = parser.feed(CODEX_JSON, 'stdout');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('019b0524-3ac5-71c2-8e8a-fb9d1e8ab10b');
    expect(result?.format).toBe('json');
  });

  it('parses session id from text banner', () => {
    const parser = new CodexSessionIdParser();
    const result = parser.feed(CODEX_TEXT, 'stdout');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('019b0523-d79c-7401-b0a7-e0686a83d6e1');
    expect(result?.format).toBe('text');
  });

  it('handles chunked JSON input', () => {
    const parser = new CodexSessionIdParser();

    // Split the JSON across multiple chunks
    const chunk1 = '{"type":"thread.started","thread_';
    const chunk2 = 'id":"abc12345-';
    const chunk3 = 'def6-7890-abcd-ef1234567890"}\n';

    expect(parser.feed(chunk1, 'stdout')).toBeNull();
    expect(parser.feed(chunk2, 'stdout')).toBeNull();
    const result = parser.feed(chunk3, 'stdout');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('abc12345-def6-7890-abcd-ef1234567890');
  });

  it('returns same ID on subsequent calls', () => {
    const parser = new CodexSessionIdParser();

    const result1 = parser.feed(CODEX_JSON, 'stdout');
    const result2 = parser.feed('more data', 'stdout');

    expect(result1?.id).toBe('019b0524-3ac5-71c2-8e8a-fb9d1e8ab10b');
    expect(result2?.id).toBe('019b0524-3ac5-71c2-8e8a-fb9d1e8ab10b');
  });

  it('returns null when no ID found', () => {
    const parser = new CodexSessionIdParser();
    const result = parser.feed('random output without session', 'stdout');
    expect(result).toBeNull();
  });

  it('flush returns found ID', () => {
    const parser = new CodexSessionIdParser();
    parser.feed(CODEX_JSON, 'stdout');
    const result = parser.flush();

    expect(result?.id).toBe('019b0524-3ac5-71c2-8e8a-fb9d1e8ab10b');
  });

  it('flush returns null when no ID found', () => {
    const parser = new CodexSessionIdParser();
    parser.feed('no id here', 'stdout');
    expect(parser.flush()).toBeNull();
  });
});

describe('ClaudeSessionIdParser', () => {
  it('parses session_id from stream JSON', () => {
    const parser = new ClaudeSessionIdParser();
    const result = parser.feed(CLAUDE_JSON, 'stdout');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('bd54f558-0647-47ef-a830-451fbea4d555');
    expect(result?.format).toBe('json');
  });

  it('handles chunked JSON input', () => {
    const parser = new ClaudeSessionIdParser();

    const chunk1 = '{"type":"system","subtype":"init","session_id":"';
    const chunk2 = 'abc12345-def6-7890-abcd-ef1234567890","uuid":"xyz"}';

    expect(parser.feed(chunk1, 'stdout')).toBeNull();
    const result = parser.feed(chunk2, 'stdout');

    expect(result?.id).toBe('abc12345-def6-7890-abcd-ef1234567890');
  });

  it('returns same ID on subsequent calls', () => {
    const parser = new ClaudeSessionIdParser();

    const result1 = parser.feed(CLAUDE_JSON, 'stdout');
    const result2 = parser.feed('more data', 'stdout');

    expect(result1?.id).toBe('bd54f558-0647-47ef-a830-451fbea4d555');
    expect(result2?.id).toBe('bd54f558-0647-47ef-a830-451fbea4d555');
  });

  it('returns null when no ID found', () => {
    const parser = new ClaudeSessionIdParser();
    const result = parser.feed('random output', 'stdout');
    expect(result).toBeNull();
  });
});

describe('GeminiSessionIdParser', () => {
  it('parses session_id from init event', () => {
    const parser = new GeminiSessionIdParser();
    const result = parser.feed(GEMINI_JSON, 'stdout');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('6f2f060c-8846-4aa4-8a61-56e60ba38c85');
    expect(result?.format).toBe('json');
  });

  it('handles chunked JSON input', () => {
    const parser = new GeminiSessionIdParser();

    const chunk1 = '{"type":"init","timestamp":"2025-12-09T21:40:36.123Z","session_id":"';
    const chunk2 = 'abc12345-def6-7890-abcd-ef1234567890","model":"gemini-2.5-pro"}';

    expect(parser.feed(chunk1, 'stdout')).toBeNull();
    const result = parser.feed(chunk2, 'stdout');

    expect(result?.id).toBe('abc12345-def6-7890-abcd-ef1234567890');
  });

  it('returns same ID on subsequent calls', () => {
    const parser = new GeminiSessionIdParser();

    const result1 = parser.feed(GEMINI_JSON, 'stdout');
    const result2 = parser.feed('more data', 'stdout');

    expect(result1?.id).toBe('6f2f060c-8846-4aa4-8a61-56e60ba38c85');
    expect(result2?.id).toBe('6f2f060c-8846-4aa4-8a61-56e60ba38c85');
  });

  it('returns null when no ID found', () => {
    const parser = new GeminiSessionIdParser();
    const result = parser.feed('random output', 'stdout');
    expect(result).toBeNull();
  });
});

describe('createSessionIdParser factory', () => {
  it('creates CodexSessionIdParser for codex', () => {
    const parser = createSessionIdParser('codex');
    expect(parser).toBeInstanceOf(CodexSessionIdParser);
  });

  it('creates ClaudeSessionIdParser for claude', () => {
    const parser = createSessionIdParser('claude');
    expect(parser).toBeInstanceOf(ClaudeSessionIdParser);
  });

  it('creates GeminiSessionIdParser for gemini', () => {
    const parser = createSessionIdParser('gemini');
    expect(parser).toBeInstanceOf(GeminiSessionIdParser);
  });
});

describe('ring buffer behavior', () => {
  it('keeps searching in ring buffer as new data arrives', () => {
    const parser = new CodexSessionIdParser();

    // Feed partial data that doesn't contain a session ID
    for (let i = 0; i < 100; i++) {
      parser.feed('some random output\n', 'stdout');
    }

    // Now feed the actual session ID
    parser.feed('session id: abc12345-def6-7890-abcd-ef1234567890\n', 'stdout');

    const result = parser.flush();
    expect(result?.id).toBe('abc12345-def6-7890-abcd-ef1234567890');
  });
});

describe('source tracking', () => {
  it('tracks source as stdout', () => {
    const parser = new CodexSessionIdParser();
    const result = parser.feed(CODEX_JSON, 'stdout');
    expect(result?.source).toBe('stdout');
  });

  it('tracks source as stderr', () => {
    const parser = new CodexSessionIdParser();
    const result = parser.feed(CODEX_JSON, 'stderr');
    expect(result?.source).toBe('stderr');
  });
});
