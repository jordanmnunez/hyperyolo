import type { BackendName } from '../core/executor.js';
import type { AvailabilityResult, VersionCheckResult, VersionStatus } from './types.js';

export interface VersionBaseline {
  versionCommand: string;
  minSupported: string;
  maxTested: string;
  blockedVersions?: string[];
  parseVersion?: (output: string) => string | null;
}

export const VERSION_BASELINES: Record<BackendName, VersionBaseline> = {
  codex: {
    versionCommand: 'codex --version',
    minSupported: '0.66.0',
    maxTested: '0.66.0'
  },
  claude: {
    versionCommand: 'claude --version',
    minSupported: '2.0.62',
    maxTested: '2.0.62'
  },
  gemini: {
    versionCommand: 'gemini --version',
    minSupported: '0.19.3',
    maxTested: '0.19.3'
  }
};

const SEMVER_REGEX = /(\d+)\.(\d+)\.(\d+(?:-[0-9A-Za-z.-]+)?)/;

export function extractSemver(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(SEMVER_REGEX);
  return match ? match[0] ?? null : null;
}

function compareVersions(left: string, right: string): number {
  const normalize = (value: string): [number, number, number] => {
    const [core] = value.split(/[-+]/);
    const parts = core.split('.').map((part) => Number.parseInt(part, 10) || 0);
    while (parts.length < 3) {
      parts.push(0);
    }

    return [parts[0], parts[1], parts[2]];
  };

  const [lMajor, lMinor, lPatch] = normalize(left);
  const [rMajor, rMinor, rPatch] = normalize(right);

  if (lMajor !== rMajor) {
    return lMajor > rMajor ? 1 : -1;
  }

  if (lMinor !== rMinor) {
    return lMinor > rMinor ? 1 : -1;
  }

  if (lPatch !== rPatch) {
    return lPatch > rPatch ? 1 : -1;
  }

  return 0;
}

export function evaluateVersion(
  backend: BackendName,
  rawVersion?: string | null
): VersionCheckResult {
  const baseline = VERSION_BASELINES[backend];
  const parsed =
    (rawVersion && baseline.parseVersion?.(rawVersion)) ?? extractSemver(rawVersion ?? undefined);
  const blockedVersions = baseline.blockedVersions ?? [];
  const reasons: string[] = [];
  let status: VersionStatus = 'ok';

  if (!parsed) {
    status = 'warn';
    reasons.push('Unable to parse version output; continuing with best-effort compatibility.');
  }

  if (parsed) {
    if (blockedVersions.some((blocked) => compareVersions(parsed, blocked) === 0)) {
      status = 'unsupported';
      reasons.push(`Version ${parsed} is explicitly blocked for ${backend}.`);
    }

    if (compareVersions(parsed, baseline.minSupported) < 0) {
      status = 'unsupported';
      reasons.push(`Detected ${parsed} is below minimum supported ${baseline.minSupported}.`);
    } else if (compareVersions(parsed, baseline.maxTested) > 0 && status !== 'unsupported') {
      status = 'warn';
      reasons.push(`Detected ${parsed} is newer than last tested ${baseline.maxTested}.`);
    }
  }

  return {
    backend,
    detectedVersion: parsed ?? rawVersion ?? null,
    minimumSupported: baseline.minSupported,
    maximumTested: baseline.maxTested,
    blockedVersions,
    status,
    reasons
  };
}

export function annotateAvailabilityWithVersion(
  backend: BackendName,
  availability: AvailabilityResult,
  versionOutput?: string | null
): AvailabilityResult {
  const rawVersion = versionOutput ?? availability.rawVersionOutput ?? availability.version;
  const versionStatus = evaluateVersion(backend, rawVersion);
  const warnings = [...(availability.warnings ?? [])];

  if (versionStatus.status === 'unsupported') {
    warnings.push(
      versionStatus.reasons[0] ??
        `Detected ${versionStatus.detectedVersion ?? 'unknown'} is below the supported range`
    );
  } else if (versionStatus.status === 'warn' && versionStatus.reasons.length) {
    warnings.push(...versionStatus.reasons);
  }

  const rawVersionOutput =
    versionOutput ?? availability.rawVersionOutput ?? availability.version ?? undefined;

  return {
    ...availability,
    rawVersionOutput,
    warnings: warnings.length ? warnings : undefined,
    versionStatus
  };
}
