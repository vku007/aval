import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileGameRepository } from './FileGameRepository.js';
import { LocalJsonStore } from './LocalJsonStore.js';
import { GameEntity } from '../../domain/entity/GameEntity.js';
import { Round } from '../../domain/value-object/Round.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import type { EntityMetadata } from '../../shared/types/common.js';
import type { AppConfig } from '../../config/environment.js';
import { NotFoundError, ConflictError } from '../../shared/errors/index.js';

describe('FileGameRepository', () => {
  let dir: string;
  let repository: FileGameRepository;

  const config: AppConfig = {
    aws: { region: 'eu-north-1' },
    s3: { bucket: '', prefix: 'json/', maxBodyBytes: 1048576 },
    cors: { allowedOrigin: '*' },
    tags: { app: 'test', environment: 'test' }
  };

  const gameFactory = (
    id: string,
    usersIds: string[],
    rounds: Round[],
    isFinished: boolean,
    etag?: string,
    metadata?: EntityMetadata
  ) => {
    const status = isFinished ? GameStatus.Finished : GameStatus.Created;
    return GameEntity.create(id, usersIds, rounds, status, etag, metadata);
  };

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'aval-file-game-'));
    repository = new FileGameRepository(new LocalJsonStore(dir), config, gameFactory);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('persists JSON without id and restores it from the key', async () => {
    const created = await repository.save(
      GameEntity.create('game-1', ['user-1'], [], GameStatus.Created),
      { ifNoneMatch: '*' }
    );

    const onDisk = JSON.parse(await readFile(path.join(dir, 'json/games/game-1.json'), 'utf8'));
    expect(onDisk.id).toBeUndefined();
    expect(onDisk.usersIds).toEqual(['user-1']);

    const loaded = await repository.findById('game-1');
    expect(loaded?.id).toBe('game-1');
    expect(loaded?.usersIds).toEqual(['user-1']);
    expect(loaded?.internalGetBackingStore().etag).toBe(created.internalGetBackingStore().etag);
  });

  it('rejects a second create-only save', async () => {
    const game = GameEntity.create('game-1', ['user-1'], [], GameStatus.Created);
    await repository.save(game, { ifNoneMatch: '*' });
    await expect(repository.save(game, { ifNoneMatch: '*' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws NotFoundError for missing metadata', async () => {
    await expect(repository.getMetadata('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('listIds includes unreadable objects and findAll skips them', async () => {
    await repository.save(
      GameEntity.create('ok-game', ['user-1'], [], GameStatus.Created),
      { ifNoneMatch: '*' }
    );
    await writeFile(
      path.join(dir, 'json/games/legacy.json'),
      JSON.stringify({
        type: 'test',
        usersIds: ['user1', 'user2'],
        rounds: [{
          id: 'round1',
          moves: [{ userId: 'user1', value: 1, valueDecorated: '1 desc' }],
          isFinished: false
        }],
        isFinished: true
      })
    );

    const ids = await repository.listIds();
    expect(ids.names.sort()).toEqual(['legacy', 'ok-game']);

    const loaded = await repository.findAll();
    expect(loaded.items.map((game) => game.id)).toEqual(['ok-game']);
  });
});
