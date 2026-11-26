import { Game } from '../../domain/entity/Game.js';
import { Action } from '../../domain/value-object/Action.js';
import { ActionContext } from '../../domain/value-object/ActionContext.js';
import { ActionType } from '../../domain/value-object/ActionType.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { gestureItemKey, naEffectItemKey } from '../../domain/value-object/GamePlayerInventory.js';
import { Move, MoveContext, MoveType } from '../../domain/value-object/Move.js';
import { MoveEffect, MoveEffectKind } from '../../domain/value-object/MoveEffect.js';
import { Logger } from '../../shared/logging/Logger.js';
import { campaignProcessor } from './npcSeed.js';

export const AUTOBATTLE_THROW_CAP = 48;

const CYCLE: { type: MoveType; size: number }[] = [
  { type: MoveType.Stone, size: 3 },
  { type: MoveType.Paper, size: 3 },
  { type: MoveType.Scissors, size: 2 },
  { type: MoveType.Stone, size: 3 },
  { type: MoveType.Paper, size: 3 },
  { type: MoveType.Scissors, size: 2 }
];

export interface AutobattleMemory {
  cursor: number;
  stoneThrows: number;
  protectionUsed: boolean;
}

export function freshAutobattleMemory(): AutobattleMemory {
  return { cursor: 0, stoneThrows: 0, protectionUsed: false };
}

/**
 * The next player throw. Size drops to the stock. A gesture at 0 is skipped.
 * The first stone throw spends Overpower when it can be paid. The first throw
 * that can pay NT_effect spends Protection. No legal gesture is Surrender.
 */
export function planPlayerThrow(game: Game, memory: AutobattleMemory): Action {
  const humanId = game.usersIds[0];
  for (let attempt = 0; attempt < CYCLE.length; attempt++) {
    const step = CYCLE[memory.cursor % CYCLE.length];
    memory.cursor += 1;
    const stock = gestureCount(game, humanId, step.type);
    if (stock < 1) {
      continue;
    }
    const size = Math.min(step.size, stock);
    const effects: MoveEffect[] = [];
    if (step.type === MoveType.Stone && memory.stoneThrows === 0 && canPay(game, humanId, naEffectItemKey(step.type))) {
      effects.push(new MoveEffect(MoveEffectKind.Overpower));
    }
    if (step.type === MoveType.Stone) {
      memory.stoneThrows += 1;
    }
    if (!memory.protectionUsed && canPay(game, humanId, 'NT_effect')) {
      effects.push(new MoveEffect(MoveEffectKind.Protection));
      memory.protectionUsed = true;
    }
    const move = new Move(humanId, new MoveContext(step.type, size, 0, effects), Date.now());
    return new Action(ActionType.Move, new ActionContext(move));
  }
  return new Action(ActionType.Surrender, new ActionContext());
}

/**
 * Plays the open match in memory. The caller saves the game once.
 * At the throw cap the game is broken without endingGame, so the entry is refunded.
 */
export function playAutobattle(
  game: Game,
  maxPlayerThrows = AUTOBATTLE_THROW_CAP,
  logger: Logger = new Logger()
): Game {
  const memory = freshAutobattleMemory();
  let playerThrows = 0;
  const humanId = game.usersIds[0];
  while (game.status !== GameStatus.Finished && game.status !== GameStatus.Broken) {
    if (playerThrows >= maxPlayerThrows) {
      game.setStatus(GameStatus.Broken);
      break;
    }
    const processor = campaignProcessor(game, logger);
    processor.playTurn(game, planPlayerThrow(game, memory), humanId);
    playerThrows += 1;
  }
  return game;
}

export function battleHasStarted(game: Game): boolean {
  return game.rounds.length > 0;
}

function gestureCount(game: Game, userId: string, moveType: MoveType): number {
  const row = game.inventories.find(inventory => inventory.userId === userId);
  if (!row) {
    return 0;
  }
  return row.items[gestureItemKey(moveType)];
}

function canPay(game: Game, userId: string, key: 'NT_effect' | 'NA_effect_stone' | 'NA_effect_scissors' | 'NA_effect_papers'): boolean {
  const row = game.inventories.find(inventory => inventory.userId === userId);
  return (row?.items[key] ?? 0) >= 1;
}
