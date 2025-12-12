import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  loadConfigFile,
  loadConfig,
  getDefaultModel,
  getConfigPath,
  getEnvModelOverride,
  HARDCODED_DEFAULTS,
  ENV_GLOBAL_MODEL,
  ENV_BACKEND_MODEL,
  ConfigParseError,
  ConfigReadError
} from '../src/core/config.js';

async function withTempConfig(
  content: string | null,
  fn: (configPath: string) => Promise<void>
): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyperyolo-config-'));
  const configPath = path.join(dir, 'hyperyolo', 'config.json');

  // Set XDG_CONFIG_HOME to our temp dir
  const originalXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;

  try {
    if (content !== null) {
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, content, 'utf8');
    }

    await fn(configPath);
  } finally {
    process.env.XDG_CONFIG_HOME = originalXdg;
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

describe('getConfigPath', () => {
  test('uses XDG_CONFIG_HOME when set', () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    try {
      process.env.XDG_CONFIG_HOME = '/custom/config';
      expect(getConfigPath()).toBe('/custom/config/hyperyolo/config.json');
    } finally {
      process.env.XDG_CONFIG_HOME = originalXdg;
    }
  });

  test('falls back to ~/.config when XDG_CONFIG_HOME not set', () => {
    const originalXdg = process.env.XDG_CONFIG_HOME;
    try {
      delete process.env.XDG_CONFIG_HOME;
      expect(getConfigPath()).toBe(path.join(os.homedir(), '.config', 'hyperyolo', 'config.json'));
    } finally {
      process.env.XDG_CONFIG_HOME = originalXdg;
    }
  });
});

describe('loadConfigFile', () => {
  test('returns null when config file does not exist', async () => {
    await withTempConfig(null, async () => {
      const config = await loadConfigFile();
      expect(config).toBeNull();
    });
  });

  test('returns null for empty config file', async () => {
    await withTempConfig('', async () => {
      const config = await loadConfigFile();
      expect(config).toBeNull();
    });
  });

  test('parses valid JSON config', async () => {
    const content = JSON.stringify({
      defaults: {
        codex: 'gpt-5.2',
        claude: 'sonnet',
        gemini: 'flash'
      }
    });

    await withTempConfig(content, async () => {
      const config = await loadConfigFile();
      expect(config).toEqual({
        defaults: {
          codex: 'gpt-5.2',
          claude: 'sonnet',
          gemini: 'flash'
        }
      });
    });
  });

  test('handles config with only some backends', async () => {
    const content = JSON.stringify({
      defaults: {
        claude: 'haiku'
      }
    });

    await withTempConfig(content, async () => {
      const config = await loadConfigFile();
      expect(config?.defaults?.claude).toBe('haiku');
      expect(config?.defaults?.codex).toBeUndefined();
    });
  });

  test('throws ConfigParseError for invalid JSON', async () => {
    await withTempConfig('{ invalid json }', async () => {
      await expect(loadConfigFile()).rejects.toThrow(ConfigParseError);
    });
  });

  test('throws ConfigParseError for non-object JSON', async () => {
    await withTempConfig('"just a string"', async () => {
      await expect(loadConfigFile()).rejects.toThrow(ConfigParseError);
    });
  });

  test('throws ConfigParseError for array JSON', async () => {
    await withTempConfig('[]', async () => {
      await expect(loadConfigFile()).rejects.toThrow(ConfigParseError);
    });
  });
});

