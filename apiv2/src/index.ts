import { S3Client } from '@aws-sdk/client-s3';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

// Configuration
import { loadConfig } from './config/environment.js';

// Domain
import { JsonEntity } from './domain/entity/JsonEntity.js';
import { User } from './domain/entity/User.js';
import { GameEntity } from './domain/entity/GameEntity.js';
import { Round } from './domain/value-object/Round.js';
import type { JsonValue, EntityMetadata } from './shared/types/common.js';

// Infrastructure
import { S3EntityRepository } from './infrastructure/persistence/S3EntityRepository.js';
import { S3UserRepository } from './infrastructure/persistence/S3UserRepository.js';
import { S3GameRepository } from './infrastructure/persistence/S3GameRepository.js';
import { ApiGatewayAdapter } from './infrastructure/http/ApiGatewayAdapter.js';

// Application
import { EntityService } from './application/services/EntityService.js';
import { UserService } from './application/services/UserService.js';
import { GameService } from './application/services/GameService.js';

// Presentation
import { EntityController } from './presentation/controllers/EntityController.js';
import { UserController } from './presentation/controllers/UserController.js';
import { GameController } from './presentation/controllers/GameController.js';
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

// User factory for User entity
const userFactory = (id: string, name: string, externalId: number, etag?: string, metadata?: EntityMetadata) =>
  User.create(id, name, externalId, etag, metadata);

// Game factory for GameEntity
const gameFactory = (id: string, type: string, usersIds: string[], rounds: Round[], isFinished: boolean, etag?: string, metadata?: EntityMetadata) =>
  GameEntity.create(id, type, usersIds, rounds, isFinished, etag, metadata);

// Infrastructure layer - S3Client created inside handler for testability
let s3Client: S3Client;
let entityRepository: S3EntityRepository<JsonEntity>;
let entityService: EntityService<JsonEntity>;
let userRepository: S3UserRepository;
let userService: UserService;
let gameRepository: S3GameRepository;
let gameService: GameService;

function initializeServices() {
  if (!s3Client) {
    s3Client = new S3Client({ region: config.aws.region });
    entityRepository = new S3EntityRepository<JsonEntity>(s3Client, config, entityFactory);
    entityService = new EntityService(entityRepository, logger);
    userRepository = new S3UserRepository(s3Client, config, userFactory);
    userService = new UserService(userRepository, logger);
    gameRepository = new S3GameRepository(s3Client, config, gameFactory);
    gameService = new GameService(gameRepository);
  }
}

// Presentation layer - Controllers created inside handler for testability
let entityController: EntityController;
let userController: UserController;
let gameController: GameController;

// Build error handler
const handleError = errorHandler(logger, config.cors.allowedOrigin);

// Router with middleware - created inside handler for testability
let router: Router;

function createRouter() {
  if (!router) {
    initializeServices();
    entityController = new EntityController(entityService, logger);
    userController = new UserController(userService, logger);
    gameController = new GameController(gameService, logger);
    
    router = new Router()
      .use(corsMiddleware(config))
      .use(contentTypeMiddleware())
      // JsonEntity routes
      .get('/apiv2/files', (req) => entityController.list(req))
      .get('/apiv2/files/:id/meta', (req) => entityController.getMeta(req))
      .get('/apiv2/files/:id', (req) => entityController.get(req))
      .post('/apiv2/files', (req) => entityController.create(req))
      .put('/apiv2/files/:id', (req) => entityController.update(req))
      .patch('/apiv2/files/:id', (req) => entityController.patch(req))
      .delete('/apiv2/files/:id', (req) => entityController.delete(req))
      // User routes
      .get('/apiv2/users', (req) => userController.list(req))
      .get('/apiv2/users/:id/meta', (req) => userController.getMeta(req))
      .get('/apiv2/users/:id', (req) => userController.get(req))
      .post('/apiv2/users', (req) => userController.create(req))
      .put('/apiv2/users/:id', (req) => userController.update(req))
      .patch('/apiv2/users/:id', (req) => userController.patch(req))
      .delete('/apiv2/users/:id', (req) => userController.delete(req))
      // Game routes
      .get('/apiv2/games', (req) => gameController.list(req))
      .get('/apiv2/games/:id/meta', (req) => gameController.getMeta(req))
      .get('/apiv2/games/:id', (req) => gameController.get(req))
      .post('/apiv2/games', (req) => gameController.create(req))
      .put('/apiv2/games/:id', (req) => gameController.update(req))
      .patch('/apiv2/games/:id', (req) => gameController.patch(req))
      .delete('/apiv2/games/:id', (req) => gameController.delete(req))
      // Game-specific operations
      .post('/apiv2/games/:id/rounds', (req) => gameController.addRound(req))
      .post('/apiv2/games/:gameId/rounds/:roundId/moves', (req) => gameController.addMove(req))
      .patch('/apiv2/games/:gameId/rounds/:roundId/finish', (req) => gameController.finishRound(req))
      .patch('/apiv2/games/:id/finish', (req) => gameController.finishGame(req));
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

