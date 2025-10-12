import { UserService } from '../../application/services/UserService.js';
import { CreateUserDto } from '../../application/dto/CreateUserDto.js';
import { UpdateUserDto } from '../../application/dto/UpdateUserDto.js';
import { HttpRequest, HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import { Logger } from '../../shared/logging/Logger.js';
import { ValidationError, NotFoundError } from '../../shared/errors/index.js';

export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: Logger
  ) {}

  async get(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const ifNoneMatch = request.headers['if-none-match'];

    try {
      const userDto = await this.userService.getUser(id, ifNoneMatch);
      // Get metadata separately for ETag
      const metadata = await this.userService.getUserMetadata(id);
      return HttpResponse.ok(userDto.toJSON())
        .withETag(metadata.etag)
        .withCacheControl('private, max-age=300');
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return HttpResponse.notFound({
          type: 'about:blank',
          title: 'User Not Found',
          status: 404,
          detail: `User '${id}' not found`,
          instance: request.path
        });
      }
      throw error;
    }
  }

  async getMeta(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);

    try {
      const metadata = await this.userService.getUserMetadata(id);
      return HttpResponse.ok(metadata)
        .withETag(metadata.etag)
        .withCacheControl('private, max-age=300');
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return HttpResponse.notFound({
          type: 'about:blank',
          title: 'User Not Found',
          status: 404,
          detail: `User '${id}' not found`,
          instance: request.path
        });
      }
      throw error;
    }
  }

  async create(request: HttpRequest): Promise<HttpResponse> {
    try {
      const dto = CreateUserDto.fromRequest(request.body);
      const ifNoneMatch = request.headers['if-none-match'];
      
      const userDto = await this.userService.createUser(dto, ifNoneMatch);
      const metadata = await this.userService.getUserMetadata(userDto.id);
      
      return HttpResponse.created(userDto.toJSON())
        .withETag(metadata.etag)
        .withLocation(`/apiv2/users/${userDto.id}`);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return HttpResponse.badRequest({
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: error.message,
          instance: request.path,
          field: error.field
        });
      }
      throw error;
    }
  }

  async update(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const ifMatch = request.headers['if-match'];

    try {
      const dto = UpdateUserDto.fromRequest(request.body, false); // Replace strategy
      const userDto = await this.userService.updateUser(id, dto, ifMatch);
      const metadata = await this.userService.getUserMetadata(id);
      
      return HttpResponse.ok(userDto.toJSON())
        .withETag(metadata.etag)
        .withCacheControl('private, max-age=300');
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return HttpResponse.badRequest({
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: error.message,
          instance: request.path,
          field: error.field
        });
      }
      if (error instanceof NotFoundError) {
        return HttpResponse.notFound({
          type: 'about:blank',
          title: 'User Not Found',
          status: 404,
          detail: `User '${id}' not found`,
          instance: request.path
        });
      }
      throw error;
    }
  }

  async patch(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const ifMatch = request.headers['if-match'];

    try {
      const dto = UpdateUserDto.fromRequest(request.body, true); // Merge strategy
      const userDto = await this.userService.updateUser(id, dto, ifMatch);
      const metadata = await this.userService.getUserMetadata(id);
      
      return HttpResponse.ok(userDto.toJSON())
        .withETag(metadata.etag)
        .withCacheControl('private, max-age=300');
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return HttpResponse.badRequest({
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: error.message,
          instance: request.path,
          field: error.field
        });
      }
      if (error instanceof NotFoundError) {
        return HttpResponse.notFound({
          type: 'about:blank',
          title: 'User Not Found',
          status: 404,
          detail: `User '${id}' not found`,
          instance: request.path
        });
      }
      throw error;
    }
  }

  async delete(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const ifMatch = request.headers['if-match'];

    try {
      await this.userService.deleteUser(id, ifMatch);
      return HttpResponse.noContent();
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return HttpResponse.notFound({
          type: 'about:blank',
          title: 'User Not Found',
          status: 404,
          detail: `User '${id}' not found`,
          instance: request.path
        });
      }
      throw error;
    }
  }

  async list(request: HttpRequest): Promise<HttpResponse> {
    const prefix = request.query.prefix || '';
    const limit = request.query.limit ? parseInt(request.query.limit) : undefined;
    const cursor = request.query.cursor;

    try {
      const result = await this.userService.listUsers(prefix, limit, cursor);
      
      return HttpResponse.ok(result)
        .withCacheControl('private, max-age=60');
    } catch (error: any) {
      this.logger.error('Failed to list users', { error: error.message });
      throw error;
    }
  }

  private extractId(request: HttpRequest): string {
    // Support both :id and legacy :name parameters
    if (request.params.id) {
      return request.params.id;
    }
    if (request.params.name) {
      return request.params.name;
    }
    
    // Support proxy parameter for backwards compatibility
    if (request.params.proxy) {
      const proxy = request.params.proxy;
      if (proxy.startsWith('users/')) {
        return proxy.slice(6); // Remove 'users/' prefix
      }
      return proxy;
    }
    
    throw new ValidationError('User ID is required');
  }
}
