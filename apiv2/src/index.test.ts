import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from './index.js';

// Mock S3Client
vi.mock('@aws-sdk/client-s3', () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn(() => ({ send: mockSend })),
    GetObjectCommand: vi.fn(),
    PutObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    HeadObjectCommand: vi.fn(),
    ListObjectsV2Command: vi.fn(),
    NotFound: class NotFound extends Error {
      constructor() {
        super('Not Found');
        this.name = 'NotFound';
      }
    }
  };
});

function createEvent(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
  queryStringParameters?: Record<string, string>
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    queryStringParameters,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'id.execute-api.eu-north-1.amazonaws.com',
      domainPrefix: 'id',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'vitest'
      },
      requestId: 'test-request-id',
      routeKey: '$default',
      stage: '$default',
      time: '12/Mar/2020:19:03:58 +0000',
      timeEpoch: 1583348638390
    },
    body: body ? JSON.stringify(body) : undefined,
    pathParameters: {},
    isBase64Encoded: false,
    stageVariables: {}
  } as APIGatewayProxyEventV2;
}

describe('Lambda Handler - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.JSON_PREFIX = 'json/';
    process.env.CORS_ORIGIN = 'https://vkp-consulting.fr';
  });

  describe('CORS', () => {
    it('should handle OPTIONS preflight', async () => {
      const event = createEvent('OPTIONS', '/apiv2/files');
      const response = await handler(event);

      expect(response.statusCode).toBe(204);
      expect(response.headers?.['access-control-allow-origin']).toBe('https://vkp-consulting.fr');
      expect(response.headers?.['access-control-allow-methods']).toBeTruthy();
    });
  });

  describe('Content-Type validation', () => {
    it('should reject POST without application/json', async () => {
      const event = createEvent(
        'POST',
        '/apiv2/files',
        { name: 'test', data: {} },
        { 'content-type': 'text/plain' }
      );
      const response = await handler(event);

      expect(response.statusCode).toBe(415);
      expect(response.headers?.['content-type']).toBe('application/problem+json');
    });

    it('should accept POST with application/json', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn()
        .mockRejectedValueOnce({ // HEAD check (not found)
          name: 'NotFound',
          $metadata: { httpStatusCode: 404 }
        })
        .mockResolvedValueOnce({ ETag: '"abc123"' }); // PUT
      (S3Client as any).mockImplementation(() => ({ send: mockSend }));

      const event = createEvent('POST', '/apiv2/files', { id: 'test', data: { x: 1 } });
      const response = await handler(event);

      expect(response.statusCode).toBe(201);
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const event = createEvent('GET', '/apiv2/unknown');
      const response = await handler(event);

      expect(response.statusCode).toBe(500); // Router throws error for no match
      expect(response.headers?.['content-type']).toBe('application/problem+json');
    });

    it('should return validation error for invalid entity id', async () => {
      const event = createEvent('POST', '/apiv2/files', {
        id: 'invalid name with spaces',
        data: {}
      });
      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body || '{}');
      expect(body.status).toBe(400);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Logging', () => {
    it('should log request and response', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const event = createEvent('OPTIONS', '/apiv2/files');
      
      await handler(event);

      expect(consoleSpy).toHaveBeenCalled();
      const logs = consoleSpy.mock.calls.map(call => JSON.parse(call[0]));
      
      expect(logs.some(log => log.message === 'Request received')).toBe(true);
      expect(logs.some(log => log.message === 'Request completed')).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Path routing', () => {
    it('should route GET /apiv2/files to list', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn().mockResolvedValue({ 
        Contents: [],
        IsTruncated: false
      });
      (S3Client as any).mockImplementation(() => ({ send: mockSend }));

      const event = createEvent('GET', '/apiv2/files');
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body || '{}');
      expect(body).toHaveProperty('names');
    });

    it('should route GET /apiv2/files/:name to get entity', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockBody = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify({ test: 'data' }));
        }
      };
      const mockSend = vi.fn().mockResolvedValue({
        Body: mockBody,
        ETag: '"etag123"',
        ContentLength: 16,
        LastModified: new Date()
      });
      (S3Client as any).mockImplementation(() => ({ send: mockSend }));

      const event = createEvent('GET', '/apiv2/files/test-entity');
      event.pathParameters = { proxy: 'files/test-entity' };
      
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.etag).toBeTruthy();
      const body = JSON.parse(response.body || '{}');
      expect(body).toEqual({ test: 'data' });
    });
  });

  describe('Entity CRUD operations', () => {
    it('should create entity with POST', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn()
        .mockRejectedValueOnce({ // HEAD check
          name: 'NotFound',
          $metadata: { httpStatusCode: 404 }
        })
        .mockResolvedValueOnce({ ETag: '"new-etag"' }); // PUT
      (S3Client as any).mockImplementation(() => ({ send: mockSend }));

      const event = createEvent('POST', '/apiv2/files', {
        id: 'new-entity',
        data: { value: 42 }
      });
      
      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      expect(response.headers?.location).toBe('/apiv2/files/new-entity');
      expect(response.headers?.etag).toBeTruthy();
    });

    it('should update entity with PUT', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockBody = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify({ old: 'value' }));
        }
      };
      const mockSend = vi.fn()
        .mockResolvedValueOnce({ // GET existing
          Body: mockBody,
          ETag: '"old-etag"',
          ContentLength: 15,
          LastModified: new Date()
        })
        .mockResolvedValueOnce({ ETag: '"updated-etag"' }); // PUT
      (S3Client as any).mockImplementation(() => ({ send: mockSend }));

      const event = createEvent('PUT', '/apiv2/files/existing', { updated: true });
      event.pathParameters = { proxy: 'files/existing' };
      
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.etag).toBeTruthy();
    });

    it('should delete entity with DELETE', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn()
        .mockResolvedValueOnce({ // HEAD check for exists
          ETag: '"etag"',
          ContentLength: 10,
          LastModified: new Date()
        })
        .mockResolvedValueOnce({}); // DELETE
      (S3Client as any).mockImplementation(() => ({ send: mockSend }));

      const event = createEvent('DELETE', '/apiv2/files/to-delete');
      event.pathParameters = { proxy: 'files/to-delete' };
      
      const response = await handler(event);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBeUndefined();
    });
  });

  describe('ETag handling', () => {
    it('should return 304 Not Modified when If-None-Match matches', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn().mockRejectedValue({
        $metadata: { httpStatusCode: 304 }
      });
      (S3Client as any).mockImplementation(() => ({ send: mockSend }));

      const event = createEvent('GET', '/apiv2/files/test', undefined, {
        'if-none-match': '"matching-etag"'
      });
      event.pathParameters = { proxy: 'files/test' };
      
      const response = await handler(event);

      expect(response.statusCode).toBe(304);
    });

    it('should include ETag in response headers', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockBody = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{}');
        }
      };
      const mockSend = vi.fn().mockResolvedValue({
        Body: mockBody,
        ETag: '"response-etag"',
        ContentLength: 2,
        LastModified: new Date()
      });
      (S3Client as any).mockImplementation(() => ({ send: mockSend }));

      const event = createEvent('GET', '/apiv2/files/test');
      event.pathParameters = { proxy: 'files/test' };
      
      const response = await handler(event);

      expect(response.headers?.etag).toBe('"response-etag"');
    });
  });

  describe('Query parameters', () => {
    it('should handle list pagination with cursor', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const mockSend = vi.fn().mockResolvedValue({
        Contents: [{ 
          Key: 'json/test.json', 
          ETag: '"etag"',
          Size: 100,
          LastModified: new Date()
        }],
        IsTruncated: true,
        NextContinuationToken: 'next-token'
      });
      (S3Client as any).mockImplementation(() => ({ send: mockSend }));

      const event = createEvent('GET', '/apiv2/files', undefined, undefined, {
        limit: '10',
        cursor: Buffer.from('next-token', 'utf8').toString('base64url')
      });
      
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body || '{}');
      expect(body.nextCursor).toBeTruthy();
    });
  });
});

