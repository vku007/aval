import type { AuditLogEntry, AuditLogListResult, IAuditLogRepository } from '../../application/dto/AuditLogDto.js';
import type { AppConfig } from '../../config/environment.js';
import { LocalJsonStore } from './LocalJsonStore.js';

export class FileAuditLogRepository implements IAuditLogRepository {
  private readonly basePrefix: string;

  constructor(
    private readonly store: LocalJsonStore,
    private readonly config: AppConfig
  ) {
    this.basePrefix = `${this.config.s3.prefix}audit-logs/`;
  }

  async append(entry: AuditLogEntry): Promise<void> {
    const key = this.keyFor(entry.targetSub, entry.timestamp, entry.id);
    await this.store.put(key, entry);
  }

  async list(opts: { targetSub?: string; limit?: number; cursor?: string }): Promise<AuditLogListResult> {
    const prefix = opts.targetSub
      ? `${this.basePrefix}${encodeURIComponent(opts.targetSub)}/`
      : this.basePrefix;
    const limit = opts.limit && opts.limit > 0 ? opts.limit : 50;
    const listed = await this.store.list(prefix, limit, opts.cursor);
    const items: AuditLogEntry[] = [];

    for (const meta of listed.keys) {
      const stored = await this.store.get(meta.key);
      if (stored?.data && typeof stored.data === 'object') {
        items.push(stored.data as AuditLogEntry);
      }
    }

    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return { items, nextCursor: listed.nextCursor };
  }

  private keyFor(targetSub: string, timestamp: string, id: string): string {
    return `${this.basePrefix}${encodeURIComponent(targetSub)}/${timestamp}-${id}.json`;
  }
}
