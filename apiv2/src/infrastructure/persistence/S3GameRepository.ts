import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { GameEntity } from '../../domain/entity/GameEntity.js';
import { Round } from '../../domain/entity/Round.js';
import { Move } from '../../domain/entity/Move.js';
import type { EntityMetadata } from '../../shared/types/common.js';
import { IGameRepository } from '../../application/services/GameService.js';
import { NotFoundError, ConflictError, PreconditionFailedError, NotModifiedError } from '../../shared/errors/index.js';
import type { AppConfig } from '../../config/environment.js';

export class S3GameRepository implements IGameRepository {
  private readonly gamePrefix: string;

  constructor(
    private readonly s3Client: S3Client,
    private readonly config: AppConfig,
    private readonly gameFactory: (id: string, type: string, usersIds: string[], rounds: Round[], isFinished: boolean, etag?: string, metadata?: EntityMetadata) => GameEntity
  ) {
    this.gamePrefix = `${config.s3.prefix}games/`;
  }

  async findById(id: string, ifNoneMatch?: string): Promise<GameEntity | null> {
    const key = this.keyFor(id);
    
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new NotFoundError(`Game '${id}' not found`);
      }

      // Check If-None-Match condition
      if (ifNoneMatch && response.ETag === ifNoneMatch) {
        throw new NotModifiedError(`Game '${id}' not modified`);
      }

      // Read the body
      const body = await this.streamToBuffer(response.Body);
      const data = JSON.parse(body.toString()) as { type: string; usersIds: string[]; rounds: any[]; isFinished: boolean };

      // Create metadata
      const metadata: EntityMetadata = {
        etag: response.ETag,
        size: response.ContentLength,
        lastModified: response.LastModified?.toISOString()
      };

      // Convert rounds data to Round objects
      const rounds = data.rounds.map(roundData => {
        const moves = roundData.moves.map((moveData: { id: string; userId: string; value: number; valueDecorated: string }) => 
          new Move(moveData.id, moveData.userId, moveData.value, moveData.valueDecorated)
        );
        return new Round(roundData.id, moves, roundData.isFinished);
      });

      return this.gameFactory(id, data.type, data.usersIds, rounds, data.isFinished, response.ETag, metadata);
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  async save(game: GameEntity, opts?: { ifMatch?: string; ifNoneMatch?: string }): Promise<GameEntity> {
    const key = this.keyFor(game.id);
    const gameData = game.internalGetBackingStore().data as any;

    const command = new PutObjectCommand({
      Bucket: this.config.s3.bucket,
      Key: key,
      Body: JSON.stringify(gameData),
      ContentType: 'application/json',
      ...(opts?.ifMatch && { IfMatch: opts.ifMatch }),
      ...(opts?.ifNoneMatch && { IfNoneMatch: opts.ifNoneMatch })
    });

    try {
      const response = await this.s3Client.send(command);
      
      // Create new metadata with updated ETag
      const metadata: EntityMetadata = {
        etag: response.ETag,
        size: JSON.stringify(gameData).length,
        lastModified: new Date().toISOString()
      };

      // Return new game entity with updated metadata
      return this.gameFactory(
        game.id,
        game.type,
        game.usersIds,
        game.rounds,
        game.isFinished,
        response.ETag,
        metadata
      );
    } catch (error: any) {
      if (error.name === 'PreconditionFailed') {
        throw new PreconditionFailedError(`Game '${game.id}' precondition failed`);
      }
      if (error.name === 'Conflict') {
        throw new ConflictError(`Game '${game.id}' already exists`);
      }
      throw error;
    }
  }

  async delete(id: string, opts?: { ifMatch?: string }): Promise<void> {
    const key = this.keyFor(id);

    const command = new DeleteObjectCommand({
      Bucket: this.config.s3.bucket,
      Key: key,
      ...(opts?.ifMatch && { IfMatch: opts.ifMatch })
    });

    try {
      await this.s3Client.send(command);
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        throw new NotFoundError(`Game '${id}' not found`);
      }
      if (error.name === 'PreconditionFailed') {
        throw new PreconditionFailedError(`Game '${id}' precondition failed`);
      }
      throw error;
    }
  }

  async findAll(prefix?: string, limit?: number, cursor?: string): Promise<{ items: GameEntity[]; nextCursor?: string }> {
    const searchPrefix = prefix ? `${this.gamePrefix}${prefix}` : this.gamePrefix;

    const command = new ListObjectsV2Command({
      Bucket: this.config.s3.bucket,
      Prefix: searchPrefix,
      MaxKeys: limit,
      ContinuationToken: cursor ? Buffer.from(cursor, 'base64url').toString('utf8') : undefined
    });

    try {
      const response = await this.s3Client.send(command);
      
      if (!response.Contents || response.Contents.length === 0) {
        return { items: [] };
      }

      // Load each game entity
      const games: GameEntity[] = [];
      for (const object of response.Contents) {
        if (object.Key) {
          const gameId = this.idFromKey(object.Key);
          const game = await this.findById(gameId);
          if (game) {
            games.push(game);
          }
        }
      }

      const nextCursor = response.NextContinuationToken
        ? Buffer.from(response.NextContinuationToken, 'utf8').toString('base64url')
        : undefined;

      return { items: games, nextCursor };
    } catch (error: any) {
      throw error;
    }
  }

  async getMetadata(id: string): Promise<EntityMetadata> {
    const key = this.keyFor(id);

    const command = new HeadObjectCommand({
      Bucket: this.config.s3.bucket,
      Key: key
    });

    try {
      const response = await this.s3Client.send(command);
      
      return {
        etag: response.ETag,
        size: response.ContentLength,
        lastModified: response.LastModified?.toISOString()
      };
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        throw new NotFoundError(`Game '${id}' not found`);
      }
      throw error;
    }
  }

  private keyFor(id: string): string {
    return `${this.gamePrefix}${id}.json`;
  }

  private idFromKey(key: string): string {
    const filename = key.replace(this.gamePrefix, '');
    return filename.replace('.json', '');
  }

  private async streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}
