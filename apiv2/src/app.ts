import { S3Client } from '@aws-sdk/client-s3';

import { loadConfig } from './config/environment.js';
import { JsonEntity } from './domain/entity/JsonEntity.js';
import { User } from './domain/entity/User.js';
import { GameEntity } from './domain/entity/GameEntity.js';
import { Round } from './domain/value-object/Round.js';
import { GameStatus } from './domain/value-object/GameStatus.js';
import type { JsonValue, EntityMetadata } from './shared/types/common.js';
import type { IEntityRepository } from './domain/repository/IEntityRepository.js';
import { S3EntityRepository } from './infrastructure/persistence/S3EntityRepository.js';
import { S3UserRepository } from './infrastructure/persistence/S3UserRepository.js';
import { S3GameRepository } from './infrastructure/persistence/S3GameRepository.js';
import { LocalJsonStore } from './infrastructure/persistence/LocalJsonStore.js';
import { FileEntityRepository } from './infrastructure/persistence/FileEntityRepository.js';
import { FileUserRepository } from './infrastructure/persistence/FileUserRepository.js';
import { FileGameRepository } from './infrastructure/persistence/FileGameRepository.js';
import type { HttpRequest } from './infrastructure/http/HttpTypes.js';
import { EntityService } from './application/services/EntityService.js';
import { UserService, type IUserRepository } from './application/services/UserService.js';
import { GameService, type IGameRepository } from './application/services/GameService.js';
import { GameProcessorService } from './application/services/GameProcessorService.js';
import { EntityController } from './presentation/controllers/EntityController.js';
import { UserController } from './presentation/controllers/UserController.js';
import { GameController } from './presentation/controllers/GameController.js';
import { ExternalController } from './presentation/controllers/ExternalController.js';
import { AuthController } from './presentation/controllers/AuthController.js';
import { CognitoUserAdminController } from './presentation/controllers/CognitoUserAdminController.js';
import { CognitoUserAdminService } from './application/services/CognitoUserAdminService.js';
import { AuditLogService } from './application/services/AuditLogService.js';
import type { IAuditLogRepository } from './application/dto/AuditLogDto.js';
import { S3AuditLogRepository } from './infrastructure/persistence/S3AuditLogRepository.js';
import { FileAuditLogRepository } from './infrastructure/persistence/FileAuditLogRepository.js';
import { AwsCognitoAdminClient } from './infrastructure/cognito/AwsCognitoAdminClient.js';
import { Router } from './presentation/routing/Router.js';
import { corsMiddleware } from './presentation/middleware/cors.js';
import { contentTypeMiddleware } from './presentation/middleware/contentType.js';
import { errorHandler } from './presentation/middleware/errorHandler.js';
import { authMiddleware } from './presentation/middleware/auth.js';
import { requireRole } from './presentation/middleware/requireRole.js';
import { Logger } from './shared/logging/Logger.js';

export const config = loadConfig();
export const logger = new Logger();
export const handleError = errorHandler(logger, config.cors.allowedOrigin);

const entityFactory = (id: string, data: JsonValue, etag?: string, metadata?: EntityMetadata) =>
  new JsonEntity(id, data, etag, metadata);

const userFactory = (id: string, name: string, externalId: number, etag?: string, metadata?: EntityMetadata) =>
  User.create(id, name, externalId, etag, metadata);

const gameFactory = (id: string, usersIds: string[], rounds: Round[], isFinished: boolean, etag?: string, metadata?: EntityMetadata) => {
  const status = isFinished ? GameStatus.Finished : GameStatus.Created;
  return GameEntity.create(id, usersIds, rounds, status, etag, metadata);
};

