import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, it, expect, vi } from 'vitest';
import { NodeHttpAdapter } from './NodeHttpAdapter.js';
import { HttpResponse } from './HttpTypes.js';

function mockReq(method: string, url: string, headers: Record<string, string | string[] | undefined>, body?: string): IncomingMessage {
  const req = Readable.from([body ?? '']) as unknown as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

describe('NodeHttpAdapter', () => {
  describe('toRequest', () => {
    it('lowercases headers, parses JSON body, and extracts query', async () => {
      const req = mockReq(
        'POST',
        '/apiv2/internal/games?limit=10',
        { 'Content-Type': 'application/json', 'X-Request-Id': 'req-1' },
        '{"name":"g1"}'
      );

      const request = await NodeHttpAdapter.toRequest(req);

      expect(request.method).toBe('POST');
      expect(request.path).toBe('/apiv2/internal/games');
      expect(request.headers['content-type']).toBe('application/json');
      expect(request.headers['x-request-id']).toBe('req-1');
      expect(request.query.limit).toBe('10');
      expect(request.body).toEqual({ name: 'g1' });
      expect(request.requestId).toBe('req-1');
      expect(request.params).toEqual({});
    });

    it('keeps invalid JSON as a raw string', async () => {
      const req = mockReq('POST', '/apiv2/internal/files', { 'content-type': 'application/json' }, '{not json');
      const request = await NodeHttpAdapter.toRequest(req);
      expect(request.body).toBe('{not json');
    });

    it('omits body when empty', async () => {
      const req = mockReq('GET', '/apiv2/internal/games', {});
      const request = await NodeHttpAdapter.toRequest(req);
      expect(request.body).toBeUndefined();
      expect(request.requestId).toBeTruthy();
    });
  });

  describe('writeResponse', () => {
    it('writes JSON, CORS, and etag headers', () => {
      const writeHead = vi.fn();
      const end = vi.fn();
      const res = { writeHead, end } as unknown as ServerResponse;
      const response = HttpResponse.ok({ id: 'g1' }).withETag('abc123');

      NodeHttpAdapter.writeResponse(res, response, '*');

      expect(writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-expose-headers': 'etag,location',
        etag: '"abc123"'
      }));
      expect(end).toHaveBeenCalledWith(JSON.stringify({ id: 'g1' }));
    });

    it('omits body for 204', () => {
      const writeHead = vi.fn();
      const end = vi.fn();
      const res = { writeHead, end } as unknown as ServerResponse;

      NodeHttpAdapter.writeResponse(res, HttpResponse.noContent(), 'https://vkp-consulting.fr');

      expect(writeHead).toHaveBeenCalledWith(204, expect.objectContaining({
        'access-control-allow-origin': 'https://vkp-consulting.fr'
      }));
      expect(end).toHaveBeenCalledWith(undefined);
    });
  });
});