describe('loadConfig', () => {
  test('returns hardcoded defaults when no config file exists', async () => {
    await withTempConfig(null, async () => {
      const defaults = await loadConfig();
      expect(defaults).toEqual(HARDCODED_DEFAULTS);
    });
  });

  test('returns hardcoded defaults when config has no defaults section', async () => {
    await withTempConfig('{}', async () => {
      const defaults = await loadConfig();
      expect(defaults).toEqual(HARDCODED_DEFAULTS);
    });
  });

  test('merges config defaults with hardcoded defaults', async () => {
    const content = JSON.stringify({
      defaults: {
        claude: 'sonnet'
      }
    });

    await withTempConfig(content, async () => {
      const defaults = await loadConfig();
      expect(defaults.claude).toBe('sonnet');
      expect(defaults.codex).toBe(HARDCODED_DEFAULTS.codex);
      expect(defaults.gemini).toBe(HARDCODED_DEFAULTS.gemini);
    });
  });

  test('config values override all hardcoded defaults', async () => {
    const content = JSON.stringify({
      defaults: {
        codex: 'gpt-5.2-chat-latest',
        claude: 'haiku',
        gemini: 'flash'
      }
    });

    await withTempConfig(content, async () => {
      const defaults = await loadConfig();
      expect(defaults).toEqual({
        codex: 'gpt-5.2-chat-latest',
        claude: 'haiku',
        gemini: 'flash'
      });
    });
  });

  test('supports tier aliases in config', async () => {
    const content = JSON.stringify({
      defaults: {
        codex: 'fast',
        claude: 'best',
        gemini: 'fast'
      }
    });

    await withTempConfig(content, async () => {
      const defaults = await loadConfig();
      // Config values are returned as-is; tier resolution happens elsewhere
      expect(defaults.codex).toBe('fast');
      expect(defaults.claude).toBe('best');
      expect(defaults.gemini).toBe('fast');
    });
  });
});

describe('getDefaultModel', () => {
  test('returns hardcoded default when no config exists', async () => {
    await withTempConfig(null, async () => {
      expect(await getDefaultModel('claude')).toBe(HARDCODED_DEFAULTS.claude);
      expect(await getDefaultModel('codex')).toBe(HARDCODED_DEFAULTS.codex);
      expect(await getDefaultModel('gemini')).toBe(HARDCODED_DEFAULTS.gemini);
    });
  });

  test('returns config value when set', async () => {
    const content = JSON.stringify({
      defaults: {
        claude: 'haiku'
      }
    });

    await withTempConfig(content, async () => {
      expect(await getDefaultModel('claude')).toBe('haiku');
    });
  });
});

describe('HARDCODED_DEFAULTS', () => {
  test('has best-tier defaults for all backends', () => {
    expect(HARDCODED_DEFAULTS.codex).toBe('gpt-5.2-pro');
    expect(HARDCODED_DEFAULTS.claude).toBe('opus');
    expect(HARDCODED_DEFAULTS.gemini).toBe('pro');
  });
});

describe('ENV constants', () => {
  test('ENV_GLOBAL_MODEL is HYPERYOLO_MODEL', () => {
    expect(ENV_GLOBAL_MODEL).toBe('HYPERYOLO_MODEL');
  });

  test('ENV_BACKEND_MODEL has correct per-backend var names', () => {
    expect(ENV_BACKEND_MODEL.codex).toBe('HYPERYOLO_CODEX_MODEL');
    expect(ENV_BACKEND_MODEL.claude).toBe('HYPERYOLO_CLAUDE_MODEL');
    expect(ENV_BACKEND_MODEL.gemini).toBe('HYPERYOLO_GEMINI_MODEL');
  });
});

