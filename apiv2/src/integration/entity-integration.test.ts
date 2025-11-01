import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handler } from '../index.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { S3Client } from '@aws-sdk/client-s3';

// Mock S3Client for integration tests
vi.mock('@aws-sdk/client-s3');

// Get the mocked S3Client
const MockedS3Client = vi.mocked(S3Client);
const mockSend = vi.fn();
MockedS3Client.mockImplementation(() => ({ send: mockSend }) as any);

describe('EntityController Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementation to ensure clean state
    MockedS3Client.mockImplementation(() => ({ send: mockSend }) as any);
  });

  const createEvent = (
    method: string,
    path: string,
    body?: any,
    headers: Record<string, string> = {},
    queryStringParameters: Record<string, string> = {}
  ): APIGatewayProxyEventV2 => ({
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: Object.keys(queryStringParameters).length > 0 
      ? Object.entries(queryStringParameters).map(([k, v]) => `${k}=${v}`).join('&')
      : '',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
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
    isBase64Encoded: false,
    pathParameters: {},
    queryStringParameters,
    stageVariables: {},
    cookies: []
  });

  describe('Core Entity Operations', () => {
    it('should handle OPTIONS preflight request', async () => {
      const event = createEvent('OPTIONS', '/apiv2/internal/files');
      const result = await handler(event);

      expect((result as any).statusCode).toBe(204);
      expect((result as any).headers?.['access-control-allow-origin']).toBe('https://vkp-consulting.fr');
      expect((result as any).headers?.['access-control-allow-methods']).toBe('GET,POST,PUT,PATCH,DELETE,OPTIONS');
      expect((result as any).body).toBeUndefined();
    });

    it('should handle POST /apiv2/internal/files (create entity)', async () => {
      // Mock S3 head response (entity doesn't exist)
      mockSend.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 404 }
      });
      
      // Mock S3 put response
      mockSend.mockResolvedValueOnce({
        ETag: '"new-etag"',
        VersionId: 'version-1'
      });

      const event = createEvent('POST', '/apiv2/internal/files', {
        id: 'new-entity',
        data: { content: 'new data' }
      });
      const result = await handler(event);

      expect((result as any).statusCode).toBe(201);
      expect((result as any).headers?.['etag']).toBe('"new-etag"');
      expect((result as any).headers?.['location']).toBe('/apiv2/internal/files/new-entity');
      
      const body = JSON.parse((result as any).body || '{}');
      expect(body).toEqual({ content: 'new data' });
    });

    it('should handle DELETE /apiv2/internal/files/{id} (delete entity)', async () => {
      // Mock S3 head response (entity exists)
      mockSend.mockResolvedValueOnce({
        ETag: '"etag123"',
        ContentLength: 100,
        LastModified: new Date('2024-01-01')
      });
      
      // Mock S3 delete response
      mockSend.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 204 }
      });

      const event = createEvent('DELETE', '/apiv2/internal/files/to-delete', undefined, {
        'if-match': '"etag123"'
      });
      const result = await handler(event);

      expect((result as any).statusCode).toBe(204);
      expect((result as any).body).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid entity ID', async () => {
      const event = createEvent('POST', '/apiv2/internal/files', {
        id: '', // Invalid empty ID
        data: { content: 'test' }
      });
      const result = await handler(event);

      expect((result as any).statusCode).toBe(400);
      expect((result as any).headers?.['content-type']).toBe('application/problem+json');
      
      const body = JSON.parse((result as any).body || '{}');
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('ValidationError');
      expect(body.detail).toContain('ID is required and must be a string');
    });

    it('should return 409 for entity creation conflict', async () => {
      // Mock S3 head response (entity already exists)
      mockSend.mockResolvedValueOnce({
        ETag: '"existing-etag"',
        ContentLength: 100,
        LastModified: new Date('2024-01-01')
      });

      const event = createEvent('POST', '/apiv2/internal/files', {
        id: 'existing-entity',
        data: { content: 'test' }
      });
      const result = await handler(event);

      expect((result as any).statusCode).toBe(409);
      expect((result as any).headers?.['content-type']).toBe('application/problem+json');
      
      const body = JSON.parse((result as any).body || '{}');
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('ConflictError');
      expect(body.detail).toContain('Entity \'existing-entity\' already exists');
    });

    it('should return 415 for invalid content type', async () => {
      const event = createEvent('POST', '/apiv2/internal/files', {
        id: 'test',
        data: { content: 'test' }
      }, {
        'content-type': 'text/plain' // Wrong content type
      });
      const result = await handler(event);

      expect((result as any).statusCode).toBe(415);
      expect((result as any).headers?.['content-type']).toBe('application/problem+json');
      
      const body = JSON.parse((result as any).body || '{}');
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('UnsupportedMediaTypeError');
      expect(body.detail).toContain('Content-Type must be application/json');
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in error responses', async () => {
      const event = createEvent('POST', '/apiv2/internal/files', {
        id: '', // Invalid ID to trigger error
        data: { content: 'test' }
      });
      const result = await handler(event);

      expect((result as any).statusCode).toBe(400);
      expect((result as any).headers?.['access-control-allow-origin']).toBe('https://vkp-consulting.fr');
      expect((result as any).headers?.['access-control-allow-methods']).toBe('GET,POST,PUT,PATCH,DELETE,OPTIONS');
    });
  });

  describe('Request Validation', () => {
    it('should validate request body structure', async () => {
      const event = createEvent('POST', '/apiv2/internal/files', {
        // Missing required 'id' field
        data: { content: 'test' }
      });
      const result = await handler(event);

      expect((result as any).statusCode).toBe(400);
      const body = JSON.parse((result as any).body || '{}');
      expect(body.detail).toContain('Field "id" is required');
    });

    it('should handle malformed JSON', async () => {
      const event = createEvent('POST', '/apiv2/files', 'invalid json');
      const result = await handler(event);

      expect((result as any).statusCode).toBe(400);
      const body = JSON.parse((result as any).body || '{}');
      expect(body.detail).toContain('Request body must be a JSON object');
    });
  });

  describe('Integration Success', () => {
    it('should handle complete entity creation flow', async () => {
      // Step 1: Create entity
      mockSend.mockResolvedValueOnce({ $metadata: { httpStatusCode: 404 } }); // Head - not found
      mockSend.mockResolvedValueOnce({ ETag: '"create-etag"', VersionId: 'v1' }); // Put

      const createEventRequest = createEvent('POST', '/apiv2/files', {
        id: 'lifecycle-test',
        data: { step: 'created' }
      });
      const createResult = await handler(createEventRequest);

      expect((createResult as any).statusCode).toBe(201);
      expect((createResult as any).headers?.['etag']).toBe('"create-etag"');

      // Step 2: Delete entity
      mockSend.mockResolvedValueOnce({ // Head - exists
        ETag: '"create-etag"',
        ContentLength: 30,
        LastModified: new Date('2024-01-02')
      });
      mockSend.mockResolvedValueOnce({ $metadata: { httpStatusCode: 204 } }); // Delete

      const deleteEvent = createEvent('DELETE', '/apiv2/files/lifecycle-test', undefined, {
        'if-match': '"create-etag"'
      });
      const deleteResult = await handler(deleteEvent);

      expect((deleteResult as any).statusCode).toBe(204);
      expect((deleteResult as any).body).toBeUndefined();
    });
  });
});