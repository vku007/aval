import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogService } from './AuditLogService.js';
import { Logger } from '../../shared/logging/Logger.js';
import type { IAuditLogRepository } from '../dto/AuditLogDto.js';

describe('AuditLogService', () => {
  let repository: IAuditLogRepository;
  let service: AuditLogService;

  beforeEach(() => {
    repository = {
      append: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined })
    };
    service = new AuditLogService(repository, new Logger());
  });

  it('appends an entry with generated id and timestamp', async () => {
    const entry = await service.append({
      actorSub: 'admin-sub',
      actorEmail: 'admin@test',
      action: 'create',
      targetUsername: 'ada@test',
      targetSub: 'sub-ada',
      details: { group: 'user' }
    });

    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBeTruthy();
    expect(entry.action).toBe('create');
    expect(repository.append).toHaveBeenCalledWith(entry);
  });

  it('caps list limit at 200', async () => {
    await service.list({ limit: 999, targetSub: 'sub-ada' });
    expect(repository.list).toHaveBeenCalledWith({ targetSub: 'sub-ada', limit: 200 });
  });
});
