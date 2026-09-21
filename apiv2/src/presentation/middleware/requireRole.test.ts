import { describe, it, expect, beforeEach } from 'vitest';
import { HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';
import { requireRole } from './requireRole.js';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors/index.js';
import type { AuthenticatedRequest } from './auth.js';

function request(role?: string): AuthenticatedRequest {
  return {
    requestId: 'req-1',
    method: 'GET',
    path: '/apiv2/internal/cognito-users',
    params: {},
    headers: {},
    query: {},
    user: role
      ? { userId: 'u1', sub: 'u1', email: 'a@b.c', role, display_name: 'A', groups: [role] }
      : undefined
  };
}

describe('requireRole', () => {
  const next = async () => HttpResponse.ok({ ok: true });

  it('allows admin on admin-only routes', async () => {
    const response = await requireRole('admin')(request('admin') as HttpRequest, next);
    expect(response.statusCode).toBe(200);
  });

  it('returns 403 for authenticated non-admin', async () => {
    await expect(requireRole('admin')(request('user') as HttpRequest, next))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it('returns 401 when unauthenticated', async () => {
    await expect(requireRole('admin')(request() as HttpRequest, next))
      .rejects.toBeInstanceOf(UnauthorizedError);
  });
});
