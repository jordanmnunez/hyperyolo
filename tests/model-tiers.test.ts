import { describe, it, expect } from 'vitest';
import {
  TIER_MAPPINGS,
  isTierAlias,
  resolveModelTier,
  type ModelTier
} from '../src/core/model-tiers.js';

describe('model-tiers', () => {
  describe('TIER_MAPPINGS', () => {
    it('defines best tier for all backends', () => {
      expect(TIER_MAPPINGS.best.codex).toBe('gpt-5.2-pro');
      expect(TIER_MAPPINGS.best.claude).toBe('opus');
      expect(TIER_MAPPINGS.best.gemini).toBe('pro');
    });

    it('defines fast tier for all backends', () => {
      expect(TIER_MAPPINGS.fast.codex).toBe('gpt-5.2-chat-latest');
      expect(TIER_MAPPINGS.fast.claude).toBe('haiku');
      expect(TIER_MAPPINGS.fast.gemini).toBe('flash');
    });
  });

  describe('isTierAlias', () => {
    it('returns true for "best"', () => {
      expect(isTierAlias('best')).toBe(true);
    });

    it('returns true for "fast"', () => {
      expect(isTierAlias('fast')).toBe(true);
    });

    it('returns false for literal model names', () => {
      expect(isTierAlias('opus')).toBe(false);
      expect(isTierAlias('gpt-5.2-pro')).toBe(false);
      expect(isTierAlias('claude-opus-4-5-20251101')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isTierAlias('')).toBe(false);
    });

    it('is case sensitive', () => {
      expect(isTierAlias('BEST')).toBe(false);
      expect(isTierAlias('Best')).toBe(false);
      expect(isTierAlias('FAST')).toBe(false);
    });
  });

  describe('resolveModelTier', () => {
    describe('resolves "best" tier to concrete models', () => {
      it('codex -> gpt-5.2-pro', () => {
        expect(resolveModelTier('best', 'codex')).toBe('gpt-5.2-pro');
      });

      it('claude -> opus', () => {
        expect(resolveModelTier('best', 'claude')).toBe('opus');
      });

      it('gemini -> pro', () => {
        expect(resolveModelTier('best', 'gemini')).toBe('pro');
      });
    });

    describe('resolves "fast" tier to concrete models', () => {
      it('codex -> gpt-5.2-chat-latest', () => {
        expect(resolveModelTier('fast', 'codex')).toBe('gpt-5.2-chat-latest');
      });

      it('claude -> haiku', () => {
        expect(resolveModelTier('fast', 'claude')).toBe('haiku');
      });

      it('gemini -> flash', () => {
        expect(resolveModelTier('fast', 'gemini')).toBe('flash');
      });
    });

    describe('passes through literal model names unchanged', () => {
      it('passes through claude model names', () => {
        expect(resolveModelTier('opus', 'claude')).toBe('opus');
        expect(resolveModelTier('sonnet', 'claude')).toBe('sonnet');
        expect(resolveModelTier('haiku', 'claude')).toBe('haiku');
        expect(resolveModelTier('claude-opus-4-5-20251101', 'claude')).toBe('claude-opus-4-5-20251101');
      });

      it('passes through codex model names', () => {
        expect(resolveModelTier('gpt-5.2-pro', 'codex')).toBe('gpt-5.2-pro');
        expect(resolveModelTier('gpt-5.2-chat-latest', 'codex')).toBe('gpt-5.2-chat-latest');
      });

      it('passes through gemini model names', () => {
        expect(resolveModelTier('pro', 'gemini')).toBe('pro');
        expect(resolveModelTier('flash', 'gemini')).toBe('flash');
        expect(resolveModelTier('gemini-2.0-flash', 'gemini')).toBe('gemini-2.0-flash');
      });

      it('passes through unknown model names', () => {
        expect(resolveModelTier('some-custom-model', 'claude')).toBe('some-custom-model');
        expect(resolveModelTier('experimental-v3', 'codex')).toBe('experimental-v3');
      });
    });
  });
});