let initialized = false;
let entityRepository: IEntityRepository<JsonEntity>;
let entityService: EntityService<JsonEntity>;
let userRepository: IUserRepository;
let userService: UserService;
let gameRepository: IGameRepository;
let gameService: GameService;
let entityController: EntityController<JsonEntity>;
let userController: UserController;
let gameController: GameController;
let externalController: ExternalController;
let authController: AuthController;
let gameProcessorService: GameProcessorService;
let auditLogRepository: IAuditLogRepository;
let auditLogService: AuditLogService;
let cognitoUserAdminService: CognitoUserAdminService;
let cognitoUserAdminController: CognitoUserAdminController;
let router: Router;

function initializeServices() {
  if (initialized) {
    return;
  }
  initialized = true;

  const dataDir = process.env.DATA_DIR;
  if (dataDir) {
    const store = new LocalJsonStore(dataDir);
    entityRepository = new FileEntityRepository<JsonEntity>(store, config, entityFactory);
    userRepository = new FileUserRepository(store, config, userFactory);
    gameRepository = new FileGameRepository(store, config, gameFactory);
    auditLogRepository = new FileAuditLogRepository(store, config);
    logger.info('Using filesystem persistence', { dataDir });
  } else {
    const s3Client = new S3Client({ region: config.aws.region });
    entityRepository = new S3EntityRepository<JsonEntity>(s3Client, config, entityFactory);
    userRepository = new S3UserRepository(s3Client, config, userFactory);
    gameRepository = new S3GameRepository(s3Client, config, gameFactory);
    auditLogRepository = new S3AuditLogRepository(s3Client, config);
  }

  entityService = new EntityService(entityRepository, logger);
  userService = new UserService(userRepository, logger);
  gameService = new GameService(gameRepository);
  auditLogService = new AuditLogService(auditLogRepository, logger);
}

