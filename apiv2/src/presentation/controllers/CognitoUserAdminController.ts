import { HttpRequest, HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { Logger } from '../../shared/logging/Logger.js';
import { CognitoUserAdminService } from '../../application/services/CognitoUserAdminService.js';
import { AuditLogService } from '../../application/services/AuditLogService.js';
import { CognitoUserAdminDto, type Actor } from '../../application/dto/CognitoUserAdminDto.js';
import { ValidationError } from '../../shared/errors/index.js';
import type { CognitoGroupName } from '../../infrastructure/cognito/CognitoAdminClient.js';
import { COGNITO_GROUPS } from '../../infrastructure/cognito/CognitoAdminClient.js';

export class CognitoUserAdminController {
  constructor(
    private readonly service: CognitoUserAdminService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: Logger
  ) {}

  async list(request: HttpRequest): Promise<HttpResponse> {
    this.logger.info('Listing Cognito users', {
      emailPrefix: request.query.emailPrefix,
      group: request.query.group
    });
    const groupParam = request.query.group;
    const group = groupParam ? this.parseGroup(groupParam) : undefined;
    const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : undefined;
    const result = await this.service.list({
      emailPrefix: request.query.emailPrefix,
      group,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor: request.query.cursor
    });
    return HttpResponse.ok(result).withCacheControl('private, no-store');
  }

  async get(request: HttpRequest): Promise<HttpResponse> {
    const username = this.extractUsername(request);
    const user = await this.service.get(username);
    return HttpResponse.ok(user).withCacheControl('private, no-store');
  }

  async create(request: HttpRequest): Promise<HttpResponse> {
    const dto = CognitoUserAdminDto.parseCreate(request.body);
    const user = await this.service.create(dto, this.actor(request));
    return HttpResponse.created(user)
      .withLocation(`/apiv2/internal/cognito-users/${encodeURIComponent(user.username)}`);
  }

  async update(request: HttpRequest): Promise<HttpResponse> {
    const username = this.extractUsername(request);
    const dto = CognitoUserAdminDto.parseUpdate(request.body);
    const user = await this.service.update(username, dto, this.actor(request));
    return HttpResponse.ok(user);
  }

  async delete(request: HttpRequest): Promise<HttpResponse> {
    const username = this.extractUsername(request);
    await this.service.delete(username, this.actor(request));
    return HttpResponse.noContent();
  }

  async upsertGameProfile(request: HttpRequest): Promise<HttpResponse> {
    const username = this.extractUsername(request);
    const dto = CognitoUserAdminDto.parseUpsertGameProfile(request.body);
    const user = await this.service.upsertGameProfile(username, dto, this.actor(request));
    return HttpResponse.ok(user);
  }

  async patchGameProfile(request: HttpRequest): Promise<HttpResponse> {
    const username = this.extractUsername(request);
    const dto = CognitoUserAdminDto.parsePatchGameProfile(request.body);
    const user = await this.service.patchGameProfile(username, dto, this.actor(request));
    return HttpResponse.ok(user);
  }

  async listGames(request: HttpRequest): Promise<HttpResponse> {
    const username = this.extractUsername(request);
    const result = await this.service.listGames(username);
    return HttpResponse.ok(result).withCacheControl('private, no-store');
  }

  async listAuditLogs(request: HttpRequest): Promise<HttpResponse> {
    const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : undefined;
    const result = await this.auditLogService.list({
      targetSub: request.query.targetSub,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor: request.query.cursor
    });
    return HttpResponse.ok(result).withCacheControl('private, no-store');
  }

  private extractUsername(request: HttpRequest): string {
    const username = request.params.username;
    if (!username) {
      throw new ValidationError('Username is required');
    }
    return username;
  }

  private actor(request: HttpRequest): Actor {
    const auth = request as AuthenticatedRequest;
    return {
      sub: auth.user?.sub || auth.user?.userId || '',
      email: auth.user?.email || ''
    };
  }

  private parseGroup(value: string): CognitoGroupName {
    if (!COGNITO_GROUPS.includes(value as CognitoGroupName)) {
      throw new ValidationError('group must be admin, user, or guest');
    }
    return value as CognitoGroupName;
  }
}
