import type { BattleApplyFacts } from '../../domain/campaign/Campaign.js';
import type { ItemStack } from '../../domain/campaign/CampaignInventory.js';
import type { TileDifficulty, TileRounds } from '../../domain/campaign/Tile.js';
import { ITEM_KEYS } from '../../domain/value-object/GamePlayerInventory.js';
import { RoundsLength } from '../../domain/value-object/RoundsLength.js';
import { SilentLogger } from '../../shared/logging/SilentLogger.js';
import { AUTOBATTLE_THROW_CAP, playAutobattle } from './Autobattle.js';
import { buildBattleGame } from './BattleGameBuilder.js';
import { factsFromGame } from './Repair.js';

export interface SimulationInput {
  humanItems: ItemStack;
  npcItems: ItemStack;
  rounds: TileRounds;
  levelName: TileDifficulty;
  npcAlgorithmId: string;
  runs: number;
}

export interface SimulationResult {
  runs: number;
  wins: number;
  losses: number;
  capped: number;
  winRate: number;
  cappedRate: number;
  averageRoundWins: { player: number; npc: number };
  itemsSpent: { average: ItemStack; worst: ItemStack };
  garrisonAfterLoss: ItemStack | null;
  secondAttack: { runs: number; winRate: number } | null;
}

const SIM_NOW = 0;

export function simulateBattles(input: SimulationInput): SimulationResult {
  const silent = new SilentLogger();
  let wins = 0;
  let losses = 0;
  let capped = 0;
  let playerRoundWins = 0;
  let npcRoundWins = 0;
  const spent: ItemStack[] = [];
  const lossesInOrder: { playerLeftovers: ItemStack; npcLeftovers: ItemStack }[] = [];

  for (let seed = 1; seed <= input.runs; seed++) {
    const facts = playSeed(input, input.humanItems, input.npcItems, seed, silent);
    if (facts.kind === 'broken') {
      capped += 1;
      continue;
    }
    if (facts.kind === 'win') {
      wins += 1;
    } else {
      losses += 1;
      lossesInOrder.push({
        playerLeftovers: facts.leftovers.items,
        npcLeftovers: facts.npcLeftovers?.items ?? {}
      });
    }
    playerRoundWins += facts.playerRoundWins;
    npcRoundWins += facts.npcRoundWins;
    spent.push(itemsSpent(input.humanItems, facts.leftovers.items));
  }

  const finished = wins + losses;
  let secondWins = 0;
  lossesInOrder.forEach((loss, index) => {
    const lossIndex = index + 1;
    const facts = playSeed(
      input,
      loss.playerLeftovers,
      loss.npcLeftovers,
      input.runs + lossIndex,
      silent
    );
    if (facts.kind === 'win') {
      secondWins += 1;
    }
  });

  return {
    runs: input.runs,
    wins,
    losses,
    capped,
    winRate: rate(wins, input.runs),
    cappedRate: rate(capped, input.runs),
    averageRoundWins: {
      player: finished === 0 ? 0 : round2(playerRoundWins / finished),
      npc: finished === 0 ? 0 : round2(npcRoundWins / finished)
    },
    itemsSpent: {
      average: averageStack(spent),
      worst: worstStack(spent)
    },
    garrisonAfterLoss: losses === 0 ? null : averageStack(lossesInOrder.map(loss => loss.npcLeftovers)),
    secondAttack: losses === 0 ? null : { runs: losses, winRate: rate(secondWins, losses) }
  };
}

function playSeed(
  input: SimulationInput,
  humanItems: ItemStack,
  npcItems: ItemStack,
  seed: number,
  silent: SilentLogger
): BattleApplyFacts {
  const attackId = 'sim-' + seed;
  const game = buildBattleGame({
    userId: 'sim-player',
    campaignId: 'sim',
    attackId,
    seed,
    tile: { q: 0, r: 0 },
    rounds: input.rounds === 'BO7' ? RoundsLength.BO7 : RoundsLength.BO5,
    levelName: input.levelName,
    title: 'Simulation',
    humanItems,
    npcItems,
    npcCurrencies: {},
    npcAlgorithmId: input.npcAlgorithmId
  }, attackId, SIM_NOW);
  playAutobattle(game, AUTOBATTLE_THROW_CAP, silent);
  const facts = factsFromGame(game, attackId);
  if (facts === 'open' || facts === 'unresolved') {
    throw new Error(`Simulation seed ${seed} ended ${facts}`);
  }
  return facts;
}

function itemsSpent(humanItems: ItemStack, leftovers: ItemStack): ItemStack {
  const spent: ItemStack = {};
  for (const key of ITEM_KEYS) {
    const delta = (humanItems[key] ?? 0) - (leftovers[key] ?? 0);
    if (delta !== 0) {
      spent[key] = delta;
    }
  }
  return spent;
}

function averageStack(stacks: ItemStack[]): ItemStack {
  const average: ItemStack = {};
  if (stacks.length === 0) {
    return average;
  }
  for (const key of ITEM_KEYS) {
    let sum = 0;
    for (const stack of stacks) {
      sum += stack[key] ?? 0;
    }
    const value = round2(sum / stacks.length);
    if (value !== 0) {
      average[key] = value;
    }
  }
  return average;
}

function worstStack(stacks: ItemStack[]): ItemStack {
  const worst: ItemStack = {};
  for (const key of ITEM_KEYS) {
    let max: number | null = null;
    for (const stack of stacks) {
      const value = stack[key] ?? 0;
      if (max === null || value > max) {
        max = value;
      }
    }
    if (max !== null && max !== 0) {
      worst[key] = max;
    }
  }
  return worst;
}

function rate(count: number, total: number): number {
  return total === 0 ? 0 : round2(count / total);
}

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}
