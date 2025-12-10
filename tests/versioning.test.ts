import { describe, expect, it } from 'vitest';
import {
  annotateAvailabilityWithVersion,
  evaluateVersion,
  extractSemver,
  VERSION_BASELINES
} from '../src/adapters/versioning.js';

describe('extractSemver', () => {
  it('grabs the first semantic version from noisy output', () => {
    expect(extractSemver('codex-cli 0.66.0')).toBe('0.66.0');
    expect(extractSemver('2.0.62 (Claude Code)')).toBe('2.0.62');
    expect(extractSemver('gemini-cli/0.19.3')).toBe('0.19.3');
  });

  it('returns null when no version is present', () => {
    expect(extractSemver('no version here')).toBeNull();
  });
});

describe('evaluateVersion', () => {
  it('treats baseline versions as OK', () => {
    const result = evaluateVersion('codex', 'codex-cli 0.66.0');
    expect(result.status).toBe('ok');
    expect(result.reasons).toHaveLength(0);
    expect(result.detectedVersion).toBe('0.66.0');
  });

  it('warns when newer than the tested range', () => {
    const result = evaluateVersion('codex', '0.70.0');
    expect(result.status).toBe('warn');
    expect(result.reasons[0]).toContain(VERSION_BASELINES.codex.maxTested);
  });

  it('marks below-minimum versions unsupported', () => {
    const result = evaluateVersion('codex', '0.60.0');
    expect(result.status).toBe('unsupported');
    expect(result.reasons[0]).toContain(VERSION_BASELINES.codex.minSupported);
  });

  it('warns when parsing fails', () => {
    const result = evaluateVersion('claude', 'unknown');
    expect(result.status).toBe('warn');
    expect(result.reasons[0]).toMatch(/Unable to parse/);
  });
});

describe('annotateAvailabilityWithVersion', () => {
  it('attaches version status and warnings to availability', () => {
    const annotated = annotateAvailabilityWithVersion(
      'codex',
      { available: true },
      'codex-cli 0.60.0'
    );

    expect(annotated.versionStatus?.status).toBe('unsupported');
    expect(annotated.warnings?.[0]).toContain('below minimum');
    expect(annotated.rawVersionOutput).toBe('codex-cli 0.60.0');
  });
});
