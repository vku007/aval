import { Game } from '../../domain/entity/Game.js';
import {
  type BattleApplyFacts,
  type BattleApplyResult,
  type Campaign
} from '../../domain/campaign/Campaign.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';
import { RoundStatus } from '../../domain/value-object/RoundStatus.js';
import { Logger } from '../../shared/logging/Logger.js';
import type { CampaignGamePort } from '../services/CampaignGamePort.js';
import { campaignProcessor } from './npcSeed.js';

/**
 * Completes a battle that was debited but never linked, or a linked game that
 * already finished. A missing game document is left open.
 */
export async function repairCampaign(
  campaign: Campaign,
  games: CampaignGamePort,
  logger: Logger,
  now: number
): Promise<Campaign> {
  const battle = campaign.activeBattle;
  if (!battle) {
    return campaign;
  }
  if (!battle.gameId) {
    return campaign.refundOpenAttack(now);
  }
  const loaded = await games.load(battle.gameId);
  if (!loaded) {
    logger.warn('Linked campaign game is missing', {
      campaignId: campaign.id,
      gameId: battle.gameId
    });
    return campaign;
  }
  const facts = factsFromGame(loaded.game, battle.attackId);
  if (facts === 'open') {
    return campaign;
  }
  if (facts === 'unresolved') {
    logger.warn('Linked campaign game finished without a winner', {
      campaignId: campaign.id,
      gameId: battle.gameId
    });
    return campaign;
  }
  return campaign.applyBattle(facts, now).campaign;
}

export function factsFromGame(game: Game, attackId: string): BattleApplyFacts | 'open' | 'unresolved' {
  if (game.status === GameStatus.Created || game.status === GameStatus.Started) {
    return 'open';
  }
  const humanId = game.usersIds[0];
  const npcId = game.usersIds[1];
  if (game.status === GameStatus.Broken) {
    return {
      attackId,
      gameId: game.id,
      kind: 'broken',
      leftovers: emptyLeftovers(),
      playerRoundWins: roundWins(game, humanId),
      npcRoundWins: roundWins(game, npcId)
    };
  }
  if (game.status !== GameStatus.Finished) {
    return 'open';
  }
  const winner = campaignProcessor(game, new Logger()).whoIsWinner(game);
  // A finished extended match with a known length and no seat at the best-of
  // wins is a draw. The attacker loses. Classic, a missing length, and a
  // winner outside the two seats stay unresolved.
  if (winner !== humanId && winner !== npcId && !isExtendedDraw(game, winner)) {
    return 'unresolved';
  }
  const human = game.inventories.find(row => row.userId === humanId);
  const npc = game.inventories.find(row => row.userId === npcId);
  return {
    attackId,
    gameId: game.id,
    kind: winner === humanId ? 'win' : 'loss',
    leftovers: {
      items: human ? { ...human.items } : {},
      currencies: human ? { ...human.currencies } : {}
    },
    npcLeftovers: {
      items: npc ? { ...npc.items } : {},
      currencies: npc ? { ...npc.currencies } : {}
    },
    playerRoundWins: roundWins(game, humanId),
    npcRoundWins: roundWins(game, npcId)
  };
}

export function applyLoadedGame(campaign: Campaign, game: Game, now: number): BattleApplyResult {
  const attackId = game.campaignAttackId ?? campaign.activeBattle?.attackId ?? '';
  const facts = factsFromGame(game, attackId);
  if (facts === 'open' || facts === 'unresolved') {
    return { campaign, outcome: null };
  }
  return campaign.applyBattle(facts, now);
}

function isExtendedDraw(game: Game, winner: string | null): boolean {
  const context = game.createContext;
  return winner === null
    && context?.kind === KindOfGame.Extended
    && Boolean(context.rounds);
}

function roundWins(game: Game, userId: string | undefined): number {
  if (!userId) {
    return 0;
  }
  return game.rounds.filter(round => round.status === RoundStatus.Finished && round.winnerId === userId).length;
}

function emptyLeftovers(): BattleApplyFacts['leftovers'] {
  return { items: {}, currencies: {} };
}
