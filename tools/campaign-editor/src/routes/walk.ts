import { Campaign, type BattleApplyFacts } from '@apiv2/domain/campaign/Campaign.js';
import type { CampaignScoreRecord } from '@apiv2/domain/campaign/CampaignScore.js';
import { buildChapterDefinition } from '@apiv2/domain/campaign/ChapterDefinitionBuilder.js';
import type { ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { positiveCurrencies, positiveItems, type CurrencyStack, type ItemStack } from '@apiv2/domain/campaign/CampaignInventory.js';
import type { Route, RouteStep } from '../model/document.js';
import referenceFile from '../../routes/chapter-i.routes.json';

export type { Route, RouteStep };

export interface StepResult {
  step: RouteStep;
  ok: boolean;
  error?: string;
  turn: number;
  copper: number;
  silver: number;
  owned: number;
}

export interface RouteResult {
  route: Route;
  steps: StepResult[];
  completed: boolean;
  score: CampaignScoreRecord | null;
}

interface CampaignJson {
  turnNumber: number;
  inventory: { currencies: { copper?: number; silver?: number } };
  tiles: { owner?: string }[];
  score?: CampaignScoreRecord;
}

/** The four Chapter I score examples. Each call returns a fresh copy. */
export function referenceRoutes(): Route[] {
  return (referenceFile as Route[]).map((route) => ({
    name: route.name,
    steps: route.steps.map((step) => ({ ...step }))
  }));
}

export function walkRoute(settings: ChapterSettings, route: Route): RouteResult {
  let campaign: Campaign;
  try {
    campaign = Campaign.start(buildChapterDefinition(settings), 0, 'route');
  } catch (error) {
    return failedStart(route, error);
  }

  const steps: StepResult[] = [];
  for (let index = 0; index < route.steps.length; index += 1) {
    const step = route.steps[index];
    const before = readCampaign(campaign);
    try {
      campaign = applyStep(campaign, step, index + 1);
    } catch (error) {
      steps.push({ step, ok: false, error: errorMessage(error), ...before });
      return { route, steps, completed: false, score: null };
    }
    steps.push({ step, ok: true, ...readCampaign(campaign) });
  }

  return { route, steps, completed: true, score: readScore(campaign) };
}

/** Reference routes plus the designer's routes that stop before the last step. */
export function incompleteRouteCount(settings: ChapterSettings, routes: Route[]): number {
  let failing = 0;
  for (const route of [...referenceRoutes(), ...routes]) {
    if (!walkRoute(settings, route).completed) failing += 1;
  }
  return failing;
}

function applyStep(campaign: Campaign, step: RouteStep, n: number): Campaign {
  switch (step.type) {
    case 'end_turn':
      return campaign.endTurn(0);
    case 'dig':
      return campaign.dig(step.q, step.r, 0);
    case 'upgrade':
      return campaign.increaseMines(step.q, step.r, 0);
    case 'search':
      return campaign.search(step.q, step.r, 0).campaign;
    case 'buy':
      return campaign.buy(step.item, step.amount, 0);
    case 'attack':
      return applyAttack(campaign, step, n);
    default: {
      const unreachable: never = step;
      return unreachable;
    }
  }
}

function applyAttack(campaign: Campaign, step: Extract<RouteStep, { type: 'attack' }>, n: number): Campaign {
  const garrison = npcLeftovers(campaign, step.q, step.r);
  const opened = campaign.beginAttack(step.q, step.r, undefined, 'a' + n, n, 0);
  const stake = opened.activeBattle?.committedItems ?? opened.activeBattle?.wager ?? {};
  const kind = step.result ?? 'win';
  const facts: BattleApplyFacts = {
    attackId: 'a' + n,
    gameId: 'g' + n,
    kind,
    leftovers: { items: { ...stake }, currencies: {} },
    playerRoundWins: 0,
    npcRoundWins: 0
  };
  if (kind === 'loss') facts.npcLeftovers = garrison;
  return opened.attachGame('g' + n, 0).applyBattle(facts, 0).campaign;
}

function npcLeftovers(campaign: Campaign, q: number, r: number): { items: ItemStack; currencies: CurrencyStack } {
  const tile = campaign.tiles.find((item) => item.q === q && item.r === r);
  const inventory = tile?.garrison?.inventory;
  if (!inventory) return { items: {}, currencies: {} };
  return {
    items: positiveItems(inventory.items),
    currencies: positiveCurrencies(inventory.currencies)
  };
}

function readCampaign(campaign: Campaign): Pick<StepResult, 'turn' | 'copper' | 'silver' | 'owned'> {
  const json = campaign.toJSON() as CampaignJson;
  return {
    turn: json.turnNumber + 1,
    copper: json.inventory.currencies.copper ?? 0,
    silver: json.inventory.currencies.silver ?? 0,
    owned: json.tiles.filter((tile) => tile.owner === 'player').length
  };
}

function readScore(campaign: Campaign): CampaignScoreRecord | null {
  const json = campaign.toJSON() as CampaignJson;
  return json.score ?? null;
}

function failedStart(route: Route, error: unknown): RouteResult {
  if (route.steps.length === 0) {
    return { route, steps: [], completed: false, score: null };
  }
  return {
    route,
    steps: [
      {
        step: route.steps[0],
        ok: false,
        error: errorMessage(error),
        turn: 1,
        copper: 0,
        silver: 0,
        owned: 0
      }
    ],
    completed: false,
    score: null
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
