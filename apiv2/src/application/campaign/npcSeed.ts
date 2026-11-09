import { Game } from '../../domain/entity/Game.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';
import { Logger } from '../../shared/logging/Logger.js';
import { ClassicGameResolver } from '../utils/ClassicGameResolver.js';
import { ExtendedGameResolver } from '../utils/ExtendedGameResolver.js';
import { GameProcessor } from '../utils/GameProcessor.js';
import { NpcActor } from '../utils/NpcActor.js';
import { SimpleGameOutcomeResolver } from '../utils/SimpleGameOutcomeResolver.js';
import { assertSupportedNpcAlgorithm, NPC_ALGORITHM_V1 } from '../../domain/campaign/Garrison.js';

/** mulberry32. One call advances this stream. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mixSeed(seed: number, npcMoveCount: number): number {
  return (seed ^ Math.imul(npcMoveCount, 0x9E3779B1)) >>> 0;
}

export function countNpcMoves(game: Game): number {
  const npcId = game.usersIds.find(id => id.startsWith('NPC_'));
  if (!npcId) {
    return 0;
  }
  return game.getMovesForUser(npcId).length;
}

/**
 * One NPC decision. The next throw builds a new stream from the higher move count,
 * so a fresh Lambda invocation continues the same sequence.
 */
export function seededNpcRandom(game: Game): () => number {
  const seed = game.campaignBattleSeed ?? 0;
  return mulberry32(mixSeed(seed, countNpcMoves(game)));
}

export function campaignProcessor(game: Game, logger: Logger): GameProcessor {
  const outcome = new SimpleGameOutcomeResolver();
  const resolver = game.createContext?.kind === KindOfGame.Extended
    ? new ExtendedGameResolver(outcome)
    : new ClassicGameResolver(outcome);
  if (game.campaignBattleSeed === undefined) {
    return new GameProcessor(resolver, logger);
  }
  assertSupportedNpcAlgorithm(game.campaignNpcAlgorithmId ?? NPC_ALGORITHM_V1);
  return new GameProcessor(resolver, logger, new NpcActor(logger, seededNpcRandom(game)));
}
