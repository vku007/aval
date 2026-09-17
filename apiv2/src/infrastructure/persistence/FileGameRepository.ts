import { GameEntity } from '../../domain/entity/GameEntity.js';
import { JsonEntity } from '../../domain/entity/JsonEntity.js';
import { Round } from '../../domain/value-object/Round.js';
import type { EntityMetadata } from '../../shared/types/common.js';
import { IGameRepository } from '../../application/services/GameService.js';
import { NotFoundError } from '../../shared/errors/index.js';
import type { AppConfig } from '../../config/environment.js';
import { LocalJsonStore } from './LocalJsonStore.js';

export class FileGameRepository implements IGameRepository {
  private readonly gamePrefix: string;

  constructor(
    private readonly store: LocalJsonStore,
    private readonly config: AppConfig,
    private readonly gameFactory: (id: string, usersIds: string[], rounds: Round[], isFinished: boolean, etag?: string, metadata?: EntityMetadata) => GameEntity
  ) {
    this.gamePrefix = `${config.s3.prefix}games/`;
  }

  async findById(id: string, ifNoneMatch?: string): Promise<GameEntity | null> {
    const stored = await this.store.get(this.keyFor(id), ifNoneMatch);
    if (!stored) {
      return null;
    }

    const data = stored.data as Record<string, unknown>;
    const metadata: EntityMetadata = {
      etag: stored.etag,
      size: stored.size,
      lastModified: stored.lastModified
    };

    const gameEntity = GameEntity.fromJSON({ ...data, id });
    const backingStore = gameEntity.internalGetBackingStore();
    const backedWithMetadata = new JsonEntity(backingStore.id, backingStore.data, stored.etag, metadata);
    return gameEntity.internalCreateFromBackingStore(backedWithMetadata);
  }

  async save(game: GameEntity, opts?: { ifMatch?: string; ifNoneMatch?: string }): Promise<GameEntity> {
    const gameData = game.internalGetBackingStore().data as Record<string, unknown>;
    const stored = await this.store.put(this.keyFor(game.id), gameData, opts);
    const metadata: EntityMetadata = {
      etag: stored.etag,
      size: stored.size,
      lastModified: stored.lastModified
    };

    return this.gameFactory(
      game.id,
      game.usersIds,
      game.rounds,
      game.isFinished,
      stored.etag,
      metadata
    );
  }

  async delete(id: string, opts?: { ifMatch?: string }): Promise<void> {
    await this.store.delete(this.keyFor(id), opts);
  }

  async findAll(prefix?: string, limit?: number, cursor?: string): Promise<{ items: GameEntity[]; nextCursor?: string }> {
    const searchPrefix = prefix ? `${this.gamePrefix}${prefix}` : this.gamePrefix;
    const listed = await this.store.list(searchPrefix, limit, cursor);
    const items: GameEntity[] = [];

    for (const obj of listed.keys) {
      const game = await this.findById(this.idFromKey(obj.key));
      if (game) {
        items.push(game);
      }
    }

    return { items, nextCursor: listed.nextCursor };
  }

  async getMetadata(id: string): Promise<EntityMetadata> {
    const meta = await this.store.head(this.keyFor(id));
    if (!meta) {
      throw new NotFoundError(`Game '${id}' not found`);
    }
    return {
      etag: meta.etag,
      size: meta.size,
      lastModified: meta.lastModified
    };
  }

  private keyFor(id: string): string {
    return `${this.gamePrefix}${id}.json`;
  }

  private idFromKey(key: string): string {
    const filename = key.replace(this.gamePrefix, '');
    return filename.replace(/\.json$/, '');
  }
}
