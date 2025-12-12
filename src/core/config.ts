import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { BackendName } from './executor.js';

/**
 * Environment variable names for model overrides.
 * Global: HYPERYOLO_MODEL (applies to all backends)
 * Per-backend: HYPERYOLO_CODEX_MODEL, HYPERYOLO_CLAUDE_MODEL, HYPERYOLO_GEMINI_MODEL
 */
export const ENV_GLOBAL_MODEL = 'HYPERYOLO_MODEL';
export const ENV_BACKEND_MODEL: Record<BackendName, string> = {
  codex: 'HYPERYOLO_CODEX_MODEL',
  claude: 'HYPERYOLO_CLAUDE_MODEL',
  gemini: 'HYPERYOLO_GEMINI_MODEL'
};

/**
 * User configuration schema.
 * Stored at ~/.config/hyperyolo/config.json (or XDG_CONFIG_HOME).
 */
export interface HyperyoloConfig {
  defaults?: {
    codex?: string;
    claude?: string;
    gemini?: string;
  };
}

/**
 * Resolved defaults: all backends have a value (from config or hardcoded fallback).
 */
export type ResolvedDefaults = Record<BackendName, string>;

/**
 * The hardcoded best-tier defaults used when no config file exists.
 *
 * Note: Codex uses gpt-5.1-codex-max because GPT-5.2 models are only
 * available for API accounts, not ChatGPT accounts. Most Codex CLI
 * users authenticate via ChatGPT, so we default to the best model
 * available to them.
 */
export const HARDCODED_DEFAULTS: ResolvedDefaults = {
  codex: 'gpt-5.1-codex-max',
  claude: 'opus',
  gemini: 'pro'
};

/**
 * Get the path to the hyperyolo config file.
 * Respects XDG_CONFIG_HOME environment variable.
 */
export function getConfigPath(): string {
  const configRoot = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  return path.join(configRoot, 'hyperyolo', 'config.json');
}

/**
 * Load user configuration from the config file.
 * Returns null if the file doesn't exist.
 * Throws on parse errors or read errors (other than ENOENT).
 */
export async function loadConfigFile(): Promise<HyperyoloConfig | null> {
  const configPath = getConfigPath();

  try {
    const raw = await fs.readFile(configPath, 'utf8');
    if (!raw.trim()) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;

    // Basic validation: must be an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new ConfigParseError(`Config file must be a JSON object: ${configPath}`);
    }

    return parsed as HyperyoloConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    if (error instanceof SyntaxError) {
      throw new ConfigParseError(`Invalid JSON in config file: ${configPath}`, error);
    }

    if (error instanceof ConfigParseError) {
      throw error;
    }

    throw new ConfigReadError(`Failed to read config file: ${configPath}`, error as Error);
  }
}

/**
 * Get the environment variable override for a specific backend.
 * Checks backend-specific var first, then falls back to global var.
 *
 * Precedence: HYPERYOLO_CODEX_MODEL > HYPERYOLO_MODEL
 *
 * @param backend - The backend to get the env override for
 * @returns The env var value, or undefined if not set
 */
export function getEnvModelOverride(backend: BackendName): string | undefined {
  // Backend-specific var takes precedence
  const backendVar = process.env[ENV_BACKEND_MODEL[backend]];
  if (backendVar) {
    return backendVar;
  }

  // Fall back to global var
  const globalVar = process.env[ENV_GLOBAL_MODEL];
  if (globalVar) {
    return globalVar;
  }

  return undefined;
}

/**
 * Load and resolve model defaults from environment, config file, and hardcoded defaults.
 * This is the main entry point for getting model defaults.
 *
 * Precedence order (highest to lowest):
 * 1. Environment variable (HYPERYOLO_CODEX_MODEL or HYPERYOLO_MODEL)
 * 2. Config file default
 * 3. Hardcoded default
 *
 * Note: --model flag is handled at a higher level and always wins.
 *
 * @returns Resolved defaults for all backends
 */
export async function loadConfig(): Promise<ResolvedDefaults> {
  const config = await loadConfigFile();

  // For each backend: env > config > hardcoded
  const resolveBackend = (backend: BackendName): string => {
    // Check environment variable first
    const envOverride = getEnvModelOverride(backend);
    if (envOverride) {
      return envOverride;
    }

    // Then config file
    if (config?.defaults?.[backend]) {
      return config.defaults[backend]!;
    }

    // Finally hardcoded default
    return HARDCODED_DEFAULTS[backend];
  };

  return {
    codex: resolveBackend('codex'),
    claude: resolveBackend('claude'),
    gemini: resolveBackend('gemini')
  };
}

/**
 * Get the default model for a specific backend.
 * Loads config on each call - use loadConfig() if you need multiple backends.
 *
 * @param backend - The backend to get the default for
 * @returns The default model (from config or hardcoded)
 */
export async function getDefaultModel(backend: BackendName): Promise<string> {
  const defaults = await loadConfig();
  return defaults[backend];
}

/**
 * Error thrown when config file cannot be parsed.
 */
export class ConfigParseError extends Error {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
    this.name = 'ConfigParseError';
  }
}

/**
 * Error thrown when config file cannot be read (other than not existing).
 */
export class ConfigReadError extends Error {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
    this.name = 'ConfigReadError';
  }
}
