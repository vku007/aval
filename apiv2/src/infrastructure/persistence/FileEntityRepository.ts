import type { BaseEntity } from '../../domain/entity/BaseEntity.js';
import type { IEntityRepository, SaveOptions, FindOptions } from '../../domain/repository/IEntityRepository.js';
import type { ListResult, EntityMetadata, JsonValue } from '../../shared/types/common.js';
import {
  NotFoundError,
  PayloadTooLargeError
} from '../../shared/errors/index.js';
import type { AppConfig } from '../../config/environment.js';
import { LocalJsonStore } from './LocalJsonStore.js';

export class FileEntityRepository<T extends BaseEntity> implements IEntityRepository<T> {
  constructor(
    private readonly store: LocalJsonStore,
    private readonly config: AppConfig,
    private readonly entityFactory: (name: string, data: JsonValue, etag?: string, metadata?: EntityMetadata) => T
  ) {}

  async findAll(prefix: string = '', limit: number = 100, cursor?: string): Promise<ListResult<T>> {
    const prefixes = [
      `${this.config.s3.prefix}${prefix}`,
      `${this.config.s3.prefix}users/${prefix}`,
      `${this.config.s3.prefix}games/${prefix}`
    ];

    const items: T[] = [];
    for (const searchPrefix of prefixes) {
      const listed = await this.store.list(searchPrefix);
      for (const obj of listed.keys) {
        const id = this.extractIdFromKey(obj.key);
        if (!id) {
          continue;
        }
        const metadata: EntityMetadata = {
          etag: obj.etag,
          size: obj.size,
          lastModified: obj.lastModified
        };
        items.push(this.entityFactory(id, {}, metadata.etag, metadata));
      }
    }

    const uniqueItems = new Map<string, T>();
    for (const item of items) {
      if (!uniqueItems.has(item.id)) {
        uniqueItems.set(item.id, item);
      }
    }

    const deduplicatedItems = Array.from(uniqueItems.values());
    deduplicatedItems.sort((a, b) => a.id.localeCompare(b.id));

    const start = decodeCursor(cursor);
    const page = deduplicatedItems.slice(start, start + limit);
    const nextOffset = start + page.length;
    const nextCursor = nextOffset < deduplicatedItems.length
      ? Buffer.from(String(nextOffset), 'utf8').toString('base64url')
      : undefined;

    return { items: page, nextCursor };
  }

  async findByName(id: string, opts?: FindOptions): Promise<T | null> {
    const keys = [
      this.keyFor(id),
      `${this.config.s3.prefix}users/${encodeURIComponent(id)}.json`,
      `${this.config.s3.prefix}games/${encodeURIComponent(id)}.json`
    ];

    for (const key of keys) {
      const stored = await this.store.get(key, opts?.ifNoneMatch);
      if (!stored) {
        continue;
      }
      const metadata: EntityMetadata = {
        etag: stored.etag,
        size: stored.size,
        lastModified: stored.lastModified
      };
      return this.entityFactory(id, stored.data as JsonValue, metadata.etag, metadata);
    }

    return null;
  }

  async save(entity: T, opts?: SaveOptions): Promise<T> {
    const body = JSON.stringify(entity.data);
    if (Buffer.byteLength(body, 'utf8') > this.config.s3.maxBodyBytes) {
      throw new PayloadTooLargeError(`Payload size exceeds ${this.config.s3.maxBodyBytes} bytes`);
    }

    const stored = await this.store.put(this.keyFor(entity.id), entity.data, opts);
    return entity.withETag(stored.etag);
  }

  async delete(id: string, opts?: SaveOptions): Promise<void> {
    const key = await this.resolveExistingKey(id);
    await this.store.delete(key, opts?.ifMatch ? { ifMatch: opts.ifMatch } : undefined);
  }

  async getMetadata(id: string): Promise<EntityMetadata> {
    const key = await this.resolveExistingKey(id);
    const meta = await this.store.head(key);
    if (!meta) {
      throw new NotFoundError(`Entity '${id}' not found`);
    }
    return {
      etag: meta.etag,
      size: meta.size,
      lastModified: meta.lastModified
    };
  }

  async exists(id: string): Promise<boolean> {
    try {
      await this.getMetadata(id);
      return true;
    } catch (err) {
      if (err instanceof NotFoundError) {
        return false;
      }
      throw err;
    }
  }

  private async resolveExistingKey(id: string): Promise<string> {
    const keys = [
      this.keyFor(id),
      `${this.config.s3.prefix}users/${encodeURIComponent(id)}.json`,
      `${this.config.s3.prefix}games/${encodeURIComponent(id)}.json`
    ];

    for (const key of keys) {
      const meta = await this.store.head(key);
      if (meta) {
        return key;
      }
    }

    throw new NotFoundError(`Entity '${id}' not found`);
  }

  private keyFor(id: string): string {
    return `${this.config.s3.prefix}${encodeURIComponent(id)}.json`;
  }

  private extractIdFromKey(key: string): string | null {
    const basePrefix = this.config.s3.prefix;
    const userPrefix = `${basePrefix}users/`;
    const gamePrefix = `${basePrefix}games/`;

    let idWithExt: string;
    if (key.startsWith(userPrefix)) {
      idWithExt = key.slice(userPrefix.length);
    } else if (key.startsWith(gamePrefix)) {
      idWithExt = key.slice(gamePrefix.length);
    } else if (key.startsWith(basePrefix)) {
      idWithExt = key.slice(basePrefix.length);
    } else {
      return null;
    }

    if (!idWithExt.endsWith('.json') || idWithExt.includes('/')) {
      return null;
    }

    const encoded = idWithExt.slice(0, -5);
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }
}

function decodeCursor(cursor?: string): number {
  if (!cursor) {
    return 0;
  }
  const parsed = Number.parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
