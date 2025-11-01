import type { EntityService } from '../../application/services/EntityService.js';
import type { BaseEntity } from '../../domain/entity/BaseEntity.js';
import type { Logger } from '../../shared/logging/Logger.js';
import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';
import { HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import { CreateEntityDto } from '../../application/dto/CreateEntityDto.js';
import { UpdateEntityDto } from '../../application/dto/UpdateEntityDto.js';
import { NotModifiedError } from '../../shared/errors/index.js';

/**
 * HTTP controller for entity operations
 * Handles HTTP concerns (request/response) and delegates to service
 */
export class EntityController<T extends BaseEntity> {
  constructor(
    private readonly entityService: EntityService<T>,
    private readonly logger: Logger
  ) {}

  /**
   * List entities
   * GET /apiv2/internal/files?prefix=&limit=&cursor=
   */
  async list(request: HttpRequest): Promise<HttpResponse> {
    const prefix = request.query.prefix;
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 100;
    const cursor = request.query.cursor;

    const result = await this.entityService.listEntities(prefix, limit, cursor);

    return HttpResponse.ok(result);
  }

  /**
   * Get entity data
   * GET /apiv2/internal/files/{name}
   */
  async get(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const ifNoneMatch = request.headers['if-none-match'];

    try {
      const entity = await this.entityService.getEntity(id, ifNoneMatch);

      return HttpResponse.ok(entity.toJSON())
        .withETag(entity.etag)
        .withHeader('cache-control', 'private, must-revalidate');
    } catch (err) {
      if (err instanceof NotModifiedError) {
        return HttpResponse.notModified()
          .withETag(err.etag);
      }
      throw err;
    }
  }

  /**
   * Get entity metadata
   * GET /apiv2/internal/files/{id}/meta
   */
  async getMeta(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);

    const metadata = await this.entityService.getEntityMetadata(id);

    return HttpResponse.ok(metadata)
      .withETag(metadata.etag);
  }

  /**
   * Create entity
   * POST /apiv2/internal/files
   */
  async create(request: HttpRequest): Promise<HttpResponse> {
    const dto = CreateEntityDto.fromRequest(request.body);

    const entity = await this.entityService.createEntity(dto);

    return HttpResponse.created(entity.toDataResponse())
      .withETag(entity.etag)
      .withLocation(`/apiv2/internal/files/${entity.id}`);
  }

  /**
   * Update entity (replace)
   * PUT /apiv2/internal/files/{id}
   */
  async update(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const ifMatch = request.headers['if-match'];
    const dto = UpdateEntityDto.fromRequest(request.body, false);

    const entity = await this.entityService.updateEntity(id, dto, ifMatch);

    return HttpResponse.ok(entity.toDataResponse())
      .withETag(entity.etag);
  }

  /**
   * Update entity (merge)
   * PATCH /apiv2/internal/files/{id}
   */
  async patch(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const ifMatch = request.headers['if-match'];
    const dto = UpdateEntityDto.fromRequest(request.body, true);

    const entity = await this.entityService.updateEntity(id, dto, ifMatch);

    return HttpResponse.ok(entity.toDataResponse())
      .withETag(entity.etag);
  }

  /**
   * Delete entity
   * DELETE /apiv2/internal/files/{id}
   */
  async delete(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const ifMatch = request.headers['if-match'];

    await this.entityService.deleteEntity(id, ifMatch);

    return HttpResponse.noContent();
  }

  /**
   * Extract entity id from request path/params
   */
  private extractId(request: HttpRequest): string {
    // Try path parameter first (from router)
    if (request.params.id) {
      return request.params.id;
    }

    // Legacy support: try 'name' parameter
    if (request.params.name) {
      return request.params.name;
    }

    // Fallback: extract from proxy parameter (API Gateway {proxy+})
    const proxyParam = request.params.proxy;
    if (proxyParam?.startsWith('files/')) {
      const afterFiles = proxyParam.slice(6); // Remove "files/"
      if (afterFiles.endsWith('/meta')) {
        return afterFiles.slice(0, -5); // Remove "/meta"
      }
      return afterFiles;
    }

    throw new Error('Unable to extract entity id from request');
  }
}

