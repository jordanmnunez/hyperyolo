import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import lockfile from 'proper-lockfile';
import type { LockOptions } from 'proper-lockfile';
import type { OperationOptions } from 'retry';
import type { BackendName } from './executor.js';

export interface SessionRecord {
  backend: BackendName;
  nativeId: string;
  createdAt: string;
  lastSeenAt?: string;
  lastPrompt?: string;
  invalid?: boolean;
}

export type SessionStoreData = Record<string, SessionRecord>;

export interface SessionStoreOptions {
  filePath?: string;
  staleMs?: number;
  lockRetries?: number | OperationOptions;
  onWarning?: (message: string) => void;
}

const DEFAULT_STALE_MS = 30_000;
const DEFAULT_LOCK_RETRIES: OperationOptions = {
  retries: 10,
  factor: 1.5,
  minTimeout: 25,
  maxTimeout: 250,
  randomize: true
};

export class SessionStore {
  readonly filePath: string;
  private readonly lockOptions: LockOptions;
  private readonly onWarning?: (message: string) => void;

  constructor(options: SessionStoreOptions = {}) {
    this.filePath = options.filePath ?? defaultSessionStorePath();
    this.onWarning = options.onWarning;
    this.lockOptions = {
      stale: options.staleMs ?? DEFAULT_STALE_MS,
      retries: options.lockRetries ?? DEFAULT_LOCK_RETRIES,
      realpath: false,
      onCompromised: (err) => this.warn(`Session store lock compromised: ${err.message}`)
    };
  }

  async read(): Promise<SessionStoreData> {
    try {
      return await this.withLock(() => this.readWithoutLock());
    } catch (error) {
      if (error instanceof SessionStoreLockError) {
        this.warn(`${error.message}; falling back to unlocked read`);
        return this.readWithoutLock();
      }

      throw error;
    }
  }

  async write(data: SessionStoreData): Promise<void> {
    await this.withLock(() => this.writeWithoutLock(data));
  }

  async update(
    mutator: (current: SessionStoreData) => SessionStoreData | Promise<SessionStoreData>
  ): Promise<SessionStoreData> {
    return this.withLock(async () => {
      const current = await this.readWithoutLock();
      const next = await mutator(current);
      await this.writeWithoutLock(next);
      return next;
    });
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.ensureParentDir();
    let release: (() => Promise<void>) | null = null;

    try {
      release = await lockfile.lock(this.filePath, this.lockOptions);
    } catch (error) {
      throw new SessionStoreLockError(
        'Unable to acquire session store lock; another hyperyolo process may be running.',
        error as Error
      );
    }

    try {
      return await fn();
    } finally {
      if (release) {
        try {
          await release();
        } catch (error) {
          this.warn(`Failed to release session store lock: ${(error as Error).message}`);
        }
      }
    }
  }

  private async readWithoutLock(retryOnParse = true): Promise<SessionStoreData> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      if (!raw.trim()) {
        return {};
      }

      return JSON.parse(raw) as SessionStoreData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }

      if (error instanceof SyntaxError && retryOnParse) {
        await delay(10);
        return this.readWithoutLock(false);
      }

      throw new SessionStoreReadError('Failed to read session store', error as Error);
    }
  }

  private async writeWithoutLock(data: SessionStoreData): Promise<void> {
    await this.ensureParentDir();
    const tempPath = `${this.filePath}.tmp`;
    const serialized = JSON.stringify(data, null, 2);

    let handle: fs.FileHandle | null = null;

    try {
      handle = await fs.open(tempPath, 'w');
      await handle.writeFile(serialized, 'utf8');
      await handle.sync();
    } catch (error) {
      throw new SessionStoreWriteError('Failed to write session store', error as Error);
    } finally {
      if (handle) {
        await handle.close().catch(() => undefined);
      }
    }

    try {
      await fs.rename(tempPath, this.filePath);
    } catch (error) {
      await fs.unlink(tempPath).catch(() => undefined);
      throw new SessionStoreWriteError('Failed to finalize session store write', error as Error);
    }
  }

  private async ensureParentDir(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  }

  private warn(message: string): void {
    this.onWarning?.(message);
  }
}

export class SessionStoreError extends Error {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
    this.name = 'SessionStoreError';
  }
}

export class SessionStoreLockError extends SessionStoreError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'SessionStoreLockError';
  }
}

export class SessionStoreReadError extends SessionStoreError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'SessionStoreReadError';
  }
}

export class SessionStoreWriteError extends SessionStoreError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'SessionStoreWriteError';
  }
}

export function defaultSessionStorePath(): string {
  const configRoot = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  return path.join(configRoot, 'hyperyolo', 'sessions.json');
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
