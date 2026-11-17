import type { Campaign } from './Campaign.js';
import { unitFor } from './CampaignInventory.js';
import type { ServerTile, StoredRules } from './Tile.js';

const LOG_LIMIT = 20;

/**
 * What the player is allowed to know. Stashes, unknown garrisons, and the wager stay off this object.
 */
export function toCampaignView(campaign: Campaign): Record<string, unknown> {
  const view: Record<string, unknown> = {
    id: campaign.id,
    definitionId: campaign.definitionId,
    title: campaign.title,
    rulesetVersion: campaign.rulesetVersion,
    status: campaign.status,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    turnNumber: campaign.turnNumber,
    turns: campaign.turns,
    actionPoints: campaign.actionPoints,
    inventory: campaign.inventory.toJSON(),
    rules: publishedRules(campaign.rules),
    tiles: campaign.tiles.map(tileView),
    activeBattle: campaign.activeBattle
      ? { gameId: campaign.activeBattle.gameId, q: campaign.activeBattle.q, r: campaign.activeBattle.r }
      : null,
    blockedReasons: campaign.blockedReasons(),
    log: [...campaign.log].slice(-LOG_LIMIT).reverse()
  };
  if (campaign.status === 'finished') {
    view.finishReason = campaign.finishReason;
    view.finishedAt = campaign.finishedAt;
  }
  if (campaign.score) {
    view.score = campaign.score;
  }
  return view;
}

function publishedRules(rules: StoredRules): Record<string, unknown> {
  const published: Record<string, unknown> = {
    digCost: { copper: rules.digCost },
    searchCost: { copper: rules.searchCost },
    increaseMinesCost: { copper: rules.increaseMinesCost },
    battleEntry: rules.battleEntry === 'fee' ? 'fee' : 'wager',
    marketplace: rules.marketplace,
    scoreWeights: rules.scoreWeights
  };
  if (rules.battleEntry === 'fee') {
    published.attackFee = { copper: rules.attackFee ?? 0 };
  } else {
    published.battleKit = rules.battleKit ?? {};
  }
  return published;
}

function tileView(tile: ServerTile): Record<string, unknown> {
  if (!tile.revealed) {
    return { q: tile.q, r: tile.r, visibility: 'hidden' };
  }
  if (!tile.enabled) {
    return { q: tile.q, r: tile.r, visibility: 'blocked' };
  }
  if (tile.owner !== 'player') {
    const seen: Record<string, unknown> = {
      q: tile.q,
      r: tile.r,
      visibility: 'seen',
      owner: 'neutral',
      difficulty: tile.difficulty,
      rounds: tile.rounds,
      objective: tile.objective
    };
    if (tile.garrison?.known) {
      seen.garrison = tile.garrison.reveal();
    }
    return seen;
  }
  const product = tile.product ?? 'copper';
  const owned: Record<string, unknown> = {
    q: tile.q,
    r: tile.r,
    visibility: 'owned',
    owner: 'player',
    objective: tile.objective,
    income: { product, perTurn: tile.mines * unitFor(product) },
    mines: tile.mines,
    maxMines: tile.maxMines,
    dugThisTurn: tile.dugThisTurn,
    searchedThisTurn: tile.searchedThisTurn,
    increasedThisTurn: tile.increasedThisTurn,
    searchAvailable: tile.stashes.some(stash => !stash.found)
  };
  if (tile.difficulty) {
    owned.difficulty = tile.difficulty;
  }
  return owned;
}
