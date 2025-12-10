import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import lockfile from 'proper-lockfile';
import {
  SessionStore,
  type SessionStoreData,
  type SessionStoreOptions
} from '../src/core/session-store.js';

const baseRecord = (nativeId: string) => ({
  backend: 'codex' as const,
  nativeId,
  createdAt: new Date(0).toISOString()
});

async function createStore(options: SessionStoreOptions = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyperyolo-session-store-'));
  const filePath = path.join(dir, 'sessions.json');
  const warnings: string[] = [];

  const store = new SessionStore({
    filePath,
    ...options,
    onWarning: (msg) => warnings.push(msg)
  });

  return { store, filePath, dir, warnings };
}

async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
}

describe('SessionStore concurrency', () => {
  test('serializes concurrent updates without dropping entries', async () => {
    const { store, dir } = await createStore();

    try {
      const updates = Array.from({ length: 12 }, (_, idx) =>
        store.update((data) => ({
          ...data,
          [`hyper_${idx}`]: baseRecord(`native-${idx}`)
        }))
      );

      await Promise.all(updates);
      const final = await store.read();

      expect(Object.keys(final)).toHaveLength(12);
      expect(final.hyper_5?.nativeId).toBe('native-5');
    } finally {
      await cleanup(dir);
    }
  });

  test('recovers from stale locks to allow forward progress', async () => {
    const staleMs = 2000;
    const { store, filePath, dir } = await createStore({
      staleMs
    });

    try {
      const lockPath = `${filePath}.lock`;
      await fs.mkdir(path.dirname(lockPath), { recursive: true });
      await fs.mkdir(lockPath);

      const staleDate = new Date(Date.now() - staleMs - 100);
      await fs.utimes(lockPath, staleDate, staleDate);

      const updated = await store.update((data: SessionStoreData) => ({
        ...data,
        hyper_stale: baseRecord('native-stale')
      }));

      expect(updated.hyper_stale.nativeId).toBe('native-stale');
      expect(await lockfile.check(filePath, { stale: staleMs, realpath: false })).toBe(false);
    } finally {
      await cleanup(dir);
    }
  });

  test('falls back to an unlocked read when the lock cannot be acquired', async () => {
    const { store, filePath, dir, warnings } = await createStore({
      staleMs: 10_000,
      lockRetries: { retries: 0 }
    });

    let release: (() => Promise<void>) | null = null;

    try {
      await store.write({ hyper_existing: baseRecord('native-existing') });

      release = await lockfile.lock(filePath, { stale: 10_000, realpath: false });
      const data = await store.read();

      expect(data.hyper_existing?.nativeId).toBe('native-existing');
      expect(warnings.some((msg) => msg.includes('falling back to unlocked read'))).toBe(true);
    } finally {
      await release?.();
      await cleanup(dir);
    }
  });
});
