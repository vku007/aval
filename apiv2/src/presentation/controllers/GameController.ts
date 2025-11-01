import { GameService } from '../../application/services/GameService.js';
import { CreateGameDto } from '../../application/dto/CreateGameDto.js';
import { UpdateGameDto } from '../../application/dto/UpdateGameDto.js';
import { HttpRequest, HttpResponse } from '../../infrastructure/http/HttpTypes.js';
import { Logger } from '../../shared/logging/Logger.js';
import { ValidationError, NotFoundError } from '../../shared/errors/index.js';

export class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly logger: Logger
  ) {}

  async get(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);
    const ifNoneMatch = request.headers['if-none-match'];

    try {
      const gameDto = await this.gameService.getGame(id, ifNoneMatch);
      // Get metadata separately for ETag
      const metadata = await this.gameService.getGameMetadata(id);
      return HttpResponse.ok(gameDto.toJSON())
        .withETag(metadata.etag)
        .withCacheControl('private, must-revalidate');
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return HttpResponse.notFound({
          type: 'about:blank',
          title: 'Game Not Found',
          status: 404,
          detail: `Game '${id}' not found`,
          instance: request.path
        });
      }
      throw error;
    }
  }

  async getMeta(request: HttpRequest): Promise<HttpResponse> {
    const id = this.extractId(request);

    try {
      const metadata = await this.gameService.getGameMetadata(id);
      return HttpResponse.ok(metadata)
        .withETag(metadata.etag)
        .withCacheControl('private, must-revalidate');
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return HttpResponse.notFound({
          type: 'about:blank',
          title: 'Game Not Found',
          status: 404,
          detail: `Game '${id}' not found`,
          instance: request.path
        });
      }
      throw error;
    }
  }

  async create(request: HttpRequest): Promise<HttpResponse> {
    try {
      const dto = CreateGameDto.fromRequest(request.body);
      const ifNoneMatch = request.headers['if-none-match'];
      
      const gameDto = await this.gameService.createGame(dto, ifNoneMatch);
      const metadata = await this.gameService.getGameMetadata(gameDto.id);
      
      return HttpResponse.created(gameDto.toJSON())
        .withETag(metadata.etag)
        .withLocation(`/apiv2/games/${gameDto.id}`);
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
      const dto = UpdateGameDto.fromRequest(request.body, false); // Replace strategy
      const gameDto = await this.gameService.updateGame(id, dto, false, ifMatch);
      const metadata = await this.gameService.getGameMetadata(id);
      
      return HttpResponse.ok(gameDto.toJSON())
        .withETag(metadata.etag)
        .withCacheControl('private, must-revalidate');
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
          title: 'Game Not Found',
          status: 404,
          detail: `Game '${id}' not found`,
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
      const dto = UpdateGameDto.fromRequest(request.body, true); // Merge strategy
      const gameDto = await this.gameService.updateGame(id, dto, true, ifMatch);
      const metadata = await this.gameService.getGameMetadata(id);
      
      return HttpResponse.ok(gameDto.toJSON())
        .withETag(metadata.etag)
        .withCacheControl('private, must-revalidate');
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
          title: 'Game Not Found',
          status: 404,
          detail: `Game '${id}' not found`,
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
      await this.gameService.deleteGame(id, ifMatch);
      return HttpResponse.noContent();
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return HttpResponse.notFound({
          type: 'about:blank',
          title: 'Game Not Found',
          status: 404,
          detail: `Game '${id}' not found`,
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
      const result = await this.gameService.listGames(prefix, limit, cursor);
      
      return HttpResponse.ok(result)
        .withCacheControl('private, must-revalidate');
    } catch (error: any) {
      this.logger.error('Failed to list games', { error: error.message });
      throw error;
    }
  }

  // Game-specific operations
  async addRound(request: HttpRequest): Promise<HttpResponse> {
    const gameId = this.extractId(request);
    const ifMatch = request.headers['if-match'];

    try {
      const roundData = request.body as any;
      const { Round } = await import('../../domain/value-object/Round.js');
      const { Move } = await import('../../domain/value-object/Move.js');
      
      const moves = roundData.moves?.map((moveData: any) => 
        new Move(moveData.id, moveData.userId, moveData.value, moveData.valueDecorated, moveData.time || Date.now())
      ) || [];
      
      const round = new Round(roundData.id, moves, roundData.isFinished || false, roundData.time || Date.now());
      const gameDto = await this.gameService.addRoundToGame(gameId, round, ifMatch);
      const metadata = await this.gameService.getGameMetadata(gameId);
      
      return HttpResponse.ok(gameDto.toJSON())
        .withETag(metadata.etag)
        .withCacheControl('private, must-revalidate');
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return HttpResponse.badRequest({
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: error.message,
          instance: request.path
        });
      }
      if (error instanceof NotFoundError) {
        return HttpResponse.notFound({
          type: 'about:blank',
          title: 'Game Not Found',
          status: 404,
          detail: `Game '${gameId}' not found`,
          instance: request.path
        });
      }
      throw error;
    }
  }

  async addMove(request: HttpRequest): Promise<HttpResponse> {
    const gameId = this.extractGameId(request);
    const roundId = this.extractRoundId(request);
    const ifMatch = request.headers['if-match'];

    try {
      const moveData = request.body as any;
      const { Move } = await import('../../domain/value-object/Move.js');
      
      const move = new Move(moveData.id, moveData.userId, moveData.value, moveData.valueDecorated, moveData.time || Date.now());
      const gameDto = await this.gameService.addMoveToGameRound(gameId, roundId, move, ifMatch);
      const metadata = await this.gameService.getGameMetadata(gameId);
      
      return HttpResponse.ok(gameDto.toJSON())
        .withETag(metadata.etag)
        .withCacheControl('private, must-revalidate');
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return HttpResponse.badRequest({
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: error.message,
          instance: request.path
        });
      }
      if (error instanceof NotFoundError) {
        return HttpResponse.notFound({
          type: 'about:blank',
          title: 'Game Not Found',
          status: 404,
          detail: `Game '${gameId}' not found`,
          instance: request.path
        });
      }
      throw error;
    }
  }

  async finishRound(request: HttpRequest): Promise<HttpResponse> {
    const gameId = this.extractGameId(request);
    const roundId = this.extractRoundId(request);
    const ifMatch = request.headers['if-match'];

    try {
      const gameDto = await this.gameService.finishGameRound(gameId, roundId, ifMatch);
      const metadata = await this.gameService.getGameMetadata(gameId);
      
      return HttpResponse.ok(gameDto.toJSON())
        .withETag(metadata.etag)
        .withCacheControl('private, must-revalidate');
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return HttpResponse.badRequest({
          type: 'about:blank',
          title: 'Validation Error',
          status: 400,
          detail: error.message,
          instance: request.path
        });
      }
      if (error instanceof NotFoundError) {
        return HttpResponse.notFound({
          type: 'about:blank',
          title: 'Game Not Found',
          status: 404,
          detail: `Game '${gameId}' not found`,
          instance: request.path
        });
      }
      throw error;
    }
  }

  async finishGame(request: HttpRequest): Promise<HttpResponse> {
    const gameId = this.extractId(request);
    const ifMatch = request.headers['if-match'];

    try {
      const gameDto = await this.gameService.finishGame(gameId, ifMatch);
      const metadata = await this.gameService.getGameMetadata(gameId);
      
      return HttpResponse.ok(gameDto.toJSON())
        .withETag(metadata.etag)
        .withCacheControl('private, must-revalidate');
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        return HttpResponse.notFound({
          type: 'about:blank',
          title: 'Game Not Found',
          status: 404,
          detail: `Game '${gameId}' not found`,
          instance: request.path
        });
      }
      throw error;
    }
  }

  private extractGameId(request: HttpRequest): string {
    if (request.params.gameId) {
      return request.params.gameId;
    }
    
    // Fallback to extractId for backwards compatibility
    return this.extractId(request);
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
      if (proxy.startsWith('games/')) {
        return proxy.slice(6); // Remove 'games/' prefix
      }
      return proxy;
    }
    
    throw new ValidationError('Game ID is required');
  }

  private extractRoundId(request: HttpRequest): string {
    if (request.params.roundId) {
      return request.params.roundId;
    }
    
    // Extract from path like /games/{gameId}/rounds/{roundId}/moves
    const pathParts = request.path.split('/');
    const roundsIndex = pathParts.findIndex(part => part === 'rounds');
    if (roundsIndex !== -1 && roundsIndex + 1 < pathParts.length) {
      return pathParts[roundsIndex + 1];
    }
    
    throw new ValidationError('Round ID is required');
  }
}
