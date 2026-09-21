import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import type { AppConfig } from '../../config/environment.js';
import type { AuditLogEntry, AuditLogListResult, IAuditLogRepository } from '../../application/dto/AuditLogDto.js';

export class S3AuditLogRepository implements IAuditLogRepository {
  private readonly basePrefix: string;

  constructor(
    private readonly s3Client: S3Client,
    private readonly config: AppConfig
  ) {
    this.basePrefix = `${this.config.s3.prefix}audit-logs/`;
  }

  async append(entry: AuditLogEntry): Promise<void> {
    const key = this.keyFor(entry.targetSub, entry.timestamp, entry.id);
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.config.s3.bucket,
      Key: key,
      Body: JSON.stringify(entry),
      ContentType: 'application/json'
    }));
  }

  async list(opts: { targetSub?: string; limit?: number; cursor?: string }): Promise<AuditLogListResult> {
    const prefix = opts.targetSub
      ? `${this.basePrefix}${encodeURIComponent(opts.targetSub)}/`
      : this.basePrefix;
    const limit = opts.limit && opts.limit > 0 ? opts.limit : 50;
    const continuationToken = opts.cursor
      ? Buffer.from(opts.cursor, 'base64url').toString('utf8')
      : undefined;

    const response = await this.s3Client.send(new ListObjectsV2Command({
      Bucket: this.config.s3.bucket,
      Prefix: prefix,
      MaxKeys: limit,
      ContinuationToken: continuationToken
    }));

    const items: AuditLogEntry[] = [];
    for (const object of response.Contents ?? []) {
      if (!object.Key || !object.Key.endsWith('.json')) {
        continue;
      }
      const entry = await this.getByKey(object.Key);
      if (entry) {
        items.push(entry);
      }
    }

    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return {
      items,
      nextCursor: response.NextContinuationToken
        ? Buffer.from(response.NextContinuationToken, 'utf8').toString('base64url')
        : undefined
    };
  }

  private async getByKey(key: string): Promise<AuditLogEntry | null> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: key
      }));
      if (!response.Body) {
        return null;
      }
      const body = await this.streamToString(response.Body);
      return JSON.parse(body) as AuditLogEntry;
    } catch {
      return null;
    }
  }

  private keyFor(targetSub: string, timestamp: string, id: string): string {
    return `${this.basePrefix}${encodeURIComponent(targetSub)}/${timestamp}-${id}.json`;
  }

  private async streamToString(stream: any): Promise<string> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  }
}
