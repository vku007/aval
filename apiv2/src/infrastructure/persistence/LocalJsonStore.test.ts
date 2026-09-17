import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalJsonStore } from './LocalJsonStore.js';
import { ConflictError, NotFoundError, NotModifiedError, PreconditionFailedError } from '../../shared/errors/index.js';

describe('LocalJsonStore', () => {
  let dir: string;
  let store: LocalJsonStore;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'aval-local-store-'));
    store = new LocalJsonStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates an object and returns an MD5 etag', async () => {
    const saved = await store.put('json/games/g1.json', { usersIds: ['u1'] });
    expect(saved.etag).toMatch(/^[a-f0-9]{32}$/);
    expect(saved.size).toBeGreaterThan(0);

    const loaded = await store.get('json/games/g1.json');
    expect(loaded?.data).toEqual({ usersIds: ['u1'] });
    expect(loaded?.etag).toBe(saved.etag);

    const onDisk = await readFile(path.join(dir, 'json/games/g1.json'), 'utf8');
    expect(JSON.parse(onDisk)).toEqual({ usersIds: ['u1'] });
  });

  it('rejects create-only put when the key exists', async () => {
    await store.put('json/a.json', { n: 1 });
    await expect(store.put('json/a.json', { n: 2 }, { ifNoneMatch: '*' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects ifMatch mismatch', async () => {
    await store.put('json/a.json', { n: 1 });
    await expect(
      store.put('json/a.json', { n: 2 }, { ifMatch: 'deadbeef' })
    ).rejects.toBeInstanceOf(PreconditionFailedError);
  });

  it('updates when ifMatch matches', async () => {
    const created = await store.put('json/a.json', { n: 1 });
    const updated = await store.put('json/a.json', { n: 2 }, { ifMatch: created.etag });
    expect(updated.etag).not.toBe(created.etag);
    expect((await store.get('json/a.json'))?.data).toEqual({ n: 2 });
  });

  it('returns 304 semantics when ifNoneMatch matches on get', async () => {
    const created = await store.put('json/a.json', { n: 1 });
    await expect(store.get('json/a.json', created.etag)).rejects.toBeInstanceOf(NotModifiedError);
    await expect(store.get('json/a.json', `"${created.etag}"`)).rejects.toBeInstanceOf(NotModifiedError);
  });

  it('returns null for missing get and throws on missing delete', async () => {
    expect(await store.get('json/missing.json')).toBeNull();
    expect(await store.head('json/missing.json')).toBeNull();
    await expect(store.delete('json/missing.json')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lists with prefix, limit, and cursor', async () => {
    await store.put('json/games/g1.json', { id: 1 });
    await store.put('json/games/g2.json', { id: 2 });
    await store.put('json/games/g3.json', { id: 3 });
    await store.put('json/users/u1.json', { id: 'u' });

    const page1 = await store.list('json/games/', 2);
    expect(page1.keys.map((k) => k.key)).toEqual(['json/games/g1.json', 'json/games/g2.json']);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await store.list('json/games/', 2, page1.nextCursor);
    expect(page2.keys.map((k) => k.key)).toEqual(['json/games/g3.json']);
    expect(page2.nextCursor).toBeUndefined();
  });

  it('serializes concurrent writes per key', async () => {
    const first = await store.put('json/a.json', { n: 0 });
    const results = await Promise.all([
      store.put('json/a.json', { n: 1 }, { ifMatch: first.etag }).catch((e) => e),
      store.put('json/a.json', { n: 2 }, { ifMatch: first.etag }).catch((e) => e)
    ]);
    const successes = results.filter((r) => !(r instanceof Error));
    const failures = results.filter((r) => r instanceof PreconditionFailedError);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });
});
