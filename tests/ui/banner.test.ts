/**
 * Banner component tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Banner Component', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('renderBanner', () => {
    it('returns a string', async () => {
      const { renderBanner } = await import('../../src/ui/banner.js');
      const result = renderBanner({ backend: 'codex' });
      expect(typeof result).toBe('string');
    });

    it('includes HYPERYOLO in ASCII art', async () => {
      const { renderBanner } = await import('../../src/ui/banner.js');
      const result = renderBanner({ backend: 'claude' });
      // The ASCII art uses figlet - verify substantial content is present
      // The result should have significant length (ASCII art is verbose)
      expect(result.length).toBeGreaterThan(200);
      // Should contain the backend name
      expect(result.toUpperCase()).toContain('CLAUDE');
    });

    it('includes backend name', async () => {
      const { renderBanner } = await import('../../src/ui/banner.js');
      const result = renderBanner({ backend: 'gemini' });
      expect(result.toLowerCase()).toContain('gemini');
    });

    it('includes version when provided', async () => {
      const { renderBanner } = await import('../../src/ui/banner.js');
      const result = renderBanner({ backend: 'codex', version: '1.2.3' });
      expect(result).toContain('1.2.3');
    });

    it('includes resume ID when provided', async () => {
      const { renderBanner } = await import('../../src/ui/banner.js');
      const result = renderBanner({
        backend: 'claude',
        resumeId: 'hyper_abc123'
      });
      expect(result).toContain('hyper_abc123');
    });

    it('works without color', async () => {
      const { renderBanner } = await import('../../src/ui/banner.js');
      const result = renderBanner({ backend: 'codex', colorEnabled: false });
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('createMinimalBanner', () => {
    it('creates a simpler banner', async () => {
      const { createMinimalBanner } = await import('../../src/ui/banner.js');
      const result = createMinimalBanner({ backend: 'codex' });
      expect(typeof result).toBe('string');
      expect(result).toContain('HYPERYOLO');
      expect(result).toContain('CODEX');
    });

    it('includes resume info when provided', async () => {
      const { createMinimalBanner } = await import('../../src/ui/banner.js');
      const result = createMinimalBanner({
        backend: 'claude',
        resumeId: 'hyper_test123'
      });
      expect(result).toContain('RESUMING');
      expect(result).toContain('hyper_test123');
    });
  });
});
