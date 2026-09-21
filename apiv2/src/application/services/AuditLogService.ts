import { randomUUID } from 'node:crypto';
import type { Logger } from '../../shared/logging/Logger.js';
import type { AuditAction, AuditLogEntry, IAuditLogRepository } from '../dto/AuditLogDto.js';

export class AuditLogService {
  constructor(
    private readonly repository: IAuditLogRepository,
    private readonly logger: Logger
  ) {}

  async append(params: {
    actorSub: string;
    actorEmail: string;
    action: AuditAction;
    targetUsername: string;
    targetSub: string;
    details?: Record<string, unknown>;
  }): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      actorSub: params.actorSub,
      actorEmail: params.actorEmail,
      action: params.action,
      targetUsername: params.targetUsername,
      targetSub: params.targetSub,
      details: params.details ?? {}
    };
    await this.repository.append(entry);
    this.logger.info('Audit log appended', {
      action: entry.action,
      targetSub: entry.targetSub,
      actorSub: entry.actorSub
    });
    return entry;
  }

  async list(opts: { targetSub?: string; limit?: number; cursor?: string }) {
    const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 200) : 50;
    return this.repository.list({ ...opts, limit });
  }
}
