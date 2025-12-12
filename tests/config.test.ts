import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  loadConfigFile,
  loadConfig,
  getDefaultModel,
  getConfigPath,
  HARDCODED_DEFAULTS,
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
