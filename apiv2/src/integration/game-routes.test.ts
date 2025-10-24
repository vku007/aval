import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../index.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn()
  })),
  GetObjectCommand: vi.fn(),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
  ListObjectsV2Command: vi.fn()
}));

describe('Game API Routes Integration', () => {
  const mockS3Send = vi.fn();
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock S3 responses for successful operations
    mockS3Send.mockImplementation((command) => {
      if (command.constructor.name === 'ListObjectsV2Command') {
        return Promise.resolve({
          Contents: [],
          NextContinuationToken: undefined
        });
      }
      return Promise.resolve({});
    });
    
    const { S3Client } = await import('@aws-sdk/client-s3');
    (S3Client as any).mockImplementation(() => ({
      send: mockS3Send
    }));
  });

  function createApiGatewayEvent(method: string, path: string, body?: any): APIGatewayProxyEventV2 {
    return {
      version: '2.0',
      routeKey: '$default',
      rawPath: path,
      rawQueryString: '',
      headers: {
        'content-type': 'application/json'
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
      pathParameters: extractPathParameters(path),
      queryStringParameters: {},
      stageVariables: {},
      cookies: []
    };
  }

  function extractPathParameters(path: string): Record<string, string> {
    const params: Record<string, string> = {};
    if (path.includes('/games/') && !path.includes('/rounds/')) {
      const match = path.match(/\/games\/([^\/]+)/);
      if (match) params.id = match[1];
    }
    if (path.includes('/rounds/')) {
      const gameMatch = path.match(/\/games\/([^\/]+)/);
      const roundMatch = path.match(/\/rounds\/([^\/]+)/);
      if (gameMatch) params.gameId = gameMatch[1];
      if (roundMatch) params.roundId = roundMatch[1];
    }
    return params;
  }

  describe('Game API Routes', () => {
    it('should handle GET /apiv2/games (list games)', async () => {
      const event = createApiGatewayEvent('GET', '/apiv2/games');
      const response = await handler(event);
      
      expect((response as any).statusCode).toBe(200);
      expect((response as any).headers?.['content-type']).toContain('application/json');
    });

    it('should handle POST /apiv2/games (create game)', async () => {
      const event = createApiGatewayEvent('POST', '/apiv2/games', {
        id: 'test-game',
        type: 'tournament',
        usersIds: ['user-1'],
        rounds: [],
        isFinished: false
      });
      
      const response = await handler(event);
      
      // Should return 201 (successful creation)
      expect((response as any).statusCode).toBe(201);
    });

    it('should handle GET /apiv2/games/:id (get game)', async () => {
      const event = createApiGatewayEvent('GET', '/apiv2/games/test-game');
      const response = await handler(event);
      
      // Should return 404 since game doesn't exist
      expect((response as any).statusCode).toBe(404);
    });

    it('should handle GET /apiv2/games/:id/meta (get game metadata)', async () => {
      const event = createApiGatewayEvent('GET', '/apiv2/games/test-game/meta');
      const response = await handler(event);
      
      // Should return 200 (metadata exists)
      expect((response as any).statusCode).toBe(200);
    });

    it('should handle PUT /apiv2/games/:id (update game)', async () => {
      const event = createApiGatewayEvent('PUT', '/apiv2/games/test-game', {
        type: 'championship',
        usersIds: ['user-1'],
        rounds: [],
        isFinished: false
      });
      
      const response = await handler(event);
      
      // Should return 404 since game doesn't exist
      expect((response as any).statusCode).toBe(404);
    });

    it('should handle PATCH /apiv2/games/:id (patch game)', async () => {
      const event = createApiGatewayEvent('PATCH', '/apiv2/games/test-game', {
        isFinished: true
      });
      
      const response = await handler(event);
      
      // Should return 404 since game doesn't exist
      expect((response as any).statusCode).toBe(404);
    });

    it('should handle DELETE /apiv2/games/:id (delete game)', async () => {
      const event = createApiGatewayEvent('DELETE', '/apiv2/games/test-game');
      const response = await handler(event);
      
      // Should return 204 (successful deletion)
      expect((response as any).statusCode).toBe(204);
    });

    it('should handle POST /apiv2/games/:id/rounds (add round)', async () => {
      const event = createApiGatewayEvent('POST', '/apiv2/games/test-game/rounds', {
        id: 'round-1',
        moves: [],
        isFinished: false
      });
      
      const response = await handler(event);
      
      // Should return 404 since game doesn't exist
      expect((response as any).statusCode).toBe(404);
    });

    it('should handle POST /apiv2/games/:gameId/rounds/:roundId/moves (add move)', async () => {
      const event = createApiGatewayEvent('POST', '/apiv2/games/test-game/rounds/round-1/moves', {
        id: 'move-1',
        userId: 'user-1',
        value: 10,
        valueDecorated: 'ten'
      });
      
      const response = await handler(event);
      
      // Should return 404 since game doesn't exist (parameter extraction works correctly)
      expect((response as any).statusCode).toBe(404);
    });

    it('should handle PATCH /apiv2/games/:gameId/rounds/:roundId/finish (finish round)', async () => {
      const event = createApiGatewayEvent('PATCH', '/apiv2/games/test-game/rounds/round-1/finish');
      const response = await handler(event);
      
      // Should return 404 since game doesn't exist (parameter extraction works correctly)
      expect((response as any).statusCode).toBe(404);
    });

    it('should handle PATCH /apiv2/games/:id/finish (finish game)', async () => {
      const event = createApiGatewayEvent('PATCH', '/apiv2/games/test-game/finish');
      const response = await handler(event);
      
      // Should return 404 since game doesn't exist
      expect((response as any).statusCode).toBe(404);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in game API responses', async () => {
      const event = createApiGatewayEvent('GET', '/apiv2/games');
      const response = await handler(event);

      expect((response as any).headers?.['access-control-allow-origin']).toBeDefined();
      expect((response as any).headers?.['access-control-allow-methods']).toBeDefined();
      expect((response as any).headers?.['access-control-allow-headers']).toBeDefined();
    });
  });
});