function withEnvVars(
  vars: Record<string, string | undefined>,
  fn: () => void | Promise<void>
): Promise<void> | void {
  const originalValues: Record<string, string | undefined> = {};

  // Save original values and set new ones
  for (const [key, value] of Object.entries(vars)) {
    originalValues[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const restore = () => {
    for (const [key, value] of Object.entries(originalValues)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(restore);
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

describe('getEnvModelOverride', () => {
  test('returns undefined when no env vars set', () => {
    withEnvVars(
      {
        HYPERYOLO_MODEL: undefined,
        HYPERYOLO_CODEX_MODEL: undefined,
        HYPERYOLO_CLAUDE_MODEL: undefined,
        HYPERYOLO_GEMINI_MODEL: undefined
      },
      () => {
        expect(getEnvModelOverride('codex')).toBeUndefined();
        expect(getEnvModelOverride('claude')).toBeUndefined();
        expect(getEnvModelOverride('gemini')).toBeUndefined();
      }
    );
  });

  test('returns global var value when set', () => {
    withEnvVars(
      {
        HYPERYOLO_MODEL: 'fast',
        HYPERYOLO_CODEX_MODEL: undefined,
        HYPERYOLO_CLAUDE_MODEL: undefined,
        HYPERYOLO_GEMINI_MODEL: undefined
      },
      () => {
        expect(getEnvModelOverride('codex')).toBe('fast');
        expect(getEnvModelOverride('claude')).toBe('fast');
        expect(getEnvModelOverride('gemini')).toBe('fast');
      }
    );
  });

  test('backend-specific var takes precedence over global', () => {
    withEnvVars(
      {
        HYPERYOLO_MODEL: 'fast',
        HYPERYOLO_CODEX_MODEL: 'gpt-5.2-codex-max',
        HYPERYOLO_CLAUDE_MODEL: undefined,
        HYPERYOLO_GEMINI_MODEL: undefined
      },
      () => {
        expect(getEnvModelOverride('codex')).toBe('gpt-5.2-codex-max');
        expect(getEnvModelOverride('claude')).toBe('fast');
        expect(getEnvModelOverride('gemini')).toBe('fast');
      }
    );
  });

  test('each backend can have independent override', () => {
    withEnvVars(
      {
        HYPERYOLO_MODEL: undefined,
        HYPERYOLO_CODEX_MODEL: 'gpt-5.2',
        HYPERYOLO_CLAUDE_MODEL: 'sonnet',
        HYPERYOLO_GEMINI_MODEL: 'flash'
      },
      () => {
        expect(getEnvModelOverride('codex')).toBe('gpt-5.2');
        expect(getEnvModelOverride('claude')).toBe('sonnet');
        expect(getEnvModelOverride('gemini')).toBe('flash');
      }
    );
  });
});

describe('loadConfig with env vars', () => {
  test('env var overrides config file', async () => {
    const content = JSON.stringify({
      defaults: {
        codex: 'gpt-5.2',
        claude: 'sonnet',
        gemini: 'flash'
      }
    });

    await withTempConfig(content, async () => {
      await withEnvVars({ HYPERYOLO_CLAUDE_MODEL: 'haiku' }, async () => {
        const defaults = await loadConfig();
        expect(defaults.claude).toBe('haiku'); // env wins
        expect(defaults.codex).toBe('gpt-5.2'); // config
        expect(defaults.gemini).toBe('flash'); // config
      });
    });
  });

  test('env var overrides hardcoded default', async () => {
    await withTempConfig(null, async () => {
      await withEnvVars({ HYPERYOLO_MODEL: 'fast' }, async () => {
        const defaults = await loadConfig();
        expect(defaults.codex).toBe('fast');
        expect(defaults.claude).toBe('fast');
        expect(defaults.gemini).toBe('fast');
      });
    });
  });

  test('backend-specific env var overrides global env var', async () => {
    await withTempConfig(null, async () => {
      await withEnvVars(
        {
          HYPERYOLO_MODEL: 'fast',
          HYPERYOLO_GEMINI_MODEL: 'pro'
        },
        async () => {
          const defaults = await loadConfig();
          expect(defaults.codex).toBe('fast'); // global env
          expect(defaults.claude).toBe('fast'); // global env
          expect(defaults.gemini).toBe('pro'); // backend-specific wins
        }
      );
    });
  });

  test('full precedence chain: env > config > hardcoded', async () => {
    const content = JSON.stringify({
      defaults: {
        codex: 'gpt-5.2', // config for codex
        // claude not in config - will use env or hardcoded
        gemini: 'flash' // config for gemini
      }
    });

    await withTempConfig(content, async () => {
      await withEnvVars(
        {
          HYPERYOLO_MODEL: undefined,
          HYPERYOLO_CODEX_MODEL: undefined,
          HYPERYOLO_CLAUDE_MODEL: 'sonnet', // env for claude only
          HYPERYOLO_GEMINI_MODEL: undefined
        },
        async () => {
          const defaults = await loadConfig();
          expect(defaults.codex).toBe('gpt-5.2'); // config (no env)
          expect(defaults.claude).toBe('sonnet'); // env (no config)
          expect(defaults.gemini).toBe('flash'); // config (no env)
        }
      );
    });
  });
});

describe('getDefaultModel with env vars', () => {
  test('returns env var value when set', async () => {
    await withTempConfig(null, async () => {
      await withEnvVars({ HYPERYOLO_CLAUDE_MODEL: 'haiku' }, async () => {
        expect(await getDefaultModel('claude')).toBe('haiku');
      });
    });
  });
});
