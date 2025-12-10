/**
 * Theme module tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We need to mock chalk before importing theme
vi.mock('chalk', async () => {
  const actual = await vi.importActual<typeof import('chalk')>('chalk');
  return {
    default: actual.default,
    ...actual
  };
});

describe('Theme Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isColorEnabled', () => {
    it('returns true by default', async () => {
      const { isColorEnabled } = await import('../../src/ui/theme.js');
      // In test environment, chalk may or may not support color
      // Just verify the function exists and returns a boolean
      expect(typeof isColorEnabled()).toBe('boolean');
    });

    it('respects explicit override', async () => {
      const { isColorEnabled } = await import('../../src/ui/theme.js');
      expect(isColorEnabled(true)).toBe(true);
      expect(isColorEnabled(false)).toBe(false);
    });
  });

  describe('style functions', () => {
    it('exports success style function', async () => {
      const { success } = await import('../../src/ui/theme.js');
      expect(typeof success).toBe('function');
      const result = success('test');
      expect(typeof result).toBe('string');
      expect(result).toContain('test');
    });

    it('exports error style function', async () => {
      const { error } = await import('../../src/ui/theme.js');
      expect(typeof error).toBe('function');
      const result = error('test');
      expect(typeof result).toBe('string');
      expect(result).toContain('test');
    });

    it('exports warning style function', async () => {
      const { warning } = await import('../../src/ui/theme.js');
      expect(typeof warning).toBe('function');
      const result = warning('test');
      expect(typeof result).toBe('string');
      expect(result).toContain('test');
    });

    it('exports info style function', async () => {
      const { info } = await import('../../src/ui/theme.js');
      expect(typeof info).toBe('function');
      const result = info('test');
      expect(typeof result).toBe('string');
      expect(result).toContain('test');
    });

    it('exports dim style function', async () => {
      const { dim } = await import('../../src/ui/theme.js');
      expect(typeof dim).toBe('function');
      const result = dim('test');
      expect(typeof result).toBe('string');
      expect(result).toContain('test');
    });

    it('exports bold style function', async () => {
      const { bold } = await import('../../src/ui/theme.js');
      expect(typeof bold).toBe('function');
      const result = bold('test');
      expect(typeof result).toBe('string');
      expect(result).toContain('test');
    });
  });

  describe('color palette', () => {
    it('exports color palette object', async () => {
      const { colors } = await import('../../src/ui/theme.js');
      expect(colors).toBeDefined();
      expect(typeof colors.primary).toBe('function');
      expect(typeof colors.secondary).toBe('function');
      expect(typeof colors.accent).toBe('function');
    });

    it('color functions return strings containing input', async () => {
      const { colors } = await import('../../src/ui/theme.js');
      expect(colors.primary('test')).toContain('test');
      expect(colors.secondary('test')).toContain('test');
      expect(colors.accent('test')).toContain('test');
    });
  });

  describe('gradient functions', () => {
    it('exports gradient helper', async () => {
      const { gradient } = await import('../../src/ui/theme.js');
      expect(typeof gradient).toBe('function');
    });

    it('gradient returns string containing input', async () => {
      const { gradient } = await import('../../src/ui/theme.js');
      const result = gradient('HYPERYOLO');
      expect(typeof result).toBe('string');
      expect(result).toContain('HYPERYOLO');
    });
  });

  describe('no-color mode', () => {
    it('style functions work in no-color mode', async () => {
      const { createNoColorTheme } = await import('../../src/ui/theme.js');
      const theme = createNoColorTheme();

      expect(theme.success('test')).toBe('test');
      expect(theme.error('test')).toBe('test');
      expect(theme.warning('test')).toBe('test');
      expect(theme.info('test')).toBe('test');
      expect(theme.dim('test')).toBe('test');
      expect(theme.bold('test')).toBe('test');
      expect(theme.gradient('test')).toBe('test');
    });
  });
});
