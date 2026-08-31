import { Game } from '../../domain/entity/Game.js';
import { Action } from '../../domain/value-object/Action.js';
import { ActionType } from '../../domain/value-object/ActionType.js';
import { ActionContext } from '../../domain/value-object/ActionContext.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { Round } from '../../domain/value-object/Round.js';
import { RoundStatus } from '../../domain/value-object/RoundStatus.js';
import { SubRound } from '../../domain/value-object/SubRound.js';
import { SubRoundStatus } from '../../domain/value-object/SubRoundStatus.js';
import { RoundsLength } from '../../domain/value-object/RoundsLength.js';
import { Move, MoveContext, MoveType } from '../../domain/value-object/Move.js';
import { SimpleGameResolver } from './SimpleGameResolver.js';
import { ValidationError } from '../../shared/errors/index.js';
import { Logger } from '../../shared/logging/Logger.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';

/**
 * Processor for simple game operations.
 */
export class SimpleGameProcessor {
  private readonly logger: Logger;

  constructor(
    private readonly resolver: SimpleGameResolver,
    logger?: Logger
  ) {
    this.logger = logger ?? new Logger();
  }

  /**
   * Processes an action on a game and returns the updated game.
   * If the action type is Surrender, adds surrendering rounds until the winner achieves victory,
   * and changes the game status to finished.
   * @param game - The game to process the action on
   * @param action - The action to process
   * @param userId - The user identifier performing the action
   * @returns The updated game
   */
  processAction(game: Game, action: Action, userId: string): Game {
    // Validate game state - cannot process actions on finished or broken games
    if (game.status === GameStatus.Finished || game.status === GameStatus.Broken) {
      throw new Error(`Cannot process action: game is ${game.status}`);
    }

    // Validate user participation
    if (!game.usersIds.includes(userId)) {
      throw new Error(`User ${userId} is not a participant in this game`);
    }

    // If action type is Surrender, handle current round first, then add surrendering rounds until victory is achieved
    if (action.type === ActionType.Surrender) {
      // First, check if there's a not finished round (in status Current)
      const currentRound = game.rounds.find(round => round.status === RoundStatus.Current);
      
      if (currentRound) {
        // Find the winner - the user from game.usersIds who is not the surrendering userId
        const winnerId = game.usersIds.find(id => id !== userId);
        if (!winnerId) {
          throw new Error(`Cannot find winner: userId ${userId} not found in game usersIds or no other user available`);
        }
        
        const currentTime = Date.now();
        
        // Remove any not finished subrounds in status WaitPlayer
        currentRound.subRounds = currentRound.subRounds.filter(
          subRound => subRound.status !== SubRoundStatus.WaitPlayer
        );
        
        // Create a new surrendered subround for this round
        // todo looks fishy
        // Calculate next idNum based on existing subRounds (if any Done subrounds exist)
        const nextIdNum = currentRound.subRounds.length > 0
          ? Math.max(...currentRound.subRounds.map(sr => sr.idNum)) + 1
          : 1;
        const surrenderedSubRound = new SubRound(nextIdNum, currentTime, currentTime, currentTime);
        surrenderedSubRound.status = SubRoundStatus.Surrendered;
        surrenderedSubRound.winnerId = winnerId;
        currentRound.subRounds.push(surrenderedSubRound);
        
        // Mark the round as finished with the winner
        currentRound.winnerId = winnerId;
        currentRound.status = RoundStatus.Finished;
        currentRound.endTime = currentTime;
      }
      
      // Keep adding surrendering rounds until the winner achieves victory
      while (!this.isVictoryAchieved(game)) {
        this.addSurrendedRound(game, userId);
      }
      // Change game status to finished
      this.endingGame(game);
    }
    
    // If action type is Move, add the move to the current round
    if (action.type === ActionType.Move) {
      // Only process if a move is provided in the context
      if (action.context.move) {
        // Validate that the move's userId matches the provided userId
        if (action.context.move.userId !== userId) {
          throw new Error(`Move userId (${action.context.move.userId}) does not match action userId (${userId})`);
        }
        
        // Find the current active round (last round that is not finished)
        let currentRound = game.getLastRound();
        
        // If no round exists or the last round is finished, create a new round
        const currentTime = Date.now();
        if (!currentRound || currentRound.status === RoundStatus.Finished) {
          currentRound = this.addRound(game);
          // Set the round status to Current if it was just created
          currentRound.setStatus(RoundStatus.Current);
        }
        
        // Get the last subRound from the current round
        let lastSubRound = currentRound.getLastSubRound();
        
        // If no subRound exists or the last one is done, create a new one
        if (!lastSubRound || lastSubRound.status === SubRoundStatus.Done) {
          // Calculate next idNum based on existing subRounds
          const nextIdNum = currentRound.subRounds.length > 0
            ? Math.max(...currentRound.subRounds.map(sr => sr.idNum)) + 1
            : 1;
          const newSubRound = new SubRound(nextIdNum, currentTime, null, currentTime);
          currentRound.subRounds.push(newSubRound);
          lastSubRound = newSubRound;
        }
        
        // Add the move to the subRound
        this.addMoveToSubRound(game, currentRound, lastSubRound, action.context.move, userId);
        // next we need to check if round is finised
        if (lastSubRound.winnerId !== undefined) {
         // set winner of the round
          currentRound.winnerId = lastSubRound.winnerId;
          currentRound.status = RoundStatus.Finished;
          currentRound.endTime = currentTime;
        }
        if(this.isVictoryAchieved(game)) {
          // game is finished
          game.status = GameStatus.Finished;
          
          game.endTime = currentTime;
        }
      }
      // If no move is provided, skip processing (for backward compatibility with tests)
    }
    
    return game;
  }

