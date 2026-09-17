import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ConflictError, NotFoundError, NotModifiedError, PreconditionFailedError } from '../../shared/errors/index.js';

export interface StoredObject {
  data: unknown;
  etag: string;
  size: number;
  lastModified: string;
}

export interface StoredObjectMeta {
  key: string;
  etag: string;
  size: number;
  lastModified: string;
}

export interface PutOptions {
  ifMatch?: string;
  ifNoneMatch?: string;
}

export interface ListResult {
  keys: StoredObjectMeta[];
  nextCursor?: string;
}

/**
 * Filesystem JSON object store with S3-like keys and ETag optimistic locking.
 * Keys are relative POSIX paths (e.g. json/games/{id}.json) under DATA_DIR.
 */
export class LocalJsonStore {
  private readonly root: string;
  private readonly locks = new Map<string, Promise<void>>();

  constructor(dataDir: string) {
    this.root = path.resolve(dataDir);
  }

  async get(key: string, ifNoneMatch?: string): Promise<StoredObject | null> {
    const existing = await this.readObject(key);
    if (!existing) {
      return null;
    }
    if (ifNoneMatch && etagsEqual(ifNoneMatch, existing.etag)) {
      throw new NotModifiedError(`Object '${key}' not modified`);
    }
    return existing;
  }

  async head(key: string): Promise<Omit<StoredObject, 'data'> | null> {
    const existing = await this.readObject(key);
    if (!existing) {
      return null;
    }
    return {
      etag: existing.etag,
      size: existing.size,
      lastModified: existing.lastModified
    };
  }

  async put(key: string, data: unknown, opts?: PutOptions): Promise<StoredObject> {
    return this.withLock(key, async () => {
      const existing = await this.readObject(key);
      this.checkPutPreconditions(key, existing, opts);

      const body = JSON.stringify(data);
      const etag = md5(body);
      const filePath = this.resolveKey(key);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const tmp = `${filePath}.${randomUUID()}.tmp`;
      await fs.writeFile(tmp, body, 'utf8');
      await fs.rename(tmp, filePath);
      const stat = await fs.stat(filePath);

      return {
        data,
        etag,
        size: Buffer.byteLength(body, 'utf8'),
        lastModified: stat.mtime.toISOString()
      };
    });
  }

  async delete(key: string, opts?: { ifMatch?: string }): Promise<void> {
    return this.withLock(key, async () => {
      const existing = await this.readObject(key);
      if (!existing) {
        throw new NotFoundError(`Object '${key}' not found`);
      }
      if (opts?.ifMatch && !etagsEqual(opts.ifMatch, existing.etag)) {
        throw new PreconditionFailedError(`Object '${key}' ETag mismatch`);
      }
      await fs.unlink(this.resolveKey(key));
    });
  }

  async list(prefix: string, limit?: number, cursor?: string): Promise<ListResult> {
    const keys = (await this.walkKeys())
      .filter((k) => k.startsWith(prefix))
      .sort();

    const start = decodeCursor(cursor);
    const pageSize = limit && limit > 0 ? limit : keys.length;
    const slice = keys.slice(start, start + pageSize);

    const metas: StoredObjectMeta[] = [];
    for (const key of slice) {
      const obj = await this.readObject(key);
      if (obj) {
        metas.push({
          key,
          etag: obj.etag,
          size: obj.size,
          lastModified: obj.lastModified
        });
      }
    }

    const nextOffset = start + slice.length;
    const nextCursor = nextOffset < keys.length ? encodeCursor(nextOffset) : undefined;

    return { keys: metas, nextCursor };
  }

  private checkPutPreconditions(key: string, existing: StoredObject | null, opts?: PutOptions): void {
    if (!opts?.ifMatch && !opts?.ifNoneMatch) {
      return;
    }

    if (opts.ifNoneMatch === '*') {
      if (existing) {
        throw new ConflictError(`Object '${key}' already exists`);
      }
    } else if (opts.ifNoneMatch && existing && etagsEqual(opts.ifNoneMatch, existing.etag)) {
      throw new NotModifiedError(`Object '${key}' not modified`);
    }

    if (opts.ifMatch) {
      if (!existing) {
        throw new NotFoundError(`Object '${key}' not found`);
      }
      if (!etagsEqual(opts.ifMatch, existing.etag)) {
        throw new PreconditionFailedError(`Object '${key}' ETag mismatch`);
      }
    }
  }

  private async readObject(key: string): Promise<StoredObject | null> {
    const filePath = this.resolveKey(key);
    try {
      const body = await fs.readFile(filePath, 'utf8');
      const stat = await fs.stat(filePath);
      const data = body ? JSON.parse(body) : {};
      return {
        data,
        etag: md5(body),
        size: Buffer.byteLength(body, 'utf8'),
        lastModified: stat.mtime.toISOString()
      };
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private async walkKeys(): Promise<string[]> {
    try {
      await fs.access(this.root);
    } catch {
      return [];
    }
    return this.walkDir(this.root);
  }

  private async walkDir(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const keys: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        keys.push(...await this.walkDir(full));
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        keys.push(path.relative(this.root, full).split(path.sep).join('/'));
      }
    }
    return keys;
  }

  private resolveKey(key: string): string {
    if (!key || key.includes('..') || path.isAbsolute(key)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    const resolved = path.resolve(this.root, key);
    const rootWithSep = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
    if (resolved !== this.root && !resolved.startsWith(rootWithSep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return resolved;
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => current);
    this.locks.set(key, chained);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(key) === chained) {
        this.locks.delete(key);
      }
    }
  }
}

function md5(body: string): string {
  return createHash('md5').update(body, 'utf8').digest('hex');
}

export function etagsEqual(a: string, b: string): boolean {
  return a.replace(/"/g, '') === b.replace(/"/g, '');
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string): number {
  if (!cursor) {
    return 0;
  }
  const parsed = Number.parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
