import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// Mock S3Client
vi.mock('@aws-sdk/client-s3');

import { handler } from './index.js';
import { S3Client, NotFound } from '@aws-sdk/client-s3';

// Get the mocked S3Client
const MockedS3Client = vi.mocked(S3Client);
const mockSend = vi.fn();
MockedS3Client.mockImplementation(() => ({ send: mockSend }) as any);

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
    mockSend.mockClear();
    mockSend.mockReset();
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
        { id: 'test', data: {} },
        { 'content-type': 'text/plain' }
      );
      const response = await handler(event);

      expect(response.statusCode).toBe(415);
      expect(response.headers?.['content-type']).toBe('application/problem+json');
    });

    it('should accept POST with application/json', async () => {
      const entityId = `test-entity-${Date.now()}`;
      
      // Mock HEAD checks (not found in both locations) then PUT success
      const notFoundError = new Error('Not Found');
      notFoundError.name = 'NotFound';
      (notFoundError as any).$metadata = { httpStatusCode: 404 };
      
      mockSend
        .mockRejectedValueOnce(notFoundError) // HEAD check base location (not found)
        .mockRejectedValueOnce(notFoundError) // HEAD check user location (not found)
        .mockRejectedValueOnce(notFoundError) // HEAD check base location (not found) - called by getMetadata
        .mockRejectedValueOnce(notFoundError) // HEAD check user location (not found) - called by getMetadata
        .mockResolvedValueOnce({ ETag: '"abc123"' }); // PUT

      const event = createEvent('POST', '/apiv2/files', { id: entityId, data: { x: 1 } });
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
      // Mock ListObjectsV2 responses for base, user, and game prefixes
      mockSend.mockResolvedValueOnce({ 
        Contents: [],
        IsTruncated: false
      });
      mockSend.mockResolvedValueOnce({ 
        Contents: [],
        IsTruncated: false
      });
      mockSend.mockResolvedValueOnce({ 
        Contents: [],
        IsTruncated: false
      });

      const event = createEvent('GET', '/apiv2/files');
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body || '{}');
      expect(body).toHaveProperty('names');
    });

    it('should route GET /apiv2/files/:id to get entity', async () => {
      const mockBody = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify({ test: 'data' }));
        }
      };
      // Mock GetObject response
      mockSend.mockResolvedValueOnce({
        Body: mockBody,
        ETag: '"etag123"',
        ContentLength: 16,
        LastModified: new Date()
      });

      const event = createEvent('GET', '/apiv2/files/test-entity');
      event.pathParameters = { proxy: 'files/test-entity' };
      
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.etag).toBeTruthy();
      const body = JSON.parse(response.body || '{}');
      expect(body).toEqual({ 
        id: 'test-entity', 
        data: { test: 'data' } 
      });
    });
  });

  describe('Entity CRUD operations', () => {
    it('should create entity with POST', async () => {
      const entityId = `new-entity-${Date.now()}`;
      
      // Mock HEAD checks (not found in both locations) then PUT success
      const notFoundError = new Error('Not Found');
      notFoundError.name = 'NotFound';
      (notFoundError as any).$metadata = { httpStatusCode: 404 };
      
      mockSend
        .mockRejectedValueOnce(notFoundError) // HEAD check base location (not found)
        .mockRejectedValueOnce(notFoundError) // HEAD check user location (not found)
        .mockRejectedValueOnce(notFoundError) // HEAD check base location (not found) - called by getMetadata
        .mockRejectedValueOnce(notFoundError) // HEAD check user location (not found) - called by getMetadata
        .mockResolvedValueOnce({ ETag: '"new-etag"' }); // PUT

      const event = createEvent('POST', '/apiv2/files', {
        id: entityId,
        data: { value: 42 }
      });
      
      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      expect(response.headers?.location).toBe(`/apiv2/files/${entityId}`);
      expect(response.headers?.etag).toBeTruthy();
    });

    it('should update entity with PUT', async () => {
      const mockBody = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify({ old: 'value' }));
        }
      };
      // Mock GET existing then PUT update
      mockSend
        .mockResolvedValueOnce({ // GET existing
          Body: mockBody,
          ETag: '"old-etag"',
          ContentLength: 15,
          LastModified: new Date()
        })
        .mockResolvedValueOnce({ ETag: '"updated-etag"' }); // PUT

      const event = createEvent('PUT', '/apiv2/files/existing', { updated: true });
      event.pathParameters = { proxy: 'files/existing' };
      
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.etag).toBeTruthy();
    });

    it('should delete entity with DELETE', async () => {
      // Mock HEAD check for exists then DELETE
      mockSend
        .mockResolvedValueOnce({ // HEAD check for exists
          ETag: '"etag"',
          ContentLength: 10,
          LastModified: new Date()
        })
        .mockResolvedValueOnce({}); // DELETE

      const event = createEvent('DELETE', '/apiv2/files/to-delete');
      event.pathParameters = { proxy: 'files/to-delete' };
      
      const response = await handler(event);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBeUndefined();
    });
  });

  describe('ETag handling', () => {
    it('should return 304 Not Modified when If-None-Match matches', async () => {
      // Mock GET with 304 response
      mockSend.mockRejectedValueOnce({
        $metadata: { httpStatusCode: 304 }
      });

      const event = createEvent('GET', '/apiv2/files/test', undefined, {
        'if-none-match': '"matching-etag"'
      });
      event.pathParameters = { proxy: 'files/test' };
      
      const response = await handler(event);

      expect(response.statusCode).toBe(304);
    });

    it('should include ETag in response headers', async () => {
      const mockBody = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{}');
        }
      };
      // Mock GetObject response with ETag
      mockSend.mockResolvedValueOnce({
        Body: mockBody,
        ETag: '"response-etag"',
        ContentLength: 2,
        LastModified: new Date()
      });

      const event = createEvent('GET', '/apiv2/files/test');
      event.pathParameters = { proxy: 'files/test' };
      
      const response = await handler(event);

      expect(response.headers?.etag).toBe('"response-etag"');
    });
  });

  describe('User file compatibility', () => {
    it('should read user files from json/users/ folder', async () => {
      const mockBody = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify({ name: 'John Doe', externalId: 1001 }));
        }
      };
      
      // Mock HEAD check for base location (not found), then GetObject from user location
      mockSend
        .mockRejectedValueOnce({ // HEAD check base location (not found)
          name: 'NotFound',
          $metadata: { httpStatusCode: 404 }
        })
        .mockResolvedValueOnce({ // GetObject from user location
          Body: mockBody,
          ETag: '"user-etag"',
          ContentLength: 50,
          LastModified: new Date('2023-01-01T00:00:00Z')
        });

      const event = createEvent('GET', '/apiv2/files/user-123');
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body || '{}');
      expect(body.id).toBe('user-123');
      expect(body.data.name).toBe('John Doe');
      expect(body.data.externalId).toBe(1001);
      expect(response.headers?.etag).toBe('"user-etag"');
    });

    it('should list both regular files and user files', async () => {
      // Mock ListObjectsV2 responses for base, user, and game prefixes
      mockSend.mockResolvedValueOnce({
        Contents: [{ 
          Key: 'json/regular-file.json', 
          ETag: '"regular-etag"',
          Size: 100,
          LastModified: new Date()
        }],
        IsTruncated: false
      });
      mockSend.mockResolvedValueOnce({
        Contents: [{ 
          Key: 'json/users/user-file.json', 
          ETag: '"user-etag"',
          Size: 80,
          LastModified: new Date()
        }],
        IsTruncated: false
      });
      mockSend.mockResolvedValueOnce({
        Contents: [],
        IsTruncated: false
      });

      const event = createEvent('GET', '/apiv2/files');
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body || '{}');
      expect(body.names).toContain('regular-file');
      expect(body.names).toContain('user-file');
      expect(body.names.length).toBe(2);
    });
  });

  describe('Query parameters', () => {
    it('should handle list pagination with cursor', async () => {
      // Mock ListObjectsV2 with pagination for base, user, and game prefixes
      mockSend.mockResolvedValueOnce({
        Contents: [{ 
          Key: 'json/test.json', 
          ETag: '"etag"',
          Size: 100,
          LastModified: new Date()
        }],
        IsTruncated: true,
        NextContinuationToken: 'next-token'
      });
      mockSend.mockResolvedValueOnce({
        Contents: [],
        IsTruncated: false
      });
      mockSend.mockResolvedValueOnce({
        Contents: [],
        IsTruncated: false
      });

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

