/**
 * Footer component tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Footer Component', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('renderFooter', () => {
    it('returns a string', async () => {
      const { renderFooter } = await import('../../src/ui/footer.js');
      const result = renderFooter({
        backend: 'codex',
        durationMs: 5000
      });
      expect(typeof result).toBe('string');
    });

    it('includes duration in seconds', async () => {
      const { renderFooter } = await import('../../src/ui/footer.js');
      const result = renderFooter({
        backend: 'claude',
        durationMs: 12500
      });
      expect(result).toContain('12.5');
    });

    it('includes token count when provided', async () => {
      const { renderFooter } = await import('../../src/ui/footer.js');
      const result = renderFooter({
        backend: 'gemini',
        durationMs: 3000,
        stats: { tokens: 15000 }
      });
      expect(result).toMatch(/15[,.]?000/); // Handle locale formatting
    });

    it('includes cost when provided', async () => {
      const { renderFooter } = await import('../../src/ui/footer.js');
      const result = renderFooter({
        backend: 'codex',
        durationMs: 8000,
        stats: { tokens: 10000, costUsd: 0.25 }
      });
      expect(result).toContain('0.25');
    });

    it('includes session ID when provided', async () => {
      const { renderFooter } = await import('../../src/ui/footer.js');
      const result = renderFooter({
        backend: 'claude',
        durationMs: 4000,
        sessionId: 'hyper_abc123'
      });
      expect(result).toContain('hyper_abc123');
    });

    it('includes resume command hint with session ID', async () => {
      const { renderFooter } = await import('../../src/ui/footer.js');
      const result = renderFooter({
        backend: 'claude',
        durationMs: 4000,
        sessionId: 'hyper_test456'
      });
      expect(result).toContain('--resume');
      expect(result).toContain('hyper_test456');
    });

    it('handles missing stats gracefully', async () => {
      const { renderFooter } = await import('../../src/ui/footer.js');
      const result = renderFooter({
        backend: 'codex',
        durationMs: 2000
      });
      // Should still render without error
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('works without color', async () => {
      const { renderFooter } = await import('../../src/ui/footer.js');
      const result = renderFooter({
        backend: 'gemini',
        durationMs: 6000,
        colorEnabled: false
      });
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('createMinimalFooter', () => {
    it('creates a simpler footer', async () => {
      const { createMinimalFooter } = await import('../../src/ui/footer.js');
      const result = createMinimalFooter({
        backend: 'codex',
        durationMs: 10000
      });
      expect(typeof result).toBe('string');
      expect(result).toContain('10.0');
    });

    it('includes all stats when provided', async () => {
      const { createMinimalFooter } = await import('../../src/ui/footer.js');
      const result = createMinimalFooter({
        backend: 'claude',
        durationMs: 5000,
        stats: { tokens: 20000, costUsd: 0.50 },
        sessionId: 'hyper_xyz789'
      });
      expect(result).toContain('5.0');
      expect(result).toMatch(/20[,.]?000/);
      expect(result).toContain('0.50');
      expect(result).toContain('hyper_xyz789');
    });
  });
});