  /**
   * Adds a new round to the game with the winner being the other user (not the surrendering user).
   * The round is created with Finished status and the winner set to the non-surrendering user.
   * @param game - The game to add the round to
   * @param userId - The user identifier who is surrendering
   * @returns The created Round instance
   */
  addSurrendedRound(game: Game, userId: string): Round {
    // Find the winner - the user from game.usersIds who is not the surrendering userId
    const winnerId = game.usersIds.find(id => id !== userId);
    if (!winnerId) {
      throw new Error(`Cannot find winner: userId ${userId} not found in game usersIds or no other user available`);
    }
    
    // Add a new round with the winner
    const startTime = Date.now();
    const roundNumber = game.rounds.length + 1;
    const roundId = `round-${roundNumber}`;
    const subRound = new SubRound(1, startTime, startTime, startTime); // Finished round, so finishedAt = startTime
    subRound.status = SubRoundStatus.Surrendered;
    subRound.winnerId = winnerId;
    const round = new Round(roundId, RoundStatus.Finished, startTime, winnerId, startTime);
    round.subRounds = [subRound];
    game.addRound(round);
    
    return round;
  }

  /**
   * Creates a new Round and adds it to the game's rounds.
   * The round ID is generated based on its position in the game's rounds array.
   * Modifies the game in place (rounds array is mutable).
   * @param game - The game to add the round to
   * @returns The created Round instance
   */
  addRound(game: Game): Round {
    const startTime = Date.now();
    // Generate round ID based on its position in the rounds array (1-indexed)
    const roundNumber = game.rounds.length + 1;
    const roundId = `round-${roundNumber}`;
    // Create an empty SubRound for the new round
    // status of subRound is Init
    const subRound = new SubRound(1, startTime, null, startTime); // Not finished yet, so finishedAt = null
    // Create a new Round with Pending status
    const round = new Round(roundId, RoundStatus.Pending, startTime);
    round.subRounds = [subRound];
    // Add the round to the game (mutates the game in place)
    game.addRound(round);
    return round;
  }

  /**
   * Checks if any user has achieved victory by counting their wins in finished rounds.
   * Victory is achieved when a user has won Math.trunc(totalRounds/2)+1 or more rounds.
   * @param game - The game to check for victory
   * @returns true if any user has achieved victory, false otherwise
   */
  isVictoryAchieved(game: Game): boolean {
    return this.whoIsWinner(game) !== null;
  }

