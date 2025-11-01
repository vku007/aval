import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EntityController } from './EntityController.js';
import { EntityService } from '../../application/services/EntityService.js';
import { CreateEntityDto } from '../../application/dto/CreateEntityDto.js';
import { UpdateEntityDto } from '../../application/dto/UpdateEntityDto.js';
import { EntityResponseDto } from '../../application/dto/EntityResponseDto.js';
import { Logger } from '../../shared/logging/Logger.js';
import { ValidationError, NotFoundError, NotModifiedError } from '../../shared/errors/index.js';
import { JsonEntity } from '../../domain/entity/JsonEntity.js';
import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';

describe('EntityController', () => {
  let controller: EntityController<JsonEntity>;
  let mockEntityService: EntityService<JsonEntity>;
  let mockLogger: Logger;

  beforeEach(() => {
    mockEntityService = {
      getEntity: vi.fn(),
      createEntity: vi.fn(),
      updateEntity: vi.fn(),
      deleteEntity: vi.fn(),
      getEntityMetadata: vi.fn().mockResolvedValue({
        etag: '"etag-123"',
        size: 1024,
        lastModified: '2023-01-01T00:00:00Z'
      }),
      listEntities: vi.fn()
    } as any;

    mockLogger = new Logger();
    controller = new EntityController(mockEntityService, mockLogger);
  });

  describe('list', () => {
    it('should return list of entities', async () => {
      const mockResult = {
        names: ['entity-1', 'entity-2'],
        nextCursor: 'next-token'
      };

      vi.mocked(mockEntityService.listEntities).mockResolvedValue(mockResult);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/files',
        params: {},
        headers: {},
        query: { prefix: 'test', limit: '10', cursor: 'token' },
        body: {}
      };

      const response = await controller.list(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockEntityService.listEntities).toHaveBeenCalledWith('test', 10, 'token');
    });

    it('should use default values when query parameters are missing', async () => {
      const mockResult = { names: ['entity-1'] };

      vi.mocked(mockEntityService.listEntities).mockResolvedValue(mockResult);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/files',
        params: {},
        headers: {},
        query: {},
        body: {}
      };

      await controller.list(request);

      expect(mockEntityService.listEntities).toHaveBeenCalledWith(undefined, 100, undefined);
    });
  });

  describe('get', () => {
    it('should return entity when found', async () => {
      const mockResponseDto = EntityResponseDto.fromEntity(
        new JsonEntity('entity-123', { data: 'test' }, '"etag-123"')
      );
      vi.mocked(mockEntityService.getEntity).mockResolvedValue(mockResponseDto);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/files/entity-123',
        params: { id: 'entity-123' },
        headers: {},
        query: {},
        body: {}
      };

      const response = await controller.get(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ id: 'entity-123', data: { data: 'test' } });
      expect(response.headers?.['etag']).toBe('"etag-123"');
      expect(response.headers?.['cache-control']).toBe('private, must-revalidate');
    });

    it('should pass If-None-Match header', async () => {
      const mockResponseDto = EntityResponseDto.fromEntity(
        new JsonEntity('entity-123', { data: 'test' }, '"etag-123"')
      );
      vi.mocked(mockEntityService.getEntity).mockResolvedValue(mockResponseDto);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/files/entity-123',
        params: { id: 'entity-123' },
        headers: { 'if-none-match': '"etag-123"' },
        query: {},
        body: {}
      };

      await controller.get(request);

      expect(mockEntityService.getEntity).toHaveBeenCalledWith('entity-123', '"etag-123"');
    });

    it('should return 304 when NotModifiedError is thrown', async () => {
      const notModifiedError = new NotModifiedError('"etag-123"');
      vi.mocked(mockEntityService.getEntity).mockRejectedValue(notModifiedError);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/files/entity-123',
        params: { id: 'entity-123' },
        headers: { 'if-none-match': '"etag-123"' },
        query: {},
        body: {}
      };

      const response = await controller.get(request);

      expect(response.statusCode).toBe(304);
      expect(response.headers?.['etag']).toBe('"etag-123"');
    });

    it('should throw other errors', async () => {
      const notFoundError = new NotFoundError('Entity not found');
      vi.mocked(mockEntityService.getEntity).mockRejectedValue(notFoundError);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/files/entity-123',
        params: { id: 'entity-123' },
        headers: {},
        query: {},
        body: {}
      };

      await expect(controller.get(request)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getMeta', () => {
    it('should return entity metadata', async () => {
      const mockMetadata = {
        etag: '"etag-123"',
        size: 1024,
        lastModified: '2023-01-01T00:00:00Z'
      };

      vi.mocked(mockEntityService.getEntityMetadata).mockResolvedValue(mockMetadata);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/files/entity-123/meta',
        params: { id: 'entity-123' },
        headers: {},
        query: {},
        body: {}
      };

      const response = await controller.getMeta(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(mockMetadata);
      expect(response.headers?.['etag']).toBe('"etag-123"');
    });
  });

  describe('create', () => {
    it('should create entity successfully', async () => {
      const mockResponseDto = EntityResponseDto.fromEntity(
        new JsonEntity('entity-123', { data: 'test' }, '"etag-123"')
      );
      vi.mocked(mockEntityService.createEntity).mockResolvedValue(mockResponseDto);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'POST',
        path: '/apiv2/internal/files',
        params: {},
        headers: {},
        query: {},
        body: { id: 'entity-123', data: { data: 'test' } }
      };

      const response = await controller.create(request);

      expect(response.statusCode).toBe(201);
      expect(response.body).toEqual({ data: 'test' });
      expect(response.headers?.['etag']).toBe('"etag-123"');
      expect(response.headers?.['location']).toBe('/apiv2/internal/files/entity-123');
    });

    it('should validate request body', async () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'POST',
        path: '/apiv2/internal/files',
        params: {},
        headers: {},
        query: {},
        body: { id: '', data: {} } // Invalid ID
      };

      await expect(controller.create(request)).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update entity with replace strategy', async () => {
      const mockResponseDto = EntityResponseDto.fromEntity(
        new JsonEntity('entity-123', { data: 'updated' }, '"etag-456"')
      );
      vi.mocked(mockEntityService.updateEntity).mockResolvedValue(mockResponseDto);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'PUT',
        path: '/apiv2/internal/files/entity-123',
        params: { id: 'entity-123' },
        headers: { 'if-match': '"etag-123"' },
        query: {},
        body: { data: { data: 'updated' } }
      };

      const response = await controller.update(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ data: 'updated' });
      expect(response.headers?.['etag']).toBe('"etag-456"');
      expect(mockEntityService.updateEntity).toHaveBeenCalledWith(
        'entity-123',
        expect.any(UpdateEntityDto),
        '"etag-123"'
      );
    });
  });

  describe('patch', () => {
    it('should update entity with merge strategy', async () => {
      const mockResponseDto = EntityResponseDto.fromEntity(
        new JsonEntity('entity-123', { data: 'patched' }, '"etag-456"')
      );
      vi.mocked(mockEntityService.updateEntity).mockResolvedValue(mockResponseDto);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'PATCH',
        path: '/apiv2/internal/files/entity-123',
        params: { id: 'entity-123' },
        headers: { 'if-match': '"etag-123"' },
        query: {},
        body: { data: { newField: 'value' } }
      };

      const response = await controller.patch(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ data: 'patched' });
      expect(response.headers?.['etag']).toBe('"etag-456"');
      expect(mockEntityService.updateEntity).toHaveBeenCalledWith(
        'entity-123',
        expect.any(UpdateEntityDto),
        '"etag-123"'
      );
    });
  });

  describe('delete', () => {
    it('should delete entity successfully', async () => {
      vi.mocked(mockEntityService.deleteEntity).mockResolvedValue(undefined);

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'DELETE',
        path: '/apiv2/internal/files/entity-123',
        params: { id: 'entity-123' },
        headers: { 'if-match': '"etag-123"' },
        query: {},
        body: {}
      };

      const response = await controller.delete(request);

      expect(response.statusCode).toBe(204);
      expect(response.body).toBeUndefined();
      expect(mockEntityService.deleteEntity).toHaveBeenCalledWith('entity-123', '"etag-123"');
    });
  });

  describe('extractId', () => {
    it('should extract id from params.id', () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/files/test-entity',
        params: { id: 'test-entity' },
        headers: {},
        query: {},
        body: {}
      };

      // Access private method through any cast for testing
      const result = (controller as any).extractId(request);
      expect(result).toBe('test-entity');
    });

    it('should extract id from params.name (legacy support)', () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/files/test-entity',
        params: { name: 'test-entity' },
        headers: {},
        query: {},
        body: {}
      };

      const result = (controller as any).extractId(request);
      expect(result).toBe('test-entity');
    });

    it('should extract id from proxy parameter', () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/files/test-entity',
        params: { proxy: 'files/test-entity' },
        headers: {},
        query: {},
        body: {}
      };

      const result = (controller as any).extractId(request);
      expect(result).toBe('test-entity');
    });

    it('should extract id from proxy parameter with meta path', () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/files/test-entity/meta',
        params: { proxy: 'files/test-entity/meta' },
        headers: {},
        query: {},
        body: {}
      };

      const result = (controller as any).extractId(request);
      expect(result).toBe('test-entity');
    });

    it('should throw error when unable to extract id', () => {
      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/files',
        params: {},
        headers: {},
        query: {},
        body: {}
      };

      expect(() => (controller as any).extractId(request)).toThrow('Unable to extract entity id from request');
    });
  });

  describe('error handling', () => {
    it('should handle NotFoundError in get', async () => {
      vi.mocked(mockEntityService.getEntity).mockRejectedValue(new NotFoundError('Entity not found'));

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'GET',
        path: '/apiv2/internal/files/entity-123',
        params: { id: 'entity-123' },
        headers: {},
        query: {},
        body: {}
      };

      await expect(controller.get(request)).rejects.toThrow(NotFoundError);
    });

    it('should handle ValidationError in create', async () => {
      vi.mocked(mockEntityService.createEntity).mockRejectedValue(new ValidationError('Invalid data'));

      const request: HttpRequest = {
        requestId: 'test-request-id',
        method: 'POST',
        path: '/apiv2/internal/files',
        params: {},
        headers: {},
        query: {},
        body: { id: 'entity-123', data: { data: 'test' } }
      };

      await expect(controller.create(request)).rejects.toThrow(ValidationError);
    });
  });
});
 