import type { HttpRequest } from '../../infrastructure/http/HttpTypes.js';
import { HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import type { CampaignService } from '../../application/services/CampaignService.js';
import type { Logger } from '../../shared/logging/Logger.js';
import { NotFoundError, PreconditionRequiredError } from '../../shared/errors/index.js';
import {
  CampaignActionSchema,
  FinishCampaignSchema,
  StartCampaignSchema,
  parseCampaignBody
} from '../../application/dto/campaign/campaignSchemas.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

/**
 * Player campaign routes and the admin finish route.
 * If-Match is the user document's ETag.
 */
export class CampaignController {
  constructor(
    private readonly campaigns: CampaignService,
    private readonly logger: Logger
  ) {}

  async catalog(request: HttpRequest): Promise<HttpResponse> {
    const userId = this.requireCaller(request);
    const result = await this.campaigns.catalog(userId, this.profileSeed(request, userId));
    return HttpResponse.ok(result.body).withETag(result.etag);
  }

  async start(request: HttpRequest): Promise<HttpResponse> {
    const userId = this.requireCaller(request);
    const ifMatch = this.requireIfMatch(request);
    const body = parseCampaignBody(StartCampaignSchema, request.body);
    const result = 'settings' in body
      ? await this.campaigns.startFromFile(userId, body.settings, ifMatch)
      : await this.campaigns.start(userId, body.definitionId, ifMatch);
    return HttpResponse.ok(result.body).withETag(result.etag);
  }

  async get(request: HttpRequest): Promise<HttpResponse> {
    const userId = this.requireCaller(request);
    const result = await this.campaigns.get(userId, request.params.id);
    return HttpResponse.ok(result.body).withETag(result.etag);
  }

  async act(request: HttpRequest): Promise<HttpResponse> {
    const userId = this.requireCaller(request);
    const ifMatch = this.requireIfMatch(request);
    const body = parseCampaignBody(CampaignActionSchema, request.body);
    const result = await this.campaigns.act(userId, request.params.id, body, ifMatch);
    return HttpResponse.ok(result.body).withETag(result.etag);
  }

  async finishExternal(request: HttpRequest): Promise<HttpResponse> {
    const ifMatch = this.requireIfMatch(request);
    parseCampaignBody(FinishCampaignSchema, request.body);
    const result = await this.campaigns.finishExternal(request.params.userId, request.params.id, ifMatch);
    return HttpResponse.ok(result.body).withETag(result.etag);
  }

  private requireCaller(request: HttpRequest): string {
    const userId = request.user?.userId;
    if (!userId) {
      this.logger.warn('User ID not found in request', { path: request.path });
      throw new NotFoundError('User profile not found');
    }
    return userId;
  }

  private requireIfMatch(request: HttpRequest): string {
    const header = request.headers['if-match'];
    if (!header) {
      throw new PreconditionRequiredError();
    }
    return header;
  }

  private profileSeed(request: HttpRequest, userId: string): { name: string; externalId: number } {
    const authRequest = request as AuthenticatedRequest;
    const displayName = authRequest.user?.display_name || authRequest.user?.email || 'User';
    const name = displayName.length >= 2 && displayName.length <= 100
      ? displayName
      : (displayName.length < 2 ? 'User' : displayName.substring(0, 100));
    return { name, externalId: externalIdFor(userId) };
  }
}

function externalIdFor(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % 2147483647 + 1;
}