  /**
   * Determines the winner of the game by counting wins in finished rounds.
   * Victory is achieved when a user has won Math.trunc(totalRounds/2)+1 or more rounds.
   * @param game - The game to check winner
   * @returns The winner's userId if victory is achieved, null otherwise
   */
  whoIsWinner(game: Game): string | null {
    // Get the total number of rounds from game's createContext
    const roundsLength = game.createContext?.rounds;
    if (!roundsLength) {
      return null; // Cannot determine winner without rounds length
    }

    const totalRounds = RoundsLength.amtRounds(roundsLength);
    const victoryThreshold = Math.trunc(totalRounds / 2) + 1;

    // Count victories for each user
    const victoriesByUser = new Map<string, number>();
    
    // Initialize all users with 0 victories
    game.usersIds.forEach(userId => {
      victoriesByUser.set(userId, 0);
    });

    // Count victories from finished rounds
    game.rounds.forEach(round => {
      if (round.status === RoundStatus.Finished && round.winnerId) {
        const currentVictories = victoriesByUser.get(round.winnerId) || 0;
        victoriesByUser.set(round.winnerId, currentVictories + 1);
      }
    });

    // Check if any user has reached the victory threshold
    for (const [userId, victories] of victoriesByUser.entries()) {
      if (victories >= victoryThreshold) {
        return userId;
      }
    }

    return null;
  }

  /**
   * Marks a game as finished by setting its status to Finished and recording the end time.
   * Modifies the game in place.
   * @param game - The game to mark as finished
   */
  endingGame(game: Game): void {
    game.status = GameStatus.Finished;
    game.endTime = Date.now();
    this.resolver.addGameOutcome(game.outcome, game.usersIds[0], this.whoIsWinner(game) === game.usersIds[0]);
    this.resolver.addGameOutcome(game.outcome, game.usersIds[1], this.whoIsWinner(game) === game.usersIds[1]);

    // todo update users by outcome
  }

  /**
   * Initializes a game from its createContext.
   * Changes the game status from Created to Started if applicable.
   * Modifies the game in place.
   * @param game - The game to initialize
   */
  initGameFromContext(game: Game): void {
    // Validate that game has createContext
    if (!game.createContext) {
      this.logger.warn('Cannot initialize game: missing createContext', {
        gameId: game.id
      });
      return;
    }

    // Only initialize if game is in Created status
    if (game.status === GameStatus.Created) {
      this.logger.info('Initializing game from context', {
        gameId: game.id,
        gameType: game.createContext.gameType,
        rounds: game.createContext.rounds,
        kind: game.createContext.kind,
        level: game.createContext.level.name,
        episode: game.createContext.episode.name
      });
      

      game.setStatus(GameStatus.Started);
      
      this.logger.info('Game initialized successfully', {
        gameId: game.id,
        status: game.status
      });
    } else {
      this.logger.debug('Game already initialized or in invalid state', {
        gameId: game.id,
        currentStatus: game.status
      });
    }
  }

