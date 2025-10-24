import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { handler } from '../index.js';
import { S3Client } from '@aws-sdk/client-s3';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// Mock S3Client
vi.mock('@aws-sdk/client-s3');

describe.skip('User API Integration Tests', () => {
  let mockSend: any;

  beforeEach(() => {
    mockSend = vi.fn();
    vi.mocked(S3Client).mockImplementation(() => ({ send: mockSend }) as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createEvent(method: string, path: string, body?: any, headers: Record<string, string> = {}): APIGatewayProxyEventV2 {
    return {
      version: '2.0',
      routeKey: '$default',
      rawPath: path,
      rawQueryString: '',
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
      pathParameters: path.includes(':') ? { id: path.split('/').pop() } : {},
      queryStringParameters: {},
      stageVariables: {},
      cookies: []
    };
  }

  describe('User CRUD Operations', () => {
    it('should create a user successfully', async () => {
      // Mock S3 PutObject response for save operation
      mockSend.mockResolvedValueOnce({
        ETag: '"user-etag-123"'
      });

      // Mock S3 HeadObject response for getUserMetadata call in controller
      mockSend.mockResolvedValueOnce({
        ETag: '"user-etag-123"',
        ContentLength: 50,
        LastModified: new Date('2023-01-01T00:00:00Z')
      });

      const event = createEvent('POST', '/apiv2/users', {
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001
      });

      const result = await handler(event);

      expect((result as any).statusCode).toBe(201);
      expect(JSON.parse((result as any).body!)).toEqual({
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001
      });
      expect((result as any).headers).toHaveProperty('location', '/apiv2/users/user-123');
      expect((result as any).headers).toHaveProperty('etag', '"user-etag-123"');
    });

    it('should get a user successfully', async () => {
      // Mock S3 GetObject response for findById
      mockSend.mockResolvedValueOnce({
        Body: {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'data') {
              callback(Buffer.from(JSON.stringify({ name: 'John Doe', externalId: 1001 })));
            }
            if (event === 'end') {
              callback();
            }
          })
        },
        ETag: '"user-etag-123"',
        ContentLength: 50,
        LastModified: new Date('2023-01-01T00:00:00Z')
      });

      const event = createEvent('GET', '/apiv2/users/user-123');

      const result = await handler(event);

      expect((result as any).statusCode).toBe(200);
      expect(JSON.parse((result as any).body!)).toEqual({
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001
      });
      expect((result as any).headers).toHaveProperty('etag', '"user-etag-123"');
      expect((result as any).headers).toHaveProperty('cache-control', 'private, max-age=300');
    });

    it('should update a user with PUT', async () => {
      // Mock existing user lookup
      mockSend.mockResolvedValueOnce({
        Body: {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'data') {
              callback(Buffer.from(JSON.stringify({ name: 'John Doe', externalId: 1001 })));
            }
            if (event === 'end') {
              callback();
            }
          })
        },
        ETag: '"old-etag"'
      });

      // Mock S3 PutObject for update
      mockSend.mockResolvedValueOnce({
        ETag: '"new-etag"'
      });

      // Mock S3 HeadObject for metadata
      mockSend.mockResolvedValueOnce({
        ETag: '"new-etag"',
        ContentLength: 60,
        LastModified: new Date('2023-01-02T00:00:00Z')
      });

      const event = createEvent('PUT', '/apiv2/users/user-123', {
        name: 'Jane Smith',
        externalId: 2002
      }, {
        'if-match': '"old-etag"'
      });

      const result = await handler(event);

      expect((result as any).statusCode).toBe(200);
      expect(JSON.parse((result as any).body!)).toEqual({
        id: 'user-123',
        name: 'Jane Smith',
        externalId: 2002
      });
      expect((result as any).headers).toHaveProperty('etag', '"new-etag"');
    });

    it('should patch a user with PATCH', async () => {
      // Mock existing user lookup
      mockSend.mockResolvedValueOnce({
        Body: {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'data') {
              callback(Buffer.from(JSON.stringify({ name: 'John Doe', externalId: 1001 })));
            }
            if (event === 'end') {
              callback();
            }
          })
        },
        ETag: '"old-etag"'
      });

      // Mock S3 PutObject for update
      mockSend.mockResolvedValueOnce({
        ETag: '"new-etag"'
      });

      // Mock S3 HeadObject for metadata
      mockSend.mockResolvedValueOnce({
        ETag: '"new-etag"',
        ContentLength: 55,
        LastModified: new Date('2023-01-02T00:00:00Z')
      });

      const event = createEvent('PATCH', '/apiv2/users/user-123', {
        name: 'John Smith'
      }, {
        'if-match': '"old-etag"'
      });

      const result = await handler(event);

      expect((result as any).statusCode).toBe(200);
      expect(JSON.parse((result as any).body!)).toEqual({
        id: 'user-123',
        name: 'John Smith',
        externalId: 1001 // Should preserve existing value
      });
    });

    it('should delete a user successfully', async () => {
      // Mock existing user lookup for ETag check
      mockSend.mockResolvedValueOnce({
        Body: {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'data') {
              callback(Buffer.from(JSON.stringify({ name: 'John Doe', externalId: 1001 })));
            }
            if (event === 'end') {
              callback();
            }
          })
        },
        ETag: '"user-etag-123"'
      });

      // Mock S3 DeleteObject
      mockSend.mockResolvedValueOnce({});

      const event = createEvent('DELETE', '/apiv2/users/user-123', undefined, {
        'if-match': '"user-etag-123"'
      });

      const result = await handler(event);

      expect((result as any).statusCode).toBe(204);
      expect((result as any).body).toBeUndefined();
    });

    it('should get user metadata', async () => {
      // Mock S3 HeadObject for getUserMetadata
      mockSend.mockResolvedValueOnce({
        ETag: '"user-etag-123"',
        ContentLength: 50,
        LastModified: new Date('2023-01-01T00:00:00Z')
      });

      const event = createEvent('GET', '/apiv2/users/user-123/meta');

      const result = await handler(event);

      expect((result as any).statusCode).toBe(200);
      expect(JSON.parse((result as any).body!)).toEqual({
        etag: '"user-etag-123"',
        size: 50,
        lastModified: '2023-01-01T00:00:00.000Z'
      });
      expect((result as any).headers).toHaveProperty('etag', '"user-etag-123"');
    });

    it('should list users with pagination', async () => {
      // Mock S3 ListObjectsV2
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'test/users/user-1.json', Size: 50, LastModified: new Date() },
          { Key: 'test/users/user-2.json', Size: 60, LastModified: new Date() }
        ],
        NextContinuationToken: 'next-token'
      });

      // Mock getMetadata for each user
      mockSend.mockResolvedValueOnce({
        ETag: '"etag-user-1"',
        ContentLength: 50,
        LastModified: new Date('2023-01-01T00:00:00Z')
      });
      mockSend.mockResolvedValueOnce({
        ETag: '"etag-user-2"',
        ContentLength: 60,
        LastModified: new Date('2023-01-01T00:00:00Z')
      });

      const event = createEvent('GET', '/apiv2/users');

      const result = await handler(event);

      expect((result as any).statusCode).toBe(200);
      expect(JSON.parse((result as any).body!)).toEqual({
        names: ['user-1', 'user-2'],
        nextCursor: 'next-token'
      });
      expect((result as any).headers).toHaveProperty('cache-control', 'private, max-age=60');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent user', async () => {
      // Mock S3 GetObject to return NoSuchKey error
      const error = new Error('NoSuchKey');
      error.name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(error);

      const event = createEvent('GET', '/apiv2/users/non-existent');

      const result = await handler(event);

      expect((result as any).statusCode).toBe(404);
      expect(JSON.parse((result as any).body!)).toHaveProperty('title', 'User Not Found');
    });

    it('should return 400 for invalid user data', async () => {
      const event = createEvent('POST', '/apiv2/users', {
        id: 'invalid id with spaces',
        name: 'John Doe',
        externalId: 1001
      });

      const result = await handler(event);

      expect((result as any).statusCode).toBe(400);
      expect(JSON.parse((result as any).body!)).toHaveProperty('title', 'Validation Error');
    });

    it('should return 409 for creating existing user', async () => {
      // Mock existing user lookup (GetObject for findById in checkPreconditions)
      mockSend.mockResolvedValueOnce({
        Body: {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'data') {
              callback(Buffer.from(JSON.stringify({ name: 'Existing', externalId: 1001 })));
            }
            if (event === 'end') {
              callback();
            }
          })
        },
        ETag: '"existing-etag"'
      });

      const event = createEvent('POST', '/apiv2/users', {
        id: 'existing-user',
        name: 'New User',
        externalId: 2002
      });

      const result = await handler(event);

      expect((result as any).statusCode).toBe(409);
      expect(JSON.parse((result as any).body!)).toHaveProperty('title', 'Conflict');
    });

    it('should return 412 for ETag mismatch', async () => {
      // Mock existing user lookup
      mockSend.mockResolvedValueOnce({
        Body: {
          on: vi.fn((event: string, callback: Function) => {
            if (event === 'data') {
              callback(Buffer.from(JSON.stringify({ name: 'John Doe', externalId: 1001 })));
            }
            if (event === 'end') {
              callback();
            }
          })
        },
        ETag: '"old-etag"'
      });

      const event = createEvent('PUT', '/apiv2/users/user-123', {
        name: 'Jane Smith',
        externalId: 2002
      }, {
        'if-match': '"wrong-etag"'
      });

      const result = await handler(event);

      expect((result as any).statusCode).toBe(412);
      expect(JSON.parse((result as any).body!)).toHaveProperty('title', 'Precondition Failed');
    });
  });

  describe('CORS and Headers', () => {
    it('should handle OPTIONS preflight request', async () => {
      const event = createEvent('OPTIONS', '/apiv2/users');

      const result = await handler(event);

      expect((result as any).statusCode).toBe(204);
      expect((result as any).headers).toHaveProperty('access-control-allow-origin');
      expect((result as any).headers).toHaveProperty('access-control-allow-methods');
      expect((result as any).headers).toHaveProperty('access-control-allow-headers');
    });

    it('should include CORS headers in responses', async () => {
      mockSend.mockResolvedValueOnce({
        ETag: '"user-etag-123"'
      });

      const event = createEvent('POST', '/apiv2/users', {
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001
      });

      const result = await handler(event);

      expect((result as any).statusCode).toBe(201);
      expect((result as any).headers).toHaveProperty('access-control-allow-origin');
      expect((result as any).headers).toHaveProperty('access-control-allow-methods');
      expect((result as any).headers).toHaveProperty('access-control-allow-headers');
    });
  });

  describe('Content-Type Validation', () => {
    it('should reject POST without application/json content-type', async () => {
      const event = createEvent('POST', '/apiv2/users', {
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001
      });
      delete event.headers!['content-type'];

      const result = await handler(event);

      expect((result as any).statusCode).toBe(415);
      expect(JSON.parse((result as any).body!)).toHaveProperty('title', 'Unsupported Media Type');
    });

    it('should accept requests with application/json content-type', async () => {
      mockSend.mockResolvedValueOnce({
        ETag: '"user-etag-123"'
      });

      const event = createEvent('POST', '/apiv2/users', {
        id: 'user-123',
        name: 'John Doe',
        externalId: 1001
      }, {
        'content-type': 'application/json'
      });

      const result = await handler(event);

      expect((result as any).statusCode).toBe(201);
    });
  });
});
