import { User } from '../../domain/entity/User.js';
import type { EntityMetadata } from '../../shared/types/common.js';
import { IUserRepository } from '../../application/services/UserService.js';
import { NotFoundError } from '../../shared/errors/index.js';
import type { AppConfig } from '../../config/environment.js';
import { LocalJsonStore } from './LocalJsonStore.js';

export class FileUserRepository implements IUserRepository {
  private readonly userPrefix: string;

  constructor(
    private readonly store: LocalJsonStore,
    private readonly config: AppConfig,
    private readonly userFactory: (id: string, name: string, externalId: number, etag?: string, metadata?: EntityMetadata) => User
  ) {
    this.userPrefix = `${config.s3.prefix}users/`;
  }

  async findById(id: string, ifNoneMatch?: string): Promise<User | null> {
    const stored = await this.store.get(this.keyFor(id), ifNoneMatch);
    if (!stored) {
      return null;
    }

    const data = stored.data as { name: string; externalId: number };
    const metadata: EntityMetadata = {
      etag: stored.etag,
      size: stored.size,
      lastModified: stored.lastModified
    };

    return this.userFactory(id, data.name, data.externalId, stored.etag, metadata);
  }

  async save(user: User, opts?: { ifMatch?: string; ifNoneMatch?: string }): Promise<User> {
    const backingStore = user.internalGetBackingStore();
    const userData = backingStore.data as { name: string; externalId: number };
    const stored = await this.store.put(this.keyFor(user.id), userData, opts);
    const metadata: EntityMetadata = {
      etag: stored.etag,
      size: stored.size,
      lastModified: stored.lastModified
    };

    return this.userFactory(user.id, userData.name, userData.externalId, stored.etag, metadata);
  }

  async delete(id: string, opts?: { ifMatch?: string }): Promise<void> {
    await this.store.delete(this.keyFor(id), opts);
  }

  async findAll(prefix: string = '', limit: number = 100, cursor?: string): Promise<{ items: User[]; nextCursor?: string }> {
    const listed = await this.store.list(this.userPrefix + prefix, limit, cursor);
    const items: User[] = [];

    for (const obj of listed.keys) {
      const id = this.extractIdFromKey(obj.key);
      if (!id) {
        continue;
      }
      items.push(this.userFactory(id, 'Loading...', 1, undefined, {
        etag: undefined,
        size: obj.size,
        lastModified: obj.lastModified
      }));
    }

    return { items, nextCursor: listed.nextCursor };
  }

  async getMetadata(id: string): Promise<{ etag?: string; size?: number; lastModified?: string }> {
    const meta = await this.store.head(this.keyFor(id));
    if (!meta) {
      throw new NotFoundError(`User '${id}' not found`);
    }
    return {
      etag: meta.etag,
      size: meta.size,
      lastModified: meta.lastModified
    };
  }

  private keyFor(id: string): string {
    return `${this.userPrefix}${encodeURIComponent(id)}.json`;
  }

  private extractIdFromKey(key: string): string | null {
    if (!key.startsWith(this.userPrefix)) {
      return null;
    }

    const idWithExt = key.slice(this.userPrefix.length);
    if (!idWithExt.endsWith('.json')) {
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
