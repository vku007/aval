import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound
} from '@aws-sdk/client-s3';
import type { BaseEntity } from '../../domain/entity/BaseEntity.js';
import type { IEntityRepository, SaveOptions, FindOptions } from '../../domain/repository/IEntityRepository.js';
import type { ListResult, EntityMetadata, JsonValue } from '../../shared/types/common.js';
import {
  NotFoundError,
  ConflictError,
  PreconditionFailedError,
  PayloadTooLargeError,
  NotModifiedError
} from '../../shared/errors/index.js';
import type { AppConfig } from '../../config/environment.js';

/**
 * S3 implementation of IEntityRepository
 * Stores entities as JSON files in S3
 */
export class S3EntityRepository<T extends BaseEntity> implements IEntityRepository<T> {
  constructor(
    private readonly s3Client: S3Client,
    private readonly config: AppConfig,
    private readonly entityFactory: (name: string, data: JsonValue, etag?: string, metadata?: EntityMetadata) => T
  ) {}

  async findAll(prefix: string = '', limit: number = 100, cursor?: string): Promise<ListResult<T>> {
    const token = cursor ? Buffer.from(cursor, 'base64url').toString('utf8') : undefined;

    const response = await this.s3Client.send(
      new ListObjectsV2Command({
        Bucket: this.config.s3.bucket,
        Prefix: `${this.config.s3.prefix}${prefix}`,
        MaxKeys: limit,
        ContinuationToken: token
      })
    );

    const items: T[] = [];
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (!obj.Key) continue;
        
        const id = this.extractIdFromKey(obj.Key);
        if (!id) continue;

        const metadata: EntityMetadata = {
          etag: obj.ETag?.replace(/"/g, ''),
          size: obj.Size,
          lastModified: obj.LastModified?.toISOString()
        };

        // For list, we don't load full data - just create entity with empty data
        const entity = this.entityFactory(id, {}, metadata.etag, metadata);
        items.push(entity);
      }
    }

    const nextCursor = response.IsTruncated && response.NextContinuationToken
      ? Buffer.from(response.NextContinuationToken, 'utf8').toString('base64url')
      : undefined;

    return { items, nextCursor };
  }

  async findByName(id: string, opts?: FindOptions): Promise<T | null> {
    const key = this.keyFor(id);

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.config.s3.bucket,
          Key: key,
          IfNoneMatch: opts?.ifNoneMatch
        })
      );

      if (!response.Body) {
        return this.entityFactory(id, {}, response.ETag?.replace(/"/g, ''));
      }

      const data = await this.streamToJson(response.Body);
      const metadata: EntityMetadata = {
        etag: response.ETag?.replace(/"/g, ''),
        size: response.ContentLength,
        lastModified: response.LastModified?.toISOString()
      };

      return this.entityFactory(id, data, metadata.etag, metadata);
    } catch (err: any) {
      // S3 returns 304 via exception in SDK v3
      if (err.$metadata?.httpStatusCode === 304) {
        throw new NotModifiedError(opts?.ifNoneMatch);
      }
      
      if (err instanceof NotFound || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      
      throw err;
    }
  }

  async save(entity: T, opts?: SaveOptions): Promise<T> {
    const key = this.keyFor(entity.id);

    // Validate payload size
    const body = JSON.stringify(entity.data);
    if (Buffer.byteLength(body, 'utf8') > this.config.s3.maxBodyBytes) {
      throw new PayloadTooLargeError(`Payload size exceeds ${this.config.s3.maxBodyBytes} bytes`);
    }

    // Check preconditions (best-effort since S3 doesn't support atomic If-Match)
    if (opts?.ifMatch || opts?.ifNoneMatch) {
      await this.checkPreconditions(entity.id, opts);
    }

    // Save to S3
    const response = await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: key,
        Body: body,
        ContentType: 'application/json',
        ServerSideEncryption: 'AES256',
        Tagging: `app=${encodeURIComponent(this.config.tags.app)}&env=${encodeURIComponent(this.config.tags.environment)}`
      })
    );

    const newEtag = response.ETag?.replace(/"/g, '');
    return entity.withETag(newEtag || '');
  }

  async delete(id: string, opts?: SaveOptions): Promise<void> {
    // Check if exists and validate preconditions
    if (opts?.ifMatch) {
      const current = await this.getMetadata(id); // Throws NotFoundError if not exists
      
      if (opts.ifMatch.replace(/"/g, '') !== current.etag?.replace(/"/g, '')) {
        throw new PreconditionFailedError(`ETag mismatch: expected ${opts.ifMatch}, got ${current.etag}`);
      }
    } else {
      // Verify exists (S3 delete succeeds even if file doesn't exist)
      const exists = await this.exists(id);
      if (!exists) {
        throw new NotFoundError(`Entity '${id}' not found`);
      }
    }

    const key = this.keyFor(id);
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: key
      })
    );
  }

  async getMetadata(id: string): Promise<EntityMetadata> {
    const key = this.keyFor(id);

    try {
      const response = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.config.s3.bucket,
          Key: key
        })
      );

      return {
        etag: response.ETag?.replace(/"/g, ''),
        size: response.ContentLength,
        lastModified: response.LastModified?.toISOString()
      };
    } catch (err: any) {
      if (err instanceof NotFound || err.$metadata?.httpStatusCode === 404) {
        throw new NotFoundError(`Entity '${id}' not found`);
      }
      throw err;
    }
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

  /**
   * Check preconditions before save operation
   */
  private async checkPreconditions(id: string, opts: SaveOptions): Promise<void> {
    let currentEtag: string | undefined;

    try {
      const metadata = await this.getMetadata(id);
      currentEtag = metadata.etag;
    } catch (err) {
      if (!(err instanceof NotFoundError)) {
        throw err;
      }
      // Entity doesn't exist, currentEtag remains undefined
    }

    // If-None-Match: * (create only)
    if (opts.ifNoneMatch === '*' && currentEtag) {
      throw new ConflictError(`Entity '${id}' already exists`);
    }

    // If-Match: etag (update only if matches)
    if (opts.ifMatch) {
      if (!currentEtag) {
        throw new NotFoundError(`Entity '${id}' not found`);
      }
      if (opts.ifMatch.replace(/"/g, '') !== currentEtag.replace(/"/g, '')) {
        throw new PreconditionFailedError(`ETag mismatch: expected ${opts.ifMatch}, got ${currentEtag}`);
      }
    }
  }

  /**
   * Convert S3 stream to JSON
   */
  private async streamToJson(stream: any): Promise<JsonValue> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return text ? JSON.parse(text) : {};
  }

  /**
   * Generate S3 key from entity id
   */
  private keyFor(id: string): string {
    return `${this.config.s3.prefix}${encodeURIComponent(id)}.json`;
  }

  /**
   * Extract entity id from S3 key
   */
  private extractIdFromKey(key: string): string | null {
    if (!key.startsWith(this.config.s3.prefix)) {
      return null;
    }

    const idWithExt = key.slice(this.config.s3.prefix.length);
    if (!idWithExt.endsWith('.json')) {
      return null;
    }

    const encoded = idWithExt.slice(0, -5); // Remove .json
    try {
      return decodeURIComponent(encoded);
    } catch {
      return null;
    }
  }
}

