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

export const CLAUDE_SESSION_ID_REGEX =
  /"session_id"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i;

export const GEMINI_INIT_SESSION_ID_REGEX =
  /"type"\s*:\s*"init"[^\n\r]*"session_id"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i;
