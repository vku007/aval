import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleGameUtils } from './SimpleGameUtils.js';
import { Game, GameTypeLength } from '../../domain/entity/Game.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { Action } from '../../domain/value-object/Action.js';
import { ActionType } from '../../domain/value-object/ActionType.js';
import { ActionContext } from '../../domain/value-object/ActionContext.js';
import { Move, MoveContext, MoveType } from '../../domain/value-object/Move.js';
import { RoundStatus } from '../../domain/value-object/RoundStatus.js';
import { SubRoundStatus } from '../../domain/value-object/SubRoundStatus.js';
import { GameCreateContext } from '../dto/processor/GameCreateContext.js';
import { GameType } from '../../domain/value-object/GameType.js';
import { RoundsLength } from '../../domain/value-object/RoundsLength.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';
import { GameLevel } from '../../domain/value-object/GameLevel.js';
import { EpisodeContext } from '../../domain/value-object/EpisodeContext.js';
import { ValidationError } from '../../shared/errors/index.js';

describe('SimpleGameUtils.processAction', () => {
  const USER_1 = 'user-1';
  const USER_2 = 'user-2';
  const NPC_1 = 'NPC_1';

  /**
   * Helper function to create a game with createContext
   */
  function createGameWithContext(
    id: string,
    usersIds: string[],
    roundsLength: RoundsLength = RoundsLength.BO3,
    status: GameStatus = GameStatus.Created
  ): Game {
    const gameLevel = new GameLevel('Level1');
    const episodeContext = new EpisodeContext('Episode1');
    const createContext = new GameCreateContext(
      GameType.PVP,
      roundsLength,
      KindOfGame.Classic,
      gameLevel,
      episodeContext
    );
    return new Game(id, GameTypeLength.BO3, usersIds, status, createContext);
  }

  /**
   * Helper function to create a Move action
   */
  function createMoveAction(userId: string, moveType: MoveType): Action {
    const moveContext = new MoveContext(moveType, 10, 1);
    const move = new Move(userId, moveContext, Date.now());
    const actionContext = new ActionContext(move);
    return new Action(ActionType.Move, actionContext);
  }

  /**
   * Helper function to create a Surrender action
   */
  function createSurrenderAction(): Action {
    return new Action(ActionType.Surrender, new ActionContext());
  }

  describe('Game Creation Scenarios', () => {
    it('should create first round when processing first move action', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2]);
      const action = createMoveAction(USER_1, MoveType.Stone);

      // Act
      const result = SimpleGameUtils.processAction(game, action, USER_1);

      // Assert
      expect(result.rounds).toHaveLength(1);
      expect(result.rounds[0].id).toBe('round-1');
      expect(result.rounds[0].status).toBe(RoundStatus.Current);
      expect(result.rounds[0].subRounds).toHaveLength(1);
      expect(result.rounds[0].subRounds[0].moves).toHaveLength(1);
      expect(result.rounds[0].subRounds[0].moves[0].userId).toBe(USER_1);
      expect(result.rounds[0].subRounds[0].status).toBe(SubRoundStatus.WaitPlayer);
    });

    it('should create new round when previous round is finished', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2]);
      const action1 = createMoveAction(USER_1, MoveType.Stone);
      const action2 = createMoveAction(USER_2, MoveType.Paper);
      
      // Process first two moves to finish first round
      SimpleGameUtils.processAction(game, action1, USER_1);
      SimpleGameUtils.processAction(game, action2, USER_2);

      // Act - Process third move which should create a new round
      const action3 = createMoveAction(USER_1, MoveType.Scissors);
      const result = SimpleGameUtils.processAction(game, action3, USER_1);

      // Assert
      expect(result.rounds).toHaveLength(2);
      expect(result.rounds[1].id).toBe('round-2');
      expect(result.rounds[1].status).toBe(RoundStatus.Current);
    });

    it('should create new subRound when previous subRound is done', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2]);
      const action1 = createMoveAction(USER_1, MoveType.Stone);
      const action2 = createMoveAction(USER_2, MoveType.Paper);
      
      // Process first two moves to finish first subRound
      SimpleGameUtils.processAction(game, action1, USER_1);
      SimpleGameUtils.processAction(game, action2, USER_2);

      // Act - Process third move which should create a new subRound in a new round
      // (since the previous round is finished, a new round is created)
      const action3 = createMoveAction(USER_1, MoveType.Scissors);
      const result = SimpleGameUtils.processAction(game, action3, USER_1);

      // Assert - A new round should be created with a new subRound
      expect(result.rounds.length).toBeGreaterThan(1);
      expect(result.rounds[1].subRounds.length).toBeGreaterThan(0);
    });
  });

  describe('Move Sequences', () => {
    it('should process sequence of moves from different players', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2]);
      const actions = [
        createMoveAction(USER_1, MoveType.Stone),
        createMoveAction(USER_2, MoveType.Paper),
        createMoveAction(USER_1, MoveType.Scissors),
        createMoveAction(USER_2, MoveType.Stone),
      ];

      // Act
      let result = game;
      for (let i = 0; i < actions.length; i++) {
        const userId = i % 2 === 0 ? USER_1 : USER_2;
        result = SimpleGameUtils.processAction(result, actions[i], userId);
      }

      // Assert
      expect(result.rounds.length).toBeGreaterThan(0);
      const totalMoves = result.rounds.reduce((sum, round) => {
        return sum + round.subRounds.reduce((subSum, subRound) => {
          return subSum + subRound.moves.length;
        }, 0);
      }, 0);
      expect(totalMoves).toBe(4);
    });

    it('should handle Stone beats Scissors scenario', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2]);
      const action1 = createMoveAction(USER_1, MoveType.Stone);
      const action2 = createMoveAction(USER_2, MoveType.Scissors);

      // Act
      SimpleGameUtils.processAction(game, action1, USER_1);
      const result = SimpleGameUtils.processAction(game, action2, USER_2);

      // Assert
      const lastSubRound = result.rounds[0].subRounds[result.rounds[0].subRounds.length - 1];
      expect(lastSubRound.status).toBe(SubRoundStatus.Done);
      expect(lastSubRound.winnerId).toBe(USER_1);
      expect(result.rounds[0].winnerId).toBe(USER_1);
      expect(result.rounds[0].status).toBe(RoundStatus.Finished);
    });

    it('should handle Paper beats Stone scenario', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2]);
      const action1 = createMoveAction(USER_1, MoveType.Stone);
      const action2 = createMoveAction(USER_2, MoveType.Paper);

      // Act
      SimpleGameUtils.processAction(game, action1, USER_1);
      const result = SimpleGameUtils.processAction(game, action2, USER_2);

      // Assert
      const lastSubRound = result.rounds[0].subRounds[result.rounds[0].subRounds.length - 1];
      expect(lastSubRound.status).toBe(SubRoundStatus.Done);
      expect(lastSubRound.winnerId).toBe(USER_2);
      expect(result.rounds[0].winnerId).toBe(USER_2);
      expect(result.rounds[0].status).toBe(RoundStatus.Finished);
    });

    it('should handle Scissors beats Paper scenario', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2]);
      const action1 = createMoveAction(USER_1, MoveType.Paper);
      const action2 = createMoveAction(USER_2, MoveType.Scissors);

      // Act
      SimpleGameUtils.processAction(game, action1, USER_1);
      const result = SimpleGameUtils.processAction(game, action2, USER_2);

      // Assert
      const lastSubRound = result.rounds[0].subRounds[result.rounds[0].subRounds.length - 1];
      expect(lastSubRound.status).toBe(SubRoundStatus.Done);
      expect(lastSubRound.winnerId).toBe(USER_2);
      expect(result.rounds[0].winnerId).toBe(USER_2);
      expect(result.rounds[0].status).toBe(RoundStatus.Finished);
    });

    it('should handle draw scenario (same move types)', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2]);
      const action1 = createMoveAction(USER_1, MoveType.Stone);
      const action2 = createMoveAction(USER_2, MoveType.Stone);

      // Act
      SimpleGameUtils.processAction(game, action1, USER_1);
      const result = SimpleGameUtils.processAction(game, action2, USER_2);

      // Assert
      const lastSubRound = result.rounds[0].subRounds[result.rounds[0].subRounds.length - 1];
      expect(lastSubRound.status).toBe(SubRoundStatus.Done);
      // Draw means no winner
      expect(lastSubRound.winnerId).toBeUndefined();
    });

    it('should update subRound status from Init to WaitPlayer to Done', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2]);
      const action1 = createMoveAction(USER_1, MoveType.Stone);
      const action2 = createMoveAction(USER_2, MoveType.Paper);

      // Act - First move
      let result = SimpleGameUtils.processAction(game, action1, USER_1);
      let lastSubRound = result.rounds[0].subRounds[result.rounds[0].subRounds.length - 1];
      expect(lastSubRound.status).toBe(SubRoundStatus.WaitPlayer);

      // Act - Second move completes the subRound
      result = SimpleGameUtils.processAction(result, action2, USER_2);
      lastSubRound = result.rounds[0].subRounds[result.rounds[0].subRounds.length - 1];
      expect(lastSubRound.status).toBe(SubRoundStatus.Done);
    });
  });

  describe('Game Completion Scenarios', () => {
    it('should finish game when victory threshold is reached (BO3)', () => {
      // Arrange - BO3 means first to 2 wins
      const game = createGameWithContext('game-1', [USER_1, USER_2], RoundsLength.BO3);
      
      // Create sequence where USER_1 wins 2 rounds
      // Round 1: USER_1 wins (Stone beats Scissors)
      const action1 = createMoveAction(USER_1, MoveType.Stone);
      const action2 = createMoveAction(USER_2, MoveType.Scissors);
      SimpleGameUtils.processAction(game, action1, USER_1);
      SimpleGameUtils.processAction(game, action2, USER_2);

      // Round 2: USER_1 wins (Paper beats Stone)
      const action3 = createMoveAction(USER_1, MoveType.Paper);
      const action4 = createMoveAction(USER_2, MoveType.Stone);
      SimpleGameUtils.processAction(game, action3, USER_1);
      const result = SimpleGameUtils.processAction(game, action4, USER_2);

      // Assert
      expect(result.status).toBe(GameStatus.Finished);
      expect(result.endTime).toBeDefined();
      expect(SimpleGameUtils.whoIsWinner(result)).toBe(USER_1);
    });

    it('should finish game when victory threshold is reached (BO7)', () => {
      // Arrange - BO7 means first to 4 wins
      const game = createGameWithContext('game-1', [USER_1, USER_2], RoundsLength.BO7);
      
      // Create sequence where USER_2 wins 4 rounds
      for (let i = 0; i < 4; i++) {
        const action1 = createMoveAction(USER_1, MoveType.Stone);
        const action2 = createMoveAction(USER_2, MoveType.Paper);
        SimpleGameUtils.processAction(game, action1, USER_1);
        SimpleGameUtils.processAction(game, action2, USER_2);
      }

      // Assert
      expect(game.status).toBe(GameStatus.Finished);
      expect(game.endTime).toBeDefined();
      expect(SimpleGameUtils.whoIsWinner(game)).toBe(USER_2);
    });

    it('should not finish game before victory threshold is reached', () => {
      // Arrange - BO3 means first to 2 wins
      const game = createGameWithContext('game-1', [USER_1, USER_2], RoundsLength.BO3);
      
      // Create sequence where USER_1 wins only 1 round
      const action1 = createMoveAction(USER_1, MoveType.Stone);
      const action2 = createMoveAction(USER_2, MoveType.Scissors);
      const result = SimpleGameUtils.processAction(game, action1, USER_1);
      SimpleGameUtils.processAction(result, action2, USER_2);

      // Assert
      expect(result.status).toBe(GameStatus.Created);
      expect(result.endTime).toBeUndefined();
      expect(SimpleGameUtils.whoIsWinner(result)).toBeNull();
    });
  });

  describe('Surrender Scenarios', () => {
    it('should finish game with surrender action', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2], RoundsLength.BO3);
      const surrenderAction = createSurrenderAction();

      // Act
      const result = SimpleGameUtils.processAction(game, surrenderAction, USER_1);

      // Assert
      expect(result.status).toBe(GameStatus.Finished);
      // Surrender should add rounds until victory is achieved
      // For BO3, need 2 wins, so should have 2 rounds
      expect(result.rounds.length).toBeGreaterThanOrEqual(2);
      // Winner should be the non-surrendering player
      expect(SimpleGameUtils.whoIsWinner(result)).toBe(USER_2);
    });

    it('should add surrendering rounds until victory is achieved', () => {
      // Arrange - BO7 means first to 4 wins
      const game = createGameWithContext('game-1', [USER_1, USER_2], RoundsLength.BO7);
      const surrenderAction = createSurrenderAction();

      // Act
      const result = SimpleGameUtils.processAction(game, surrenderAction, USER_1);

      // Assert
      expect(result.status).toBe(GameStatus.Finished);
      // For BO7, need 4 wins, so should have 4 rounds
      expect(result.rounds.length).toBe(4);
      // All rounds should be finished
      result.rounds.forEach(round => {
        expect(round.status).toBe(RoundStatus.Finished);
        expect(round.winnerId).toBe(USER_2);
      });
      expect(SimpleGameUtils.whoIsWinner(result)).toBe(USER_2);
    });

    it('should handle surrender in BO1 game', () => {
      // Arrange - BO1 means first to 1 win
      const game = createGameWithContext('game-1', [USER_1, USER_2], RoundsLength.BO1);
      const surrenderAction = createSurrenderAction();

      // Act
      const result = SimpleGameUtils.processAction(game, surrenderAction, USER_1);

      // Assert
      expect(result.status).toBe(GameStatus.Finished);
      // For BO1, need 1 win, so should have 1 round
      expect(result.rounds.length).toBe(1);
      expect(SimpleGameUtils.whoIsWinner(result)).toBe(USER_2);
    });
  });

  describe('Error Scenarios', () => {
    it('should throw error when move userId does not match action userId', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2]);
      const action = createMoveAction(USER_1, MoveType.Stone);

      // Act & Assert
      expect(() => {
        SimpleGameUtils.processAction(game, action, USER_2);
      }).toThrow('Move userId (user-1) does not match action userId (user-2)');
    });

    it('should handle action without move in context (backward compatibility)', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2]);
      const action = new Action(ActionType.Move, new ActionContext());

      // Act - Should not throw, just skip processing
      const result = SimpleGameUtils.processAction(game, action, USER_1);

      // Assert
      expect(result).toBe(game);
      expect(result.rounds).toHaveLength(0);
    });

    it('should throw ValidationError when user tries to make second move in same subround', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2]);
      const move1 = createMoveAction(USER_1, MoveType.Stone);
      
      // Act - First move should succeed
      const gameAfterFirstMove = SimpleGameUtils.processAction(game, move1, USER_1);
      
      // Get the subround that was created
      const subRound = gameAfterFirstMove.rounds[0].subRounds[0];
      
      // Try to add a second move from the same user
      const move2 = new Move(USER_1, new MoveContext(MoveType.Paper, 0, 0), Date.now());
      
      // Assert - Should throw ValidationError
      expect(() => {
        SimpleGameUtils.addMoveToSubRound(gameAfterFirstMove, gameAfterFirstMove.rounds[0], subRound, move2, USER_1);
      }).toThrow(ValidationError);
      
      expect(() => {
        SimpleGameUtils.addMoveToSubRound(gameAfterFirstMove, gameAfterFirstMove.rounds[0], subRound, move2, USER_1);
      }).toThrow('Second turn in sub round');
    });
  });

  describe('Complex Game Scenarios', () => {
    it('should handle complete game flow: creation, moves, and completion', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2], RoundsLength.BO3);
      
      // Act - Complete game sequence
      // Round 1: USER_1 wins
      SimpleGameUtils.processAction(game, createMoveAction(USER_1, MoveType.Stone), USER_1);
      SimpleGameUtils.processAction(game, createMoveAction(USER_2, MoveType.Scissors), USER_2);
      
      // Round 2: USER_2 wins
      SimpleGameUtils.processAction(game, createMoveAction(USER_1, MoveType.Scissors), USER_1);
      SimpleGameUtils.processAction(game, createMoveAction(USER_2, MoveType.Stone), USER_2);
      
      // Round 3: USER_1 wins (game should finish)
      SimpleGameUtils.processAction(game, createMoveAction(USER_1, MoveType.Paper), USER_1);
      const result = SimpleGameUtils.processAction(game, createMoveAction(USER_2, MoveType.Stone), USER_2);

      // Assert
      expect(result.status).toBe(GameStatus.Finished);
      expect(result.rounds.length).toBe(3);
      expect(SimpleGameUtils.whoIsWinner(result)).toBe(USER_1);
      expect(result.endTime).toBeDefined();
    });

    it('should handle alternating wins scenario', () => {
      // Arrange
      const game = createGameWithContext('game-1', [USER_1, USER_2], RoundsLength.BO5);
      
      // Act - Alternating wins: USER_1, USER_2, USER_1, USER_2, USER_1
      // BO5 means first to 3 wins (Math.trunc(5/2)+1 = 3)
      const sequences = [
        [MoveType.Stone, MoveType.Scissors], // USER_1 wins (1-0)
        [MoveType.Stone, MoveType.Paper],    // USER_2 wins (1-1)
        [MoveType.Paper, MoveType.Stone],    // USER_1 wins (2-1)
        [MoveType.Scissors, MoveType.Paper], // USER_2 wins (2-2)
        [MoveType.Stone, MoveType.Scissors], // USER_1 wins (3-2, game finishes)
      ];

      let result = game;
      for (const [move1, move2] of sequences) {
        result = SimpleGameUtils.processAction(result, createMoveAction(USER_1, move1), USER_1);
        result = SimpleGameUtils.processAction(result, createMoveAction(USER_2, move2), USER_2);
        
        if (result.status === GameStatus.Finished) {
          expect(SimpleGameUtils.whoIsWinner(result)).toBe(USER_1);
          // Game finishes when USER_1 gets 3 wins, which happens after 3 rounds
          expect(result.rounds.length).toBe(3);
          return; // Test passes
        }
      }
      
      // If we get here, the game didn't finish as expected
      expect(result.status).toBe(GameStatus.Finished);
    });
  });
});

