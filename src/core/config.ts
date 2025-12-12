import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { BackendName } from './executor.js';

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
 */
export const HARDCODED_DEFAULTS: ResolvedDefaults = {
  codex: 'gpt-5.2-pro',
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
 * Load and resolve model defaults from config file, falling back to hardcoded defaults.
 * This is the main entry point for getting model defaults.
 *
 * @returns Resolved defaults for all backends
 */
export async function loadConfig(): Promise<ResolvedDefaults> {
  const config = await loadConfigFile();

  if (!config?.defaults) {
    return { ...HARDCODED_DEFAULTS };
  }

  // Merge config defaults with hardcoded defaults
  return {
    codex: config.defaults.codex ?? HARDCODED_DEFAULTS.codex,
    claude: config.defaults.claude ?? HARDCODED_DEFAULTS.claude,
    gemini: config.defaults.gemini ?? HARDCODED_DEFAULTS.gemini
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
