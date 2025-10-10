import { S3Client } from '@aws-sdk/client-s3';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

// Configuration
import { loadConfig } from './config/environment.js';

// Domain
import { JsonEntity } from './domain/entity/JsonEntity.js';
import type { JsonValue, EntityMetadata } from './shared/types/common.js';

// Infrastructure
import { S3EntityRepository } from './infrastructure/persistence/S3EntityRepository.js';
import { ApiGatewayAdapter } from './infrastructure/http/ApiGatewayAdapter.js';

// Application
import { EntityService } from './application/services/EntityService.js';

// Presentation
import { EntityController } from './presentation/controllers/EntityController.js';
import { Router } from './presentation/routing/Router.js';
import { corsMiddleware } from './presentation/middleware/cors.js';
import { contentTypeMiddleware } from './presentation/middleware/contentType.js';
import { errorHandler } from './presentation/middleware/errorHandler.js';

// Shared
import { Logger } from './shared/logging/Logger.js';

// ============================================================================
// COMPOSITION ROOT (Dependency Injection)
// ============================================================================

const config = loadConfig();
const logger = new Logger();

// Entity factory for JsonEntity
const entityFactory = (id: string, data: JsonValue, etag?: string, metadata?: EntityMetadata) =>
  new JsonEntity(id, data, etag, metadata);

// Infrastructure layer - S3Client created inside handler for testability
let s3Client: S3Client;
let entityRepository: S3EntityRepository<JsonEntity>;
let entityService: EntityService<JsonEntity>;

function initializeServices() {
  if (!s3Client) {
    s3Client = new S3Client({ region: config.aws.region });
    entityRepository = new S3EntityRepository<JsonEntity>(s3Client, config, entityFactory);
    entityService = new EntityService(entityRepository, logger);
  }
}

// Presentation layer - Controller created inside handler for testability
let entityController: EntityController;

// Build error handler
const handleError = errorHandler(logger, config.cors.allowedOrigin);

// Router with middleware - created inside handler for testability
let router: Router;

function createRouter() {
  if (!router) {
    initializeServices();
    entityController = new EntityController(entityService, logger);
    
    router = new Router()
      .use(corsMiddleware(config))
      .use(contentTypeMiddleware())
      .get('/apiv2/files', (req) => entityController.list(req))
      .get('/apiv2/files/:id/meta', (req) => entityController.getMeta(req))
      .get('/apiv2/files/:id', (req) => entityController.get(req))
      .post('/apiv2/files', (req) => entityController.create(req))
      .put('/apiv2/files/:id', (req) => entityController.update(req))
      .patch('/apiv2/files/:id', (req) => entityController.patch(req))
      .delete('/apiv2/files/:id', (req) => entityController.delete(req));
  }
  return router;
}

// ============================================================================
// LAMBDA HANDLER
// ============================================================================

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  const startTime = Date.now();
  
  logger.setContext({ requestId });

  try {
    // Convert API Gateway event to framework-agnostic request
    const request = ApiGatewayAdapter.toRequest(event);
    
    logger.info('Request received', {
      method: request.method,
      path: request.path,
      query: request.query
    });

    // Route request through middleware and controllers
    const router = createRouter();
    const response = await router.handle(request);

    // Convert back to API Gateway response
    const apiGatewayResponse = ApiGatewayAdapter.toApiGatewayResponse(
      response,
      config.cors.allowedOrigin
    );

    logger.info('Request completed', {
      method: request.method,
      path: request.path,
      status: response.statusCode,
      duration_ms: Date.now() - startTime
    });

    return apiGatewayResponse;
  } catch (error) {
    logger.error('Request failed', {
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startTime
    });

    // Handle error and convert to API Gateway response
    const request = ApiGatewayAdapter.toRequest(event);
    const errorResponse = handleError(error as Error, request);
    
    return ApiGatewayAdapter.toApiGatewayResponse(
      errorResponse,
      config.cors.allowedOrigin
    );
  } finally {
    logger.clearContext();
  }
};