export function createRouter(): Router {
  if (!router) {
    initializeServices();
    gameProcessorService = new GameProcessorService(gameRepository);
    entityController = new EntityController(entityService, logger);
    userController = new UserController(userService, logger);
    gameController = new GameController(gameService, logger);
    externalController = new ExternalController(userService, logger, gameProcessorService);
    authController = new AuthController(logger, userService);
    cognitoUserAdminService = new CognitoUserAdminService(
      new AwsCognitoAdminClient(),
      userService,
      gameService,
      auditLogService,
      logger
    );
    cognitoUserAdminController = new CognitoUserAdminController(
      cognitoUserAdminService,
      auditLogService,
      logger
    );

    const adminOnly = () => [authMiddleware(), requireRole('admin')];
    const authenticated = () => [authMiddleware()];

    router = new Router()
      .use(corsMiddleware(config))
      .use(contentTypeMiddleware())

      .post('/apiv2/public/create-guest', (req: HttpRequest) => authController.createGuestUser(req))
      .post('/apiv2/public/login', (req: HttpRequest) => authController.login(req))

      .get('/apiv2/external/me', ...authenticated(), (req: HttpRequest) => externalController.getMe(req))
      .post('/apiv2/external/promote', ...authenticated(), (req: HttpRequest) => authController.promoteGuestToRegular(req))
      .post('/apiv2/external/games', ...authenticated(), (req: HttpRequest) => externalController.createGame(req))
      .get('/apiv2/external/games/:gameId', ...authenticated(), (req: HttpRequest) => externalController.getGame(req))
      .put('/apiv2/external/games/:gameId', ...authenticated(), (req: HttpRequest) => externalController.updateGame(req))
      .patch('/apiv2/external/games/:gameId', ...authenticated(), (req: HttpRequest) => externalController.updateGame(req))

      .get('/apiv2/internal/files', ...adminOnly(), (req: HttpRequest) => entityController.list(req))
      .get('/apiv2/internal/files/:id/meta', ...adminOnly(), (req: HttpRequest) => entityController.getMeta(req))
      .get('/apiv2/internal/files/:id', ...adminOnly(), (req: HttpRequest) => entityController.get(req))
      .post('/apiv2/internal/files', ...adminOnly(), (req: HttpRequest) => entityController.create(req))
      .put('/apiv2/internal/files/:id', ...adminOnly(), (req: HttpRequest) => entityController.update(req))
      .patch('/apiv2/internal/files/:id', ...adminOnly(), (req: HttpRequest) => entityController.patch(req))
      .delete('/apiv2/internal/files/:id', ...adminOnly(), (req: HttpRequest) => entityController.delete(req))

      .get('/apiv2/internal/cognito-users', ...adminOnly(), (req: HttpRequest) => cognitoUserAdminController.list(req))
      .post('/apiv2/internal/cognito-users', ...adminOnly(), (req: HttpRequest) => cognitoUserAdminController.create(req))
      .get('/apiv2/internal/cognito-users/:username/games', ...adminOnly(), (req: HttpRequest) => cognitoUserAdminController.listGames(req))
      .put('/apiv2/internal/cognito-users/:username/game-profile', ...adminOnly(), (req: HttpRequest) => cognitoUserAdminController.upsertGameProfile(req))
      .patch('/apiv2/internal/cognito-users/:username/game-profile', ...adminOnly(), (req: HttpRequest) => cognitoUserAdminController.patchGameProfile(req))
      .get('/apiv2/internal/cognito-users/:username', ...adminOnly(), (req: HttpRequest) => cognitoUserAdminController.get(req))
      .patch('/apiv2/internal/cognito-users/:username', ...adminOnly(), (req: HttpRequest) => cognitoUserAdminController.update(req))
      .delete('/apiv2/internal/cognito-users/:username', ...adminOnly(), (req: HttpRequest) => cognitoUserAdminController.delete(req))
      .get('/apiv2/internal/audit-logs', ...adminOnly(), (req: HttpRequest) => cognitoUserAdminController.listAuditLogs(req))

      .get('/apiv2/internal/users', ...adminOnly(), (req: HttpRequest) => userController.list(req))
      .get('/apiv2/internal/users/:id/meta', ...adminOnly(), (req: HttpRequest) => userController.getMeta(req))
      .get('/apiv2/internal/users/:id', ...adminOnly(), (req: HttpRequest) => userController.get(req))
      .post('/apiv2/internal/users', ...adminOnly(), (req: HttpRequest) => userController.create(req))
      .put('/apiv2/internal/users/:id', ...adminOnly(), (req: HttpRequest) => userController.update(req))
      .patch('/apiv2/internal/users/:id', ...adminOnly(), (req: HttpRequest) => userController.patch(req))
      .delete('/apiv2/internal/users/:id', ...adminOnly(), (req: HttpRequest) => userController.delete(req))

      .get('/apiv2/internal/games', ...adminOnly(), (req: HttpRequest) => gameController.list(req))
      .get('/apiv2/internal/games/:id/meta', ...adminOnly(), (req: HttpRequest) => gameController.getMeta(req))
      .get('/apiv2/internal/games/:id', ...adminOnly(), (req: HttpRequest) => gameController.get(req))
      .post('/apiv2/internal/games', ...adminOnly(), (req: HttpRequest) => gameController.create(req))
      .put('/apiv2/internal/games/:id', ...adminOnly(), (req: HttpRequest) => gameController.update(req))
      .patch('/apiv2/internal/games/:id', ...adminOnly(), (req: HttpRequest) => gameController.patch(req))
      .delete('/apiv2/internal/games/:id', ...adminOnly(), (req: HttpRequest) => gameController.delete(req))

      .post('/apiv2/internal/games/:id/rounds', ...adminOnly(), (req: HttpRequest) => gameController.addRound(req))
      .post('/apiv2/internal/games/:gameId/rounds/:roundId/moves', ...adminOnly(), (req: HttpRequest) => gameController.addMove(req))
      .patch('/apiv2/internal/games/:gameId/rounds/:roundId/finish', ...adminOnly(), (req: HttpRequest) => gameController.finishRound(req))
      .patch('/apiv2/internal/games/:id/finish', ...adminOnly(), (req: HttpRequest) => gameController.finishGame(req));
  }
  return router;
}
