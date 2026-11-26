import { describe, it, expect, vi } from 'vitest';
import { AuthController } from './AuthController.js';
import { Logger } from '../../shared/logging/Logger.js';
import { errorHandler } from '../middleware/errorHandler.js';
import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';

function request(body: unknown): HttpRequest {
  return {
    method: 'POST',
    path: '/apiv2/public/login',
    headers: {},
    query: {},
    params: {},
    body,
    requestId: 'test-request-id'
  };
}

function controller(send: ReturnType<typeof vi.fn>) {
  return new AuthController(new Logger(), {} as any, { send } as any);
}

describe('AuthController.login', () => {
  const handle = errorHandler(new Logger(), '*');

  it('returns 401 problem+json when Cognito rejects the password', async () => {
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('no'), { name: 'NotAuthorizedException' }));
    const auth = controller(send);
    const req = request({ email: 'nobody@example.com', password: 'wrong-password-1' });

    await expect(auth.login(req)).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS'
    });

    try {
      await auth.login(req);
    } catch (error) {
      const response = handle(error as Error, req);
      expect(response.statusCode).toBe(401);
      expect(typeof response.statusCode).toBe('number');
      expect(response.headers['content-type']).toBe('application/problem+json');
      expect(response.body).toMatchObject({
        status: 401,
        detail: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }
  });

  it('returns 401 when the user does not exist', async () => {
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('missing'), { name: 'UserNotFoundException' }));
    const req = request({ email: 'nobody@example.com', password: 'wrong-password-1' });

    await expect(controller(send).login(req)).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS'
    });
  });

  it('returns 400 when the password is missing', async () => {
    const send = vi.fn();
    const req = request({ email: 'nobody@example.com' });

    try {
      await controller(send).login(req);
      throw new Error('login should have thrown');
    } catch (error) {
      const response = handle(error as Error, req);
      expect(response.statusCode).toBe(400);
      expect(typeof response.statusCode).toBe('number');
      expect(response.headers['content-type']).toBe('application/problem+json');
      expect(send).not.toHaveBeenCalled();
    }
  });
});
