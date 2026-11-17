import { Game } from '../../domain/entity/Game.js';
import { Action } from '../../domain/value-object/Action.js';
import { ActionType } from '../../domain/value-object/ActionType.js';
import { ActionContext } from '../../domain/value-object/ActionContext.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { RoundStatus } from '../../domain/value-object/RoundStatus.js';
import { SubRoundStatus } from '../../domain/value-object/SubRoundStatus.js';
import { Move, MoveContext, MoveType } from '../../domain/value-object/Move.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';
import { gestureItemKey } from '../../domain/value-object/GamePlayerInventory.js';
import { Logger } from '../../shared/logging/Logger.js';

const MOVE_TYPES = [MoveType.Stone, MoveType.Paper, MoveType.Scissors];

/** Random extended size, 1 through min(turn cap, stock). */
export const NPC_1 = 'NPC_1';
/** Extended size is always 1 when no size policy is passed. */
export const NPC_GREED_1 = 'NPC_greed_1';

/** `spread` is 1 through min(turn cap, stock). `minimum` is always 1. */
export type NpcSizePolicy = 'spread' | 'minimum';

/**
 * Decides the NPC's next action.
 * Extended throws use only a type the inventory can pay for.
 * A `spread` policy, and `NPC_1` with no policy, pick a size from 1 through min(turn cap, stock).
 * A `minimum` policy, and `NPC_greed_1` with no policy, throw size 1.
 * An empty extended inventory is a Surrender. Classic still throws size 0.
 * Does not apply the action — GameProcessor.processAction does.
 */
export class NpcActor {
  private readonly logger: Logger;
  private readonly random: () => number;

  constructor(logger?: Logger, random?: () => number, private readonly sizePolicy?: NpcSizePolicy) {
    this.logger = logger ?? new Logger();
    this.random = random ?? (() => Math.random());
  }

  /**
   * Next NPC Move or Surrender, or null if they should not act.
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

    if (game.createContext?.kind === KindOfGame.Extended) {
      return this.extendedAction(game, npcId, currentRound.id, lastSubRound.idNum);
    }

    const randomMoveType = MOVE_TYPES[Math.floor(this.random() * MOVE_TYPES.length)];
    this.logger.info('Generating NPC move', {
      gameId: game.id,
      npcId,
      roundId: currentRound.id,
      subRoundIdNum: lastSubRound.idNum,
      moveType: randomMoveType
    });

    const npcMove = new Move(npcId, new MoveContext(randomMoveType, 0, 0), Date.now());
    return new Action(ActionType.Move, new ActionContext(npcMove));
  }

  /**
   * A playable type has at least one item and a turn cap of at least 1.
   * No such type means Surrender.
   * A `minimum` policy spends size 1. A `spread` policy spends 1..min(cap, stock).
   * With no policy, `NPC_greed_1` spends size 1 and any other seat spends 1..min(cap, stock).
   */
  private extendedAction(game: Game, npcId: string, roundId: string, subRoundIdNum: number): Action {
    const playable = MOVE_TYPES.filter(moveType =>
      this.gestureCount(game, npcId, moveType) >= 1 && this.turnCap(game, moveType) >= 1
    );
    if (playable.length === 0) {
      this.logger.info('NPC surrenders because no move can be paid', {
        gameId: game.id,
        npcId,
        roundId,
        subRoundIdNum
      });
      return new Action(ActionType.Surrender, new ActionContext());
    }

    const moveType = playable[Math.floor(this.random() * playable.length)];
    const npcSize = this.moveSize(game, npcId, moveType);
    this.logger.info('Generating NPC move', {
      gameId: game.id,
      npcId,
      roundId,
      subRoundIdNum,
      moveType,
      size: npcSize
    });

    const npcMove = new Move(npcId, new MoveContext(moveType, npcSize, 0), Date.now());
    return new Action(ActionType.Move, new ActionContext(npcMove));
  }

  /** Playable types already have stock and a cap of at least 1. */
  private moveSize(game: Game, npcId: string, moveType: MoveType): number {
    if (this.throwsMinimum(npcId)) {
      return 1;
    }
    const available = this.gestureCount(game, npcId, moveType);
    const maxSize = Math.min(this.turnCap(game, moveType), available);
    return 1 + Math.floor(this.random() * maxSize);
  }

  /** An explicit policy wins over the seated id. */
  private throwsMinimum(npcId: string): boolean {
    if (this.sizePolicy === 'minimum') {
      return true;
    }
    if (this.sizePolicy === 'spread') {
      return false;
    }
    return npcId === NPC_GREED_1;
  }

  private turnCap(game: Game, moveType: MoveType): number {
    return game.createContext?.capFor(moveType) ?? 0;
  }

  private gestureCount(game: Game, userId: string, moveType: MoveType): number {
    const inventory = game.inventories.find(item => item.userId === userId);
    if (!inventory) {
      return 0;
    }
    return inventory.items[gestureItemKey(moveType)];
  }
}
