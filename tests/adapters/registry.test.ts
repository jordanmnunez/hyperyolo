import { describe, it, expect } from 'vitest';
import {
  getAdapter,
  getAllAdapters,
  ADAPTERS,
  codexAdapter,
  claudeAdapter,
  geminiAdapter
} from '../../src/adapters/index.js';
import type { BackendName } from '../../src/core/executor.js';

describe('adapter registry', () => {
  describe('getAdapter', () => {
    it('returns codex adapter for "codex"', () => {
      const adapter = getAdapter('codex');
      expect(adapter).toBe(codexAdapter);
      expect(adapter.name).toBe('codex');
    });

    it('returns claude adapter for "claude"', () => {
      const adapter = getAdapter('claude');
      expect(adapter).toBe(claudeAdapter);
      expect(adapter.name).toBe('claude');
    });

    it('returns gemini adapter for "gemini"', () => {
      const adapter = getAdapter('gemini');
      expect(adapter).toBe(geminiAdapter);
      expect(adapter.name).toBe('gemini');
    });
  });

  describe('getAllAdapters', () => {
    it('returns all three adapters', () => {
      const adapters = getAllAdapters();
      expect(adapters).toHaveLength(3);
      expect(adapters.map(a => a.name)).toEqual(['codex', 'claude', 'gemini']);
    });
  });

  describe('ADAPTERS', () => {
    it('is a record mapping names to adapters', () => {
      expect(ADAPTERS.codex).toBe(codexAdapter);
      expect(ADAPTERS.claude).toBe(claudeAdapter);
      expect(ADAPTERS.gemini).toBe(geminiAdapter);
    });
  });

  describe('exported adapters', () => {
    it('exports codexAdapter', () => {
      expect(codexAdapter.name).toBe('codex');
    });

    it('exports claudeAdapter', () => {
      expect(claudeAdapter.name).toBe('claude');
    });

    it('exports geminiAdapter', () => {
      expect(geminiAdapter.name).toBe('gemini');
    });
  });
});
