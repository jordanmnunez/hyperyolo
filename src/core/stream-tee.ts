import stripAnsi from 'strip-ansi';

export type StreamSource = 'stdout' | 'stderr';

export interface StreamTeeCallbacks {
  /** Called with raw chunk (preserves ANSI for display). */
  onRawChunk?: (chunk: Buffer, source: StreamSource) => void;
  /** Called with sanitized chunk (ANSI-stripped, CR normalized). */
  onSanitizedChunk?: (text: string, source: StreamSource) => void;
  /** Called after each write with current accumulated text. */
  onAccumulated?: (text: string) => void;
  /** Maximum accumulated buffer size in bytes. Defaults to 1MB. */
  maxAccumulatedSize?: number;
}

export interface StreamTee {
  /** Process a chunk from the subprocess. */
  write(chunk: Buffer, source: StreamSource): void;
  /** Get the full accumulated sanitized output. */
  getAccumulated(): string;
  /** Clear the accumulated buffer. */
  reset(): void;
}

const DEFAULT_MAX_ACCUMULATED = 1024 * 1024; // 1MB

/**
 * Sanitize a raw buffer: strip ANSI codes and normalize CR to LF.
 */
export function sanitizeChunk(buffer: Buffer): string {
  const text = buffer.toString('utf8');
  // Strip ANSI escape codes
  const stripped = stripAnsi(text);
  // Normalize \r\n to \n first, then remaining \r to \n
  return stripped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Create a stream tee that splits output into display and parser branches.
 */
export function createStreamTee(callbacks: StreamTeeCallbacks): StreamTee {
  const maxSize = callbacks.maxAccumulatedSize ?? DEFAULT_MAX_ACCUMULATED;
  let accumulated = '';

  return {
    write(chunk: Buffer, source: StreamSource): void {
      // Raw branch (display) - call first, allow errors
      if (callbacks.onRawChunk) {
        try {
          callbacks.onRawChunk(chunk, source);
        } catch {
          // Ignore callback errors
        }
      }

      // Sanitize for parser branch
      const sanitized = sanitizeChunk(chunk);

      // Sanitized branch (parser)
      if (callbacks.onSanitizedChunk) {
        try {
          callbacks.onSanitizedChunk(sanitized, source);
        } catch {
          // Ignore callback errors
        }
      }

      // Accumulate (with truncation)
      accumulated += sanitized;
      if (accumulated.length > maxSize) {
        // Keep most recent data
        accumulated = accumulated.slice(-maxSize);
      }

      // Accumulated callback
      if (callbacks.onAccumulated) {
        try {
          callbacks.onAccumulated(accumulated);
        } catch {
          // Ignore callback errors
        }
      }
    },

    getAccumulated(): string {
      return accumulated;
    },

    reset(): void {
      accumulated = '';
    }
  };
}