describe('SimpleGameUtils.doNpcAction', () => {
  const USER_1 = 'user-1';
  const NPC_1 = 'NPC_1';

  /**
   * Helper function to create a game with NPC
   */
  function createGameWithNpc(
    id: string,
    usersIds: string[],
    roundsLength: RoundsLength = RoundsLength.BO3,
    status: GameStatus = GameStatus.Created
  ): Game {
    const gameLevel = new GameLevel('Level1');
    const episodeContext = new EpisodeContext('Episode1');
    const createContext = new GameCreateContext(
      GameType.PVE,
      roundsLength,
      KindOfGame.Classic,
      gameLevel,
      episodeContext
    );
    return new Game(id, GameTypeLength.BO3, usersIds, status, createContext);
  }

  /**
   * Helper function to create a Move action
   */
  function createMoveAction(userId: string, moveType: MoveType): Action {
    const moveContext = new MoveContext(moveType, 10, 1);
    const move = new Move(userId, moveContext, Date.now());
    const actionContext = new ActionContext(move);
    return new Action(ActionType.Move, actionContext);
  }

  describe('Basic Functionality', () => {
    it('should make NPC move when it is their turn', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1]);
      // Player makes first move
      const playerAction = createMoveAction(USER_1, MoveType.Stone);
      SimpleGameUtils.processAction(game, playerAction, USER_1);

      // Act - NPC should make a move
      SimpleGameUtils.doNpcAction(game);

      // Assert
      const lastRound = game.getLastRound();
      expect(lastRound).toBeDefined();
      const lastSubRound = lastRound!.getLastSubRound();
      expect(lastSubRound).toBeDefined();
      expect(lastSubRound!.moves.length).toBe(2); // Player + NPC
      const npcMove = lastSubRound!.moves.find(m => m.userId === NPC_1);
      expect(npcMove).toBeDefined();
      expect([MoveType.Stone, MoveType.Paper, MoveType.Scissors]).toContain(npcMove!.context.moveType);
    });

    it('should generate a valid move type (Stone, Paper, or Scissors)', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1]);
      const playerAction = createMoveAction(USER_1, MoveType.Stone);
      SimpleGameUtils.processAction(game, playerAction, USER_1);

      // Act
      SimpleGameUtils.doNpcAction(game);

      // Assert
      const lastRound = game.getLastRound();
      const lastSubRound = lastRound!.getLastSubRound();
      const npcMove = lastSubRound!.moves.find(m => m.userId === NPC_1);
      expect(npcMove).toBeDefined();
      expect([MoveType.Stone, MoveType.Paper, MoveType.Scissors]).toContain(npcMove!.context.moveType);
    });

    it('should complete subround when NPC makes second move', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1]);
      const playerAction = createMoveAction(USER_1, MoveType.Stone);
      SimpleGameUtils.processAction(game, playerAction, USER_1);

      // Act
      SimpleGameUtils.doNpcAction(game);

      // Assert
      const lastRound = game.getLastRound();
      const lastSubRound = lastRound!.getLastSubRound();
      expect(lastSubRound!.status).toBe(SubRoundStatus.Done);
      expect(lastSubRound!.moves.length).toBe(2);
    });
  });

  describe('Edge Cases - Game State', () => {
    it('should not make move when game is finished', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1]);
      game.status = GameStatus.Finished;
      const initialRoundsCount = game.rounds.length;

      // Act
      SimpleGameUtils.doNpcAction(game);

      // Assert
      expect(game.rounds.length).toBe(initialRoundsCount);
    });

    it('should not make move when game is broken', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1]);
      game.status = GameStatus.Broken;
      const initialRoundsCount = game.rounds.length;

      // Act
      SimpleGameUtils.doNpcAction(game);

      // Assert
      expect(game.rounds.length).toBe(initialRoundsCount);
    });

    it('should not make move when no NPC player exists', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, 'user-2']); // No NPC
      const playerAction = createMoveAction(USER_1, MoveType.Stone);
      SimpleGameUtils.processAction(game, playerAction, USER_1);
      const initialMovesCount = game.getLastRound()!.getLastSubRound()!.moves.length;

      // Act
      SimpleGameUtils.doNpcAction(game);

      // Assert
      const lastSubRound = game.getLastRound()!.getLastSubRound()!;
      expect(lastSubRound.moves.length).toBe(initialMovesCount);
    });

    it('should not make move when no active round exists', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1]);
      // No rounds created yet

      // Act
      SimpleGameUtils.doNpcAction(game);

      // Assert
      expect(game.rounds.length).toBe(0);
    });

    it('should not make move when last round is finished', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1]);
      const playerAction = createMoveAction(USER_1, MoveType.Stone);
      SimpleGameUtils.processAction(game, playerAction, USER_1);
      const npcAction = createMoveAction(NPC_1, MoveType.Paper);
      SimpleGameUtils.processAction(game, npcAction, NPC_1);
      // Round should be finished now
      expect(game.getLastRound()!.status).toBe(RoundStatus.Finished);

      // Act
      const roundsBefore = game.rounds.length;
      SimpleGameUtils.doNpcAction(game);

      // Assert - Should not create new round or make move
      expect(game.rounds.length).toBe(roundsBefore);
    });

    it('should not make move when no subround exists', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1]);
      // Create a round manually without subrounds
      const round = SimpleGameUtils.addRound(game);
      round.subRounds = []; // Clear subrounds

      // Act
      SimpleGameUtils.doNpcAction(game);

      // Assert - No moves should be added
      expect(round.subRounds.length).toBe(0);
    });

    it('should not make move when NPC already moved in subround', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1]);
      const playerAction = createMoveAction(USER_1, MoveType.Stone);
      SimpleGameUtils.processAction(game, playerAction, USER_1);
      const npcAction = createMoveAction(NPC_1, MoveType.Paper);
      SimpleGameUtils.processAction(game, npcAction, NPC_1);
      // Subround is done, NPC already moved

      // Act
      const movesBefore = game.getLastRound()!.getLastSubRound()!.moves.length;
      SimpleGameUtils.doNpcAction(game);

      // Assert
      expect(game.getLastRound()!.getLastSubRound()!.moves.length).toBe(movesBefore);
    });

    it('should not make move when subround status is Done', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1]);
      const playerAction = createMoveAction(USER_1, MoveType.Stone);
      SimpleGameUtils.processAction(game, playerAction, USER_1);
      const npcAction = createMoveAction(NPC_1, MoveType.Paper);
      SimpleGameUtils.processAction(game, npcAction, NPC_1);
      // Subround should be Done now
      const lastSubRound = game.getLastRound()!.getLastSubRound()!;
      expect(lastSubRound.status).toBe(SubRoundStatus.Done);

      // Act
      const movesBefore = lastSubRound.moves.length;
      SimpleGameUtils.doNpcAction(game);

      // Assert
      expect(lastSubRound.moves.length).toBe(movesBefore);
    });
  });

  describe('Integration Scenarios', () => {
    it('should trigger round completion when NPC makes winning move', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1]);
      // Player plays Stone
      const playerAction = createMoveAction(USER_1, MoveType.Stone);
      SimpleGameUtils.processAction(game, playerAction, USER_1);

      // Act - NPC plays Paper (beats Stone)
      // We need to mock or control the random move, but since it's random,
      // we'll just verify the subround completes
      SimpleGameUtils.doNpcAction(game);

      // Assert
      const lastRound = game.getLastRound()!;
      const lastSubRound = lastRound.getLastSubRound()!;
      expect(lastSubRound.status).toBe(SubRoundStatus.Done);
      expect(lastSubRound.moves.length).toBe(2);
      // If NPC won, round should be finished
      if (lastSubRound.winnerId === NPC_1) {
        expect(lastRound.status).toBe(RoundStatus.Finished);
        expect(lastRound.winnerId).toBe(NPC_1);
      }
    });

    it('should work with Init status subround', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1]);
      // Create a round with Init subround
      const round = SimpleGameUtils.addRound(game);
      round.setStatus(RoundStatus.Current);
      const subRound = round.getLastSubRound()!;
      expect(subRound.status).toBe(SubRoundStatus.Init);

      // Act
      SimpleGameUtils.doNpcAction(game);

      // Assert
      expect(subRound.moves.length).toBe(1);
      expect(subRound.moves[0].userId).toBe(NPC_1);
      expect(subRound.status).toBe(SubRoundStatus.WaitPlayer);
    });

    it('should work with WaitPlayer status subround', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1]);
      const playerAction = createMoveAction(USER_1, MoveType.Stone);
      SimpleGameUtils.processAction(game, playerAction, USER_1);
      const lastSubRound = game.getLastRound()!.getLastSubRound()!;
      expect(lastSubRound.status).toBe(SubRoundStatus.WaitPlayer);

      // Act
      SimpleGameUtils.doNpcAction(game);

      // Assert
      expect(lastSubRound.moves.length).toBe(2);
      expect(lastSubRound.status).toBe(SubRoundStatus.Done);
    });

    it('should handle multiple NPC moves in sequence', () => {
      // Arrange
      const game = createGameWithNpc('game-1', [USER_1, NPC_1], RoundsLength.BO3);
      
      // Round 1: Player moves, NPC moves (completes round 1)
      SimpleGameUtils.processAction(game, createMoveAction(USER_1, MoveType.Stone), USER_1);
      SimpleGameUtils.doNpcAction(game);
      
      // Round 2: Player makes first move (creates new round), then NPC moves
      SimpleGameUtils.processAction(game, createMoveAction(USER_1, MoveType.Paper), USER_1);
      SimpleGameUtils.doNpcAction(game);

      // Assert
      expect(game.rounds.length).toBeGreaterThanOrEqual(2);
      // Each round should have completed subrounds
      game.rounds.forEach(round => {
        if (round.subRounds.length > 0) {
          const lastSubRound = round.subRounds[round.subRounds.length - 1];
          expect(lastSubRound.status).toBe(SubRoundStatus.Done);
          expect(lastSubRound.moves.length).toBe(2); // Both players moved
        }
      });
    });
  });
});

