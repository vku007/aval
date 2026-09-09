import { Game } from '../../domain/entity/Game.js';
import { Action } from '../../domain/value-object/Action.js';
import { ActionType } from '../../domain/value-object/ActionType.js';
import { ActionContext } from '../../domain/value-object/ActionContext.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { RoundStatus } from '../../domain/value-object/RoundStatus.js';
import { SubRoundStatus } from '../../domain/value-object/SubRoundStatus.js';
import { Move, MoveContext, MoveType } from '../../domain/value-object/Move.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';
import { Logger } from '../../shared/logging/Logger.js';

export const NPC_EXTENDED_MAX_SIZE = 10;

const MOVE_TYPES = [MoveType.Stone, MoveType.Paper, MoveType.Scissors];

/**
 * Decides whether the NPC should throw and builds that Move action.
 * Does not apply the action — GameProcessor.processAction does.
 */
export class NpcActor {
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger();
  }

  /**
   * Next NPC Move, or null if they should not throw.
   */
  nextAction(game: Game): Action | null {
    this.logger.debug('Attempting NPC action', { gameId: game.id, gameStatus: game.status });

    if (game.status === GameStatus.Finished || game.status === GameStatus.Broken) {
      this.logger.warn('Cannot perform NPC action: game is finished or broken', {
        gameId: game.id,
        gameStatus: game.status
      });
      return null;
    }

    const npcId = game.usersIds.find(id => id.startsWith('NPC_'));
    if (!npcId) {
      this.logger.debug('No NPC player found in game', {
        gameId: game.id,
        usersIds: game.usersIds
      });
      return null;
    }

    this.logger.debug('NPC player found', { gameId: game.id, npcId });

    const currentRound = game.getLastRound();
    if (!currentRound || currentRound.status === RoundStatus.Finished) {
      this.logger.debug('No active round available for NPC action', {
        gameId: game.id,
        npcId,
        hasRound: !!currentRound,
        roundStatus: currentRound?.status
      });
      return null;
    }

    this.logger.debug('Active round found', {
      gameId: game.id,
      npcId,
      roundId: currentRound.id,
      roundStatus: currentRound.status
    });

    const lastSubRound = currentRound.getLastSubRound();
    if (!lastSubRound) {
      this.logger.debug('No subround found in current round', {
        gameId: game.id,
        npcId,
        roundId: currentRound.id
      });
      return null;
    }

    this.logger.debug('Subround found', {
      gameId: game.id,
      npcId,
      roundId: currentRound.id,
      subRoundIdNum: lastSubRound.idNum,
      subRoundStatus: lastSubRound.status,
      existingMoves: lastSubRound.moves.length
    });

    if (lastSubRound.moves.find(m => m.userId === npcId)) {
      this.logger.debug('NPC has already moved in this subround', {
        gameId: game.id,
        npcId,
        roundId: currentRound.id,
        subRoundIdNum: lastSubRound.idNum
      });
      return null;
    }

    if (lastSubRound.status !== SubRoundStatus.Init && lastSubRound.status !== SubRoundStatus.WaitPlayer) {
      this.logger.debug('Subround is not in a state that accepts moves', {
        gameId: game.id,
        npcId,
        roundId: currentRound.id,
        subRoundIdNum: lastSubRound.idNum,
        subRoundStatus: lastSubRound.status
      });
      return null;
    }

    const randomMoveType = MOVE_TYPES[Math.floor(Math.random() * MOVE_TYPES.length)];
    const npcSize = this.moveSize(game);

    this.logger.info('Generating NPC move', {
      gameId: game.id,
      npcId,
      roundId: currentRound.id,
      subRoundIdNum: lastSubRound.idNum,
      moveType: randomMoveType
    });

    const npcMove = new Move(npcId, new MoveContext(randomMoveType, npcSize, 0), Date.now());
    return new Action(ActionType.Move, new ActionContext(npcMove));
  }

  /**
   * Classic NPC throws size 0. Extended NPC picks 0..NPC_EXTENDED_MAX_SIZE so same-type size can decide.
   */
  private moveSize(game: Game): number {
    if (game.createContext?.kind === KindOfGame.Extended) {
      return Math.floor(Math.random() * (NPC_EXTENDED_MAX_SIZE + 1));
    }
    return 0;
  }
}
