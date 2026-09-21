import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CognitoUserAdminController } from './CognitoUserAdminController.js';
import { CognitoUserAdminService } from '../../application/services/CognitoUserAdminService.js';
import { AuditLogService } from '../../application/services/AuditLogService.js';
import { Logger } from '../../shared/logging/Logger.js';
import { ValidationError } from '../../shared/errors/index.js';
import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';

function request(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    requestId: 'req-1',
    method: 'GET',
    path: '/apiv2/internal/cognito-users',
    params: {},
    headers: { 'content-type': 'application/json' },
    query: {},
    body: {},
    user: { userId: 'admin-sub', email: 'admin@test', role: 'admin', groups: ['admin'] },
    ...overrides
  };
}

describe('CognitoUserAdminController', () => {
  let service: CognitoUserAdminService;
  let auditLogService: AuditLogService;
  let controller: CognitoUserAdminController;

  beforeEach(() => {
    service = {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsertGameProfile: vi.fn(),
      patchGameProfile: vi.fn(),
      listGames: vi.fn()
    } as any;
    auditLogService = {
      list: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
      append: vi.fn()
    } as any;
    controller = new CognitoUserAdminController(service, auditLogService, new Logger());
  });

  it('lists users', async () => {
    vi.mocked(service.list).mockResolvedValue({ users: [], nextCursor: undefined });
    const response = await controller.list(request({ query: { emailPrefix: 'ada', limit: '10' } }));
    expect(response.statusCode).toBe(200);
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ emailPrefix: 'ada', limit: 10 }));
  });

  it('creates a user with 201', async () => {
    vi.mocked(service.create).mockResolvedValue({
      username: 'ada@vkp-test.local',
      sub: 'sub-ada',
      email: 'ada@vkp-test.local',
      displayName: 'Ada',
      group: 'user',
      enabled: true,
      status: 'CONFIRMED',
      gameProfile: null
    } as any);

    const response = await controller.create(request({
      method: 'POST',
      body: {
        email: 'ada@vkp-test.local',
        password: 'SecurePass12',
        displayName: 'Ada',
        group: 'user',
        createGameProfile: false
      }
    }));

    expect(response.statusCode).toBe(201);
    expect(service.create).toHaveBeenCalled();
  });

  it('rejects a weak password', async () => {
    await expect(controller.create(request({
      method: 'POST',
      body: {
        email: 'ada@vkp-test.local',
        password: 'short',
        displayName: 'Ada',
        group: 'user'
      }
    }))).rejects.toThrow(ValidationError);
  });

  it('deletes with 204', async () => {
    vi.mocked(service.delete).mockResolvedValue();
    const response = await controller.delete(request({
      method: 'DELETE',
      path: '/apiv2/internal/cognito-users/ada@vkp-test.local',
      params: { username: 'ada@vkp-test.local' }
    }));
    expect(response.statusCode).toBe(204);
  });

  it('lists audit logs', async () => {
    const response = await controller.listAuditLogs(request({
      path: '/apiv2/internal/audit-logs',
      query: { targetSub: 'sub-ada', limit: '20' }
    }));
    expect(response.statusCode).toBe(200);
    expect(auditLogService.list).toHaveBeenCalledWith(expect.objectContaining({ targetSub: 'sub-ada' }));
  });
});
