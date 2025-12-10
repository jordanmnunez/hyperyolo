import type { BackendName } from './executor.js';

export type SessionIdSource = 'stdout' | 'stderr';

export interface SessionIdParseResult {
  id: string;
  source: SessionIdSource;
  format: 'json' | 'text';
}

export interface SessionIdParser {
  feed(chunk: string, source: SessionIdSource): SessionIdParseResult | null;
  flush(): SessionIdParseResult | null;
}

export const SESSION_ID_RING_BUFFER_BYTES = 16 * 1024;

export const CODEX_TEXT_SESSION_ID_REGEX =
  /session id:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export const CODEX_JSON_THREAD_ID_REGEX =
  /"type"\s*:\s*"thread\.started"[^\n\r]*"thread_id"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i;

export const CLAUDE_SESSION_ID_REGEX =
  /"session_id"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i;

export const GEMINI_INIT_SESSION_ID_REGEX =
  /"type"\s*:\s*"init"[^\n\r]*"session_id"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i;

/**
 * Base class for session ID parsers with ring buffer support.
 */
abstract class BaseSessionIdParser implements SessionIdParser {
  protected buffer = '';
  protected foundResult: SessionIdParseResult | null = null;
  protected lastSource: SessionIdSource = 'stdout';
  protected readonly maxBufferSize = SESSION_ID_RING_BUFFER_BYTES;

  feed(chunk: string, source: SessionIdSource): SessionIdParseResult | null {
    this.lastSource = source;

    // If already found, return cached result
    if (this.foundResult) {
      return this.foundResult;
    }

    // Add to buffer with ring buffer behavior
    this.buffer += chunk;
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.maxBufferSize);
    }

    // Try to parse
    const result = this.tryParse();
    if (result) {
      this.foundResult = result;
    }
    return result;
  }

  flush(): SessionIdParseResult | null {
    if (this.foundResult) {
      return this.foundResult;
    }
    return this.tryParse();
  }

  protected abstract tryParse(): SessionIdParseResult | null;
}

/**
 * Parser for Codex CLI session IDs.
 * Supports both JSON mode (thread.started event) and text mode (session id: banner).
 */
export class CodexSessionIdParser extends BaseSessionIdParser {
  protected tryParse(): SessionIdParseResult | null {
    // Try JSON format first (thread.started event)
    const jsonMatch = this.buffer.match(CODEX_JSON_THREAD_ID_REGEX);
    if (jsonMatch?.[1]) {
      return {
        id: jsonMatch[1],
        source: this.lastSource,
        format: 'json'
      };
    }

    // Fall back to text format (session id: banner)
    const textMatch = this.buffer.match(CODEX_TEXT_SESSION_ID_REGEX);
    if (textMatch?.[1]) {
      return {
        id: textMatch[1],
        source: this.lastSource,
        format: 'text'
      };
    }

    return null;
  }
}

/**
 * Parser for Claude CLI session IDs.
 * Parses session_id from stream-json output.
 */
export class ClaudeSessionIdParser extends BaseSessionIdParser {
  protected tryParse(): SessionIdParseResult | null {
    const match = this.buffer.match(CLAUDE_SESSION_ID_REGEX);
    if (match?.[1]) {
      return {
        id: match[1],
        source: this.lastSource,
        format: 'json'
      };
    }
    return null;
  }
}

/**
 * Parser for Gemini CLI session IDs.
 * Parses session_id from init event in stream-json output.
 */
export class GeminiSessionIdParser extends BaseSessionIdParser {
  protected tryParse(): SessionIdParseResult | null {
    const match = this.buffer.match(GEMINI_INIT_SESSION_ID_REGEX);
    if (match?.[1]) {
      return {
        id: match[1],
        source: this.lastSource,
        format: 'json'
      };
    }
    return null;
  }
}

/**
 * Factory function to create the appropriate session ID parser for a backend.
 */
export function createSessionIdParser(backend: BackendName): SessionIdParser {
  switch (backend) {
    case 'codex':
      return new CodexSessionIdParser();
    case 'claude':
      return new ClaudeSessionIdParser();
    case 'gemini':
      return new GeminiSessionIdParser();
  }
}