  /**
   * Performs an NPC action (move) for the NPC player in a PVE game.
   * Finds the NPC player, checks if it's their turn, generates a random move, and processes it.
   * Modifies the game in place.
   * @param game - The game to perform the NPC action on
   */
  doNpcAction(game: Game): void {
    this.logger.debug('Attempting NPC action', { gameId: game.id, gameStatus: game.status });

    // Validate game state - cannot process actions on finished or broken games
    if (game.status === GameStatus.Finished || game.status === GameStatus.Broken) {
      this.logger.warn('Cannot perform NPC action: game is finished or broken', {
        gameId: game.id,
        gameStatus: game.status
      });
      return;
    }

    // Find the NPC player (typically 'NPC_1')
    const npcId = game.usersIds.find(id => id.startsWith('NPC_'));
    if (!npcId) {
      this.logger.debug('No NPC player found in game', {
        gameId: game.id,
        usersIds: game.usersIds
      });
      return;
    }

    this.logger.debug('NPC player found', { gameId: game.id, npcId });

    // Find the current active round
    const currentRound = game.getLastRound();
    if (!currentRound || currentRound.status === RoundStatus.Finished) {
      this.logger.debug('No active round available for NPC action', {
        gameId: game.id,
        npcId,
        hasRound: !!currentRound,
        roundStatus: currentRound?.status
      });
      return;
    }

    this.logger.debug('Active round found', {
      gameId: game.id,
      npcId,
      roundId: currentRound.id,
      roundStatus: currentRound.status
    });

    // Get the last subRound from the current round
    const lastSubRound = currentRound.getLastSubRound();
    if (!lastSubRound) {
      this.logger.debug('No subround found in current round', {
        gameId: game.id,
        npcId,
        roundId: currentRound.id
      });
      return;
    }

    this.logger.debug('Subround found', {
      gameId: game.id,
      npcId,
      roundId: currentRound.id,
      subRoundIdNum: lastSubRound.idNum,
      subRoundStatus: lastSubRound.status,
      existingMoves: lastSubRound.moves.length
    });

    // Check if NPC has already made a move in this subround
    const npcMove = lastSubRound.moves.find(m => m.userId === npcId);
    if (npcMove) {
      this.logger.debug('NPC has already moved in this subround', {
        gameId: game.id,
        npcId,
        roundId: currentRound.id,
        subRoundIdNum: lastSubRound.idNum
      });
      return;
    }

    // Check if subround is waiting for a player move
    if (lastSubRound.status !== SubRoundStatus.Init && lastSubRound.status !== SubRoundStatus.WaitPlayer) {
      this.logger.debug('Subround is not in a state that accepts moves', {
        gameId: game.id,
        npcId,
        roundId: currentRound.id,
        subRoundIdNum: lastSubRound.idNum,
        subRoundStatus: lastSubRound.status
      });
      return;
    }

    // Generate a random move for the NPC (Stone, Paper, or Scissors)
    const moveTypes = [MoveType.Stone, MoveType.Paper, MoveType.Scissors];
    const randomMoveType = moveTypes[Math.floor(Math.random() * moveTypes.length)];
    
    this.logger.info('Generating NPC move', {
      gameId: game.id,
      npcId,
      roundId: currentRound.id,
      subRoundIdNum: lastSubRound.idNum,
      moveType: randomMoveType
    });

    const currentTime = Date.now();
    const npcMoveContext = new MoveContext(randomMoveType, 0, 0);
    const npcMoveObj = new Move(npcId, npcMoveContext, currentTime);

    // Create an Action with the NPC move
    const actionContext = new ActionContext(npcMoveObj);
    const action = new Action(ActionType.Move, actionContext);

    // Process the action
    try {
      this.processAction(game, action, npcId);
      
      // Log the result
      const updatedSubRound = currentRound.getLastSubRound();
      this.logger.info('NPC action completed successfully', {
        gameId: game.id,
        npcId,
        roundId: currentRound.id,
        subRoundIdNum: updatedSubRound?.idNum,
        moveType: randomMoveType,
        subRoundStatus: updatedSubRound?.status,
        subRoundMoves: updatedSubRound?.moves.length,
        roundStatus: currentRound.status,
        gameStatus: game.status
      });
    } catch (error: any) {
      this.logger.error('Failed to process NPC action', {
        gameId: game.id,
        npcId,
        roundId: currentRound.id,
        subRoundIdNum: lastSubRound.idNum,
        moveType: randomMoveType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Adds a move to a subRound in a round.
   * Modifies the subRound in place (moves, finishedAt, and updatedAt are mutable).
   * @param game - The game containing the round
   * @param round - The round containing the subRound
   * @param subRound - The subRound to add the move to
   * @param move - The move to add
   * @param userId - The user identifier performing the move (for validation)
   */
  addMoveToSubRound(game: Game, round: Round, subRound: SubRound, move: Move, userId: string): void {
    // Validate that the move's userId matches the provided userId
    if (move.userId !== userId) {
      throw new Error(`Move userId (${move.userId}) does not match action userId (${userId})`);
    }
    
    // Validate that the user hasn't already made a move in this subround
    const existingMove = subRound.moves.find(m => m.userId === userId);
    if (existingMove) {
      throw new ValidationError('Second turn in sub round');
    }
    
    const currentTime = Date.now();
    
    // Add the move to the subRound's moves array (mutates in place)
    subRound.moves.push(move);
    // Update timestamps (mutates in place)
    
    subRound.updatedAt = currentTime;


    // move means change content of the game
    if (subRound.status === SubRoundStatus.Init) {
      subRound.status = SubRoundStatus.WaitPlayer;
    }
    // Only calculate result when we have 2 moves (both players have moved)
    if (subRound.status === SubRoundStatus.WaitPlayer && subRound.moves.length >= 2) {
      // here we should compare moves and calculates winner/draw
      this.resolver.calculateSubRoundResult(subRound, game.outcome);
      subRound.status = SubRoundStatus.Done;
      subRound.finishedAt = currentTime;
    }

  }
}
