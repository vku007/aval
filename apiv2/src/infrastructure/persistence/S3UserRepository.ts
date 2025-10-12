import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { User } from '../../domain/entity/User.js';
import { JsonEntity } from '../../domain/entity/JsonEntity.js';
import type { JsonValue, EntityMetadata } from '../../shared/types/common.js';
import { IUserRepository } from '../../application/services/UserService.js';
import { NotFoundError, ConflictError, PreconditionFailedError, NotModifiedError } from '../../shared/errors/index.js';
import type { AppConfig } from '../../config/environment.js';

export class S3UserRepository implements IUserRepository {
  private readonly userPrefix: string;

  constructor(
    private readonly s3Client: S3Client,
    private readonly config: AppConfig,
    private readonly userFactory: (id: string, name: string, externalId: number, etag?: string, metadata?: EntityMetadata) => User
  ) {
    this.userPrefix = `${config.s3.prefix}users/`;
  }

  async findById(id: string, ifNoneMatch?: string): Promise<User | null> {
    const key = this.keyFor(id);
    
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new NotFoundError(`User '${id}' not found`);
      }

      // Check If-None-Match condition
      if (ifNoneMatch && response.ETag === ifNoneMatch) {
        throw new NotModifiedError(`User '${id}' not modified`);
      }

      // Read the body
      const body = await this.streamToBuffer(response.Body);
      const data = JSON.parse(body.toString()) as { name: string; externalId: number };

      // Create metadata
      const metadata: EntityMetadata = {
        etag: response.ETag,
        size: response.ContentLength,
        lastModified: response.LastModified?.toISOString()
      };

      // Create User using the factory
      return this.userFactory(id, data.name, data.externalId, response.ETag, metadata);
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        return null;
      }
      if (error instanceof NotModifiedError) {
        throw error;
      }
      throw new NotFoundError(`User '${id}' not found`);
    }
  }

  async save(user: User, opts?: { ifMatch?: string; ifNoneMatch?: string }): Promise<User> {
    const id = user.id;
    const key = this.keyFor(id);
    
    // Check preconditions
    await this.checkPreconditions(id, opts);

    // Get backing store data
    const backingStore = user.internalGetBackingStore();
    const userData = backingStore.data as { name: string; externalId: number };

    try {
      const command = new PutObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: key,
        Body: JSON.stringify(userData),
        ContentType: 'application/json'
      });

      const response = await this.s3Client.send(command);
      
      // Create new User with updated ETag
      const newMetadata: EntityMetadata = {
        etag: response.ETag,
        size: JSON.stringify(userData).length,
        lastModified: new Date().toISOString()
      };

      return this.userFactory(id, userData.name, userData.externalId, response.ETag, newMetadata);
    } catch (error: any) {
      if (error.name === 'PreconditionFailed') {
        throw new PreconditionFailedError(`User '${id}' precondition failed`);
      }
      throw error;
    }
  }

  async delete(id: string, opts?: { ifMatch?: string }): Promise<void> {
    const key = this.keyFor(id);

    // Check if user exists and ETag matches if provided
    if (opts?.ifMatch) {
      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError(`User '${id}' not found`);
      }
      if (existing.metadata?.etag !== opts.ifMatch) {
        throw new PreconditionFailedError(`User '${id}' ETag mismatch`);
      }
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: key
      });

      await this.s3Client.send(command);
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        throw new NotFoundError(`User '${id}' not found`);
      }
      throw error;
    }
  }

  async findAll(prefix: string = '', limit: number = 100, cursor?: string): Promise<{ items: User[]; nextCursor?: string }> {
    try {
      const searchPrefix = this.userPrefix + prefix;
      
      const command = new ListObjectsV2Command({
        Bucket: this.config.s3.bucket,
        Prefix: searchPrefix,
        MaxKeys: limit,
        ContinuationToken: cursor
      });

      const response = await this.s3Client.send(command);
      const items: User[] = [];

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (!obj.Key) continue;
          
          const id = this.extractIdFromKey(obj.Key);
          if (!id) continue;

          try {
            // For listing, we only need the ID, so create a minimal user object
            // We'll fetch the full data when needed via findById
            const user = this.userFactory(id, 'Loading...', 1, undefined, {
              etag: undefined,
              size: obj.Size,
              lastModified: obj.LastModified?.toISOString()
            });
            items.push(user);
          } catch (error) {
            // Skip users that can't be loaded
            continue;
          }
        }
      }

      return {
        items,
        nextCursor: response.NextContinuationToken
      };
    } catch (error: any) {
      return { items: [], nextCursor: undefined };
    }
  }

  async getMetadata(id: string): Promise<{ etag?: string; size?: number; lastModified?: string }> {
    const key = this.keyFor(id);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      return {
        etag: response.ETag,
        size: response.ContentLength,
        lastModified: response.LastModified?.toISOString()
      };
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        throw new NotFoundError(`User '${id}' not found`);
      }
      throw error;
    }
  }

  private async checkPreconditions(id: string, opts?: { ifMatch?: string; ifNoneMatch?: string }): Promise<void> {
    if (!opts?.ifMatch && !opts?.ifNoneMatch) {
      return;
    }

    const existing = await this.findById(id);
    
    if (opts.ifMatch) {
      if (!existing) {
        throw new NotFoundError(`User '${id}' not found`);
      }
      if (existing.metadata?.etag !== opts.ifMatch) {
        throw new PreconditionFailedError(`User '${id}' ETag mismatch`);
      }
    }

    if (opts.ifNoneMatch) {
      if (existing && existing.metadata?.etag === opts.ifNoneMatch) {
        throw new NotModifiedError(`User '${id}' not modified`);
      }
      if (existing && opts.ifNoneMatch === '*') {
        throw new ConflictError(`User '${id}' already exists`);
      }
    }
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
    
    const encoded = idWithExt.slice(0, -5); // Remove .json
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded; // Fallback to original if decoding fails
    }
  }

  private async streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
