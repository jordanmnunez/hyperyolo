import { describe, it, expect, vi } from 'vitest';
import { sanitizeChunk, createStreamTee, type StreamTeeCallbacks } from '../src/core/stream-tee.js';

describe('sanitizeChunk', () => {
  it('strips ANSI escape codes', () => {
    const input = '\x1b[31mred text\x1b[0m';
    expect(sanitizeChunk(Buffer.from(input))).toBe('red text');
  });

  it('normalizes CR to LF', () => {
    const input = 'line1\rline2\r\nline3';
    expect(sanitizeChunk(Buffer.from(input))).toBe('line1\nline2\nline3');
  });

  it('handles mixed ANSI and CR', () => {
    const input = '\x1b[32m[INFO]\x1b[0m\rProgress: 50%';
    expect(sanitizeChunk(Buffer.from(input))).toBe('[INFO]\nProgress: 50%');
  });

  it('handles empty buffer', () => {
    expect(sanitizeChunk(Buffer.from(''))).toBe('');
  });

  it('preserves unicode', () => {
    const input = '\x1b[1mHello 世界\x1b[0m';
    expect(sanitizeChunk(Buffer.from(input))).toBe('Hello 世界');
  });
});

describe('createStreamTee', () => {
  it('passes raw chunks to display callback', () => {
    const onRaw = vi.fn();
    const tee = createStreamTee({ onRawChunk: onRaw });

    const chunk = Buffer.from('\x1b[31mred\x1b[0m');
    tee.write(chunk, 'stdout');

    expect(onRaw).toHaveBeenCalledWith(chunk, 'stdout');
  });

  it('passes sanitized chunks to parser callback', () => {
    const onSanitized = vi.fn();
    const tee = createStreamTee({ onSanitizedChunk: onSanitized });

    tee.write(Buffer.from('\x1b[31mred\x1b[0m'), 'stdout');

    expect(onSanitized).toHaveBeenCalledWith('red', 'stdout');
  });

  it('accumulates sanitized output', () => {
    const tee = createStreamTee({});

    tee.write(Buffer.from('hello '), 'stdout');
    tee.write(Buffer.from('world'), 'stdout');

    expect(tee.getAccumulated()).toBe('hello world');
  });

  it('calls onAccumulated when provided', () => {
    const onAccumulated = vi.fn();
    const tee = createStreamTee({ onAccumulated });

    tee.write(Buffer.from('hello'), 'stdout');

    expect(onAccumulated).toHaveBeenCalledWith('hello');
  });

  it('interleaves stdout and stderr in accumulated buffer', () => {
    const tee = createStreamTee({});

    tee.write(Buffer.from('out1'), 'stdout');
    tee.write(Buffer.from('err1'), 'stderr');
    tee.write(Buffer.from('out2'), 'stdout');

    expect(tee.getAccumulated()).toBe('out1err1out2');
  });

  it('handles stderr separately in raw callback', () => {
    const onRaw = vi.fn();
    const tee = createStreamTee({ onRawChunk: onRaw });

    tee.write(Buffer.from('error'), 'stderr');

    expect(onRaw).toHaveBeenCalledWith(Buffer.from('error'), 'stderr');
  });

  it('truncates accumulated buffer at max size', () => {
    const maxSize = 100;
    const tee = createStreamTee({ maxAccumulatedSize: maxSize });

    // Write more than max size
    const chunk = 'x'.repeat(150);
    tee.write(Buffer.from(chunk), 'stdout');

    // Should keep most recent data within limit
    expect(tee.getAccumulated().length).toBeLessThanOrEqual(maxSize);
  });

  it('defaults to 1MB max accumulated size', () => {
    const tee = createStreamTee({});

    // Verify default by writing 2MB
    const chunk = 'x'.repeat(1024 * 1024);
    tee.write(Buffer.from(chunk), 'stdout');
    tee.write(Buffer.from(chunk), 'stdout');

    expect(tee.getAccumulated().length).toBeLessThanOrEqual(1024 * 1024);
  });

  it('resets accumulated buffer', () => {
    const tee = createStreamTee({});

    tee.write(Buffer.from('data'), 'stdout');
    expect(tee.getAccumulated()).toBe('data');

    tee.reset();
    expect(tee.getAccumulated()).toBe('');
  });

  it('handles callbacks that throw without breaking', () => {
    const onRaw = vi.fn(() => { throw new Error('callback error'); });
    const onSanitized = vi.fn();
    const tee = createStreamTee({ onRawChunk: onRaw, onSanitizedChunk: onSanitized });

    // Should not throw
    expect(() => tee.write(Buffer.from('test'), 'stdout')).not.toThrow();

    // Sanitized callback should still be called
    expect(onSanitized).toHaveBeenCalled();
  });
});
