import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import {
  CURRENCY_KEYS,
  ITEM_KEYS,
  type InventoryCurrencyKey,
  type InventoryItemKey
} from '../value-object/GamePlayerInventory.js';
import type { CampaignDefinition } from './CampaignDefinition.js';
import {
  CampaignInventory,
  positiveCurrencies,
  positiveItems,
  unitFor,
  type CurrencyStack,
  type ItemStack,
  type MineProduct
} from './CampaignInventory.js';
import { campaignScore, type CampaignScoreRecord } from './CampaignScore.js';
import { Garrison, NPC_ALGORITHM_V1 } from './Garrison.js';
import { aligned, neighborsOnMap, onMap, sameAxial, type Axial } from './Hex.js';
import type {
  ActiveBattleState,
  CampaignLogEntry,
  CampaignLogType,
  ResolvedAttack,
  ServerTile,
  StoredRules
} from './Tile.js';

export type CampaignStatus = 'started' | 'finished';
export type FinishReason = 'victory' | 'abandoned' | 'external';
export type BattleResultKind = 'win' | 'loss' | 'broken';

export interface BattleApplyFacts {
  attackId: string;
  gameId: string;
  kind: BattleResultKind;
  leftovers: { items: ItemStack; currencies: CurrencyStack };
  /** NPC row after the match. A loss writes this onto the tile garrison. */
  npcLeftovers?: { items: ItemStack; currencies: CurrencyStack };
  playerRoundWins: number;
  npcRoundWins: number;
}

export interface BattleOutcome {
  result: 'victory' | 'defeat';
  playerRoundWins: number;
  npcRoundWins: number;
  q: number;
  r: number;
  captured: boolean;
  reward: { items: ItemStack; currencies: CurrencyStack } | null;
  spent: { items: ItemStack };
  /** Present on a defeat, after the garrison has been reduced to this stock. */
  garrison?: { npcAlgorithmId: string; inventory: ReturnType<CampaignInventory['toJSON']> };
}

export interface BattleApplyResult {
  campaign: Campaign;
  outcome: BattleOutcome | null;
}

interface CampaignState {
  id: string;
  definitionId: string;
  title: string;
  rulesetVersion: number;
  status: CampaignStatus;
  finishReason?: FinishReason;
  finishedAt?: number;
  createdAt: number;
  updatedAt: number;
  turnNumber: number;
  actionPoints: number;
  inventory: CampaignInventory;
  startingInventory: { items: ItemStack; currencies: CurrencyStack };
  rules: StoredRules;
  tiles: ServerTile[];
  activeBattle: ActiveBattleState | null;
  resolvedAttacks: ResolvedAttack[];
  log: CampaignLogEntry[];
  score?: CampaignScoreRecord;
}

const PRODUCT_ORDER: MineProduct[] = ['stones', 'scissors', 'papers', 'copper'];

/**
 * One run of a campaign. Commands return a new instance or throw.
 * This type does not know about the game processor.
 */
export class Campaign {
  private constructor(private readonly state: CampaignState) {}

  static start(definition: CampaignDefinition, now: number, id: string): Campaign {
    const copy = structuredClone(definition);
    const inventory = CampaignInventory.fromPartial(copy.startingInventory.items, copy.startingInventory.currencies);
    return new Campaign({
      id,
      definitionId: copy.id,
      title: copy.title,
      rulesetVersion: copy.rulesetVersion,
      status: 'started',
      createdAt: now,
      updatedAt: now,
      turnNumber: 0,
      actionPoints: copy.rules.actionPointsPerTurn,
      inventory,
      startingInventory: {
        items: { ...inventory.items },
        currencies: { ...inventory.currencies }
      },
      rules: copy.rules,
      tiles: copy.tiles.map(tile => reviveTile(tile, NPC_ALGORITHM_V1)),
      activeBattle: null,
      resolvedAttacks: [],
      log: []
    });
  }

  static fromJSON(data: any): Campaign {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid campaign: must be an object');
    }
    if (data.status !== 'started' && data.status !== 'finished') {
      throw new ValidationError('Campaign status must be started or finished');
    }
    const inventory = CampaignInventory.fromJSON(data.inventory);
    const starting = data.startingInventory
      ? CampaignInventory.fromJSON(data.startingInventory)
      : inventory;
    return new Campaign({
      id: requireString(data.id, 'campaign id'),
      definitionId: requireString(data.definitionId, 'definitionId'),
      title: requireString(data.title, 'title'),
      rulesetVersion: requireCount(data.rulesetVersion, 'rulesetVersion'),
      status: data.status,
      finishReason: data.finishReason,
      finishedAt: data.finishedAt,
      createdAt: requireCount(data.createdAt, 'createdAt'),
      updatedAt: requireCount(data.updatedAt, 'updatedAt'),
      turnNumber: requireCount(data.turnNumber, 'turnNumber'),
      actionPoints: requireCount(data.actionPoints, 'actionPoints'),
      inventory,
      startingInventory: {
        items: { ...starting.items },
        currencies: { ...starting.currencies }
      },
      rules: structuredClone(data.rules),
      tiles: Array.isArray(data.tiles)
        ? data.tiles.map((tile: unknown) => reviveTile(tile, fallbackNpc(data.npcAlgorithmId)))
        : [],
      activeBattle: data.activeBattle ? structuredClone(data.activeBattle) : null,
      resolvedAttacks: Array.isArray(data.resolvedAttacks) ? structuredClone(data.resolvedAttacks) : [],
      log: Array.isArray(data.log) ? structuredClone(data.log) : [],
      score: data.score ? structuredClone(data.score) : undefined
    });
  }

  get id(): string { return this.state.id; }
  get definitionId(): string { return this.state.definitionId; }
  get title(): string { return this.state.title; }
  get status(): CampaignStatus { return this.state.status; }
  get finishReason(): FinishReason | undefined { return this.state.finishReason; }
  get finishedAt(): number | undefined { return this.state.finishedAt; }
  get createdAt(): number { return this.state.createdAt; }
  get updatedAt(): number { return this.state.updatedAt; }
  get turnNumber(): number { return this.state.turnNumber; }
  get turns(): number { return this.state.turnNumber + 1; }
  get actionPoints(): number { return this.state.actionPoints; }
  get inventory(): CampaignInventory { return this.state.inventory; }
  get rules(): StoredRules { return this.state.rules; }
  get tiles(): readonly ServerTile[] { return this.state.tiles; }
  get activeBattle(): ActiveBattleState | null { return this.state.activeBattle; }
  get resolvedAttacks(): readonly ResolvedAttack[] { return this.state.resolvedAttacks; }
  get log(): readonly CampaignLogEntry[] { return this.state.log; }
  get score(): CampaignScoreRecord | undefined { return this.state.score; }
  get rulesetVersion(): number { return this.state.rulesetVersion; }
  get startingInventory(): { items: ItemStack; currencies: CurrencyStack } {
    return this.state.startingInventory;
  }

  endTurn(now: number): Campaign {
    this.assertStarted();
    this.assertNoBattle();
    const income = this.incomeStack();
    let inventory = this.state.inventory;
    for (const product of PRODUCT_ORDER) {
      const amount = income[product] ?? 0;
      if (amount > 0) {
        inventory = inventory.creditProduct(product, amount);
      }
    }
    const tiles = this.state.tiles.map(tile => ({
      ...tile,
      dugThisTurn: false,
      searchedThisTurn: false,
      increasedThisTurn: false,
      stashes: tile.stashes.map(stash => ({ ...stash }))
    }));
    const turnNumber = this.state.turnNumber + 1;
    return this.branch({
      inventory,
      tiles,
      actionPoints: this.state.rules.actionPointsPerTurn,
      turnNumber,
      updatedAt: now,
      log: [...this.state.log, this.entry(now, 'income', summarizeIncome(income), turnNumber)]
    });
  }

  /**
   * Debit the kit and open a battle with an empty gameId.
   * The service creates the game after this, then calls attachGame.
   */
  beginAttack(q: number, r: number, from: Axial | undefined, attackId: string, battleSeed: number, now: number): Campaign {
    this.assertAttackAllowed(q, r, from);
    const tile = this.tileAt(q, r);
    const kit = this.state.rules.battleKit;
    const inventory = this.state.inventory.debitItems(kit);
    const battle: ActiveBattleState = {
      attackId,
      battleSeed,
      gameId: null,
      q,
      r,
      wager: positiveItems(kit),
      resolved: false
    };
    return this.branch({
      inventory,
      actionPoints: this.state.actionPoints - 1,
      activeBattle: battle,
      updatedAt: now,
      log: [...this.state.log, this.entry(now, 'attack', tile.label)]
    });
  }

  attachGame(gameId: string, now: number): Campaign {
    const battle = this.state.activeBattle;
    if (!battle || battle.gameId) {
      throw new ConflictError('No battle is waiting for a game');
    }
    return this.branch({
      activeBattle: { ...battle, gameId },
      updatedAt: now
    });
  }

  /** Undo a debit whose game was never stored. */
  refundOpenAttack(now: number): Campaign {
    const battle = this.state.activeBattle;
    if (!battle || battle.gameId) {
      return this;
    }
    return this.branch({
      inventory: this.state.inventory.addStack(battle.wager, {}),
      actionPoints: Math.min(this.state.rules.actionPointsPerTurn, this.state.actionPoints + 1),
      activeBattle: null,
      updatedAt: now,
      log: [...this.state.log, this.entry(now, 'battle_refunded', 'wager returned')]
    });
  }

  applyBattle(facts: BattleApplyFacts, now: number): BattleApplyResult {
    if (this.isPairResolved(facts.attackId, facts.gameId)) {
      return { campaign: this.clearStaleBattle(facts.attackId, facts.gameId, now), outcome: null };
    }
    const battle = this.state.activeBattle;
    if (!battle || battle.gameId !== facts.gameId || battle.attackId !== facts.attackId) {
      return { campaign: this, outcome: null };
    }
    if (this.state.status === 'finished') {
      return { campaign: this.clearStaleBattle(facts.attackId, facts.gameId, now), outcome: null };
    }
    if (facts.kind === 'broken') {
      return { campaign: this.refundBroken(battle, facts, now), outcome: null };
    }
    const leftovers = facts.leftovers;
    let inventory = this.state.inventory.addStack(leftovers.items, leftovers.currencies);
    const tile = this.tileAt(battle.q, battle.r);
    const won = facts.kind === 'win';
    let tiles = this.state.tiles;
    let reward: { items: ItemStack; currencies: CurrencyStack } | null = null;
    let revealedGarrison: ReturnType<Garrison['reveal']> | undefined;
    if (won) {
      reward = {
        items: positiveItems(tile.victoryReward.items),
        currencies: positiveCurrencies(tile.victoryReward.currencies)
      };
      inventory = inventory.addStack(reward.items, reward.currencies);
      tiles = this.capture(tile, this.state.turnNumber);
    } else if (tile.garrison) {
      const npc = facts.npcLeftovers ?? { items: {}, currencies: {} };
      const garrison = tile.garrison.withInventory(npc.items, npc.currencies);
      revealedGarrison = garrison.reveal();
      tiles = this.mapTile(battle.q, battle.r, current => ({ ...current, garrison }));
    }
    const spent = spentItems(battle.wager, leftovers.items);
    const resolvedAttacks = [...this.state.resolvedAttacks, { attackId: facts.attackId, gameId: facts.gameId }];
    const logType: CampaignLogType = won ? 'battle_won' : 'battle_lost';
    let next = this.branch({
      inventory,
      tiles,
      activeBattle: null,
      resolvedAttacks,
      updatedAt: now,
      log: [...this.state.log, this.entry(now, logType, tile.label)]
    });
    if (won && tile.objective) {
      next = next.finishVictory(now);
    }
    const outcome: BattleOutcome = {
      result: won ? 'victory' : 'defeat',
      playerRoundWins: facts.playerRoundWins,
      npcRoundWins: facts.npcRoundWins,
      q: battle.q,
      r: battle.r,
      captured: won,
      reward: won ? reward : null,
      spent: { items: spent }
    };
    if (revealedGarrison) {
      outcome.garrison = revealedGarrison;
    }
    return { campaign: next, outcome };
  }

  dig(q: number, r: number, now: number): Campaign {
    const tile = this.ownedEconomyTile(q, r);
    if (tile.dugThisTurn) {
      throw new ValidationError('This tile was already dug this turn');
    }
    if (tile.mines < 1) {
      throw new ValidationError('This tile has no mines to dig');
    }
    const actionPoints = this.spendEconomyPoint();
    const product = tile.product as MineProduct;
    const yieldAmount = 2 * tile.mines * unitFor(product);
    const inventory = this.state.inventory.debitCopper(this.state.rules.digCost).creditProduct(product, yieldAmount);
    return this.branch({
      inventory,
      actionPoints,
      tiles: this.mapTile(q, r, current => ({ ...current, dugThisTurn: true })),
      updatedAt: now,
      log: [...this.state.log, this.entry(now, 'dig', summarizeProduct(product, yieldAmount))]
    });
  }

  search(q: number, r: number, now: number): { campaign: Campaign; found: { items: ItemStack; currencies: CurrencyStack } } {
    const tile = this.ownedEconomyTile(q, r);
    if (tile.searchedThisTurn) {
      throw new ValidationError('This tile was already searched this turn');
    }
    const stash = tile.stashes.find(pile => !pile.found);
    if (!stash) {
      throw new ValidationError('This tile has no stash');
    }
    const actionPoints = this.spendEconomyPoint();
    const found = {
      items: positiveItems(stash.items),
      currencies: positiveCurrencies(stash.currencies)
    };
    const inventory = this.state.inventory.debitCopper(this.state.rules.searchCost).addStack(found.items, found.currencies);
    const campaign = this.branch({
      inventory,
      actionPoints,
      tiles: this.mapTile(q, r, current => ({
        ...current,
        searchedThisTurn: true,
        stashes: current.stashes.map(pile => pile.id === stash.id ? { ...pile, found: true } : { ...pile })
      })),
      updatedAt: now,
      log: [...this.state.log, this.entry(now, 'search', summarizeStack(found.items, found.currencies))]
    });
    return { campaign, found };
  }

  increaseMines(q: number, r: number, now: number): Campaign {
    const tile = this.ownedEconomyTile(q, r);
    if (tile.increasedThisTurn) {
      throw new ValidationError('Mines were already increased on this tile this turn');
    }
    if (tile.mines >= tile.maxMines) {
      throw new ValidationError('Mines are already at maximum');
    }
    const actionPoints = this.spendEconomyPoint();
    const mines = tile.mines + 1;
    const inventory = this.state.inventory.debitCopper(this.state.rules.increaseMinesCost);
    return this.branch({
      inventory,
      actionPoints,
      tiles: this.mapTile(q, r, current => ({ ...current, mines, increasedThisTurn: true })),
      updatedAt: now,
      log: [...this.state.log, this.entry(now, 'mines_increased', `${tile.label} mines ${mines}`)]
    });
  }

  buy(item: string, amount: number, now: number): Campaign {
    this.assertStarted();
    this.assertNoBattle();
    if (!Number.isInteger(amount) || amount < 1) {
      throw new ValidationError('Buy amount must be a positive integer');
    }
    const price = this.state.rules.marketplace[item as InventoryItemKey];
    if (price === undefined || !(ITEM_KEYS as readonly string[]).includes(item)) {
      throw new ValidationError(`'${item}' is not for sale`);
    }
    const cost = price * amount;
    if (!Number.isSafeInteger(cost)) {
      throw new ValidationError('Buy amount is too large');
    }
    const actionPoints = this.spendEconomyPoint();
    const inventory = this.state.inventory.debitCopper(cost).creditItems({ [item as InventoryItemKey]: amount });
    return this.branch({
      inventory,
      actionPoints,
      updatedAt: now,
      log: [...this.state.log, this.entry(now, 'purchase', `${amount} ${item}`)]
    });
  }

  leave(now: number): Campaign {
    this.assertStarted();
    this.assertNoBattle();
    return this.finish('abandoned', now, [...this.state.log, this.entry(now, 'left', 'abandoned')]);
  }

  finishExternal(now: number): Campaign {
    this.assertStarted();
    this.assertNoBattle();
    return this.finish('external', now, this.state.log);
  }

  blockedReasons(): string[] {
    const reasons: string[] = [];
    const targets = this.legalTargets();
    if (targets.length > 0 && !this.state.inventory.canPayItems(this.state.rules.battleKit)) {
      reasons.push('cannot_afford_battle');
    }
    if (targets.length === 0) {
      reasons.push('no_attack_target');
    }
    if (this.state.activeBattle) {
      reasons.push('battle_in_progress');
    }
    return reasons;
  }

  toJSON(): object {
    const json: Record<string, unknown> = {
      id: this.state.id,
      definitionId: this.state.definitionId,
      title: this.state.title,
      rulesetVersion: this.state.rulesetVersion,
      status: this.state.status,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
      turnNumber: this.state.turnNumber,
      actionPoints: this.state.actionPoints,
      inventory: this.state.inventory.toJSON(),
      startingInventory: this.state.startingInventory,
      rules: this.state.rules,
      tiles: this.state.tiles.map(storeTile),
      activeBattle: this.state.activeBattle,
      resolvedAttacks: this.state.resolvedAttacks,
      log: this.state.log
    };
    if (this.state.finishReason) {
      json.finishReason = this.state.finishReason;
    }
    if (this.state.finishedAt !== undefined) {
      json.finishedAt = this.state.finishedAt;
    }
    if (this.state.score) {
      json.score = this.state.score;
    }
    return json;
  }

  private finishVictory(now: number): Campaign {
    const turns = this.state.turnNumber + 1;
    const victories = this.state.tiles.filter(tile => tile.owner === 'player').length - 1;
    const silver = Math.max(0, this.state.inventory.currencies.silver - (this.state.startingInventory.currencies.silver ?? 0));
    const copper = Math.max(0, this.state.inventory.currencies.copper - (this.state.startingInventory.currencies.copper ?? 0));
    const score = campaignScore({
      turns,
      victories,
      silver,
      copper,
      weights: this.state.rules.scoreWeights
    });
    return this.finish('victory', now, [...this.state.log, this.entry(now, 'victory', `${score.total}`)], score);
  }

  private finish(reason: FinishReason, now: number, log: CampaignLogEntry[], score?: CampaignScoreRecord): Campaign {
    return this.branch({
      status: 'finished',
      finishReason: reason,
      finishedAt: now,
      updatedAt: now,
      activeBattle: null,
      score,
      log
    });
  }

  private refundBroken(battle: ActiveBattleState, facts: BattleApplyFacts, now: number): Campaign {
    return this.branch({
      inventory: this.state.inventory.addStack(battle.wager, {}),
      actionPoints: Math.min(this.state.rules.actionPointsPerTurn, this.state.actionPoints + 1),
      activeBattle: null,
      resolvedAttacks: [...this.state.resolvedAttacks, { attackId: facts.attackId, gameId: facts.gameId }],
      updatedAt: now,
      log: [...this.state.log, this.entry(now, 'battle_refunded', 'wager returned')]
    });
  }

  private clearStaleBattle(attackId: string, gameId: string, now: number): Campaign {
    const battle = this.state.activeBattle;
    if (!battle || battle.attackId !== attackId || battle.gameId !== gameId) {
      return this;
    }
    return this.branch({ activeBattle: null, updatedAt: now });
  }

  private capture(tile: ServerTile, turnNumber: number): ServerTile[] {
    const revealed = new Set(neighborsOnMap(tile.q, tile.r).map(cell => `${cell.q},${cell.r}`));
    revealed.add(`${tile.q},${tile.r}`);
    return this.state.tiles.map(current => {
      if (current.q === tile.q && current.r === tile.r) {
        return { ...current, owner: 'player' as const, revealed: true, acquiredTurn: turnNumber, garrison: null };
      }
      if (revealed.has(`${current.q},${current.r}`)) {
        return { ...current, revealed: true };
      }
      return current;
    });
  }

  private assertAttackAllowed(q: number, r: number, from: Axial | undefined): void {
    this.assertStarted();
    this.assertNoBattle();
    if (this.state.actionPoints < 1) {
      throw new ValidationError('No action point');
    }
    this.assertOnMap(q, r);
    const tile = this.tileAt(q, r);
    if (!tile.enabled) {
      throw new ValidationError('That tile is blocked');
    }
    if (tile.owner === 'player') {
      throw new ValidationError('That tile is already owned');
    }
    if (!tile.revealed) {
      throw new ValidationError('That tile is hidden');
    }
    const ownedNeighbor = this.state.tiles.some(current =>
      current.owner === 'player' && current.enabled && aligned(current, tile)
    );
    if (!ownedNeighbor) {
      throw new ValidationError('That tile is not next to a tile you own');
    }
    if (from) {
      this.assertOnMap(from.q, from.r);
      const origin = this.tileAt(from.q, from.r);
      if (origin.owner !== 'player' || !aligned(origin, tile)) {
        throw new ValidationError('The from tile must be an owned neighbor of the target');
      }
    }
    if (!this.state.inventory.canPayItems(this.state.rules.battleKit)) {
      throw new ValidationError('Not enough items for the battle kit');
    }
  }

  private ownedEconomyTile(q: number, r: number): ServerTile {
    this.assertStarted();
    this.assertNoBattle();
    this.assertOnMap(q, r);
    const tile = this.tileAt(q, r);
    if (!tile.enabled) {
      throw new ValidationError('That tile is blocked');
    }
    if (tile.owner !== 'player') {
      throw new ValidationError('That tile is not owned');
    }
    if (!tile.product) {
      throw new ValidationError('That tile has nothing to gather');
    }
    return tile;
  }

  private spendEconomyPoint(): number {
    if (!this.state.rules.economyConsumesActionPoint) {
      return this.state.actionPoints;
    }
    if (this.state.actionPoints < 1) {
      throw new ValidationError('No action point');
    }
    return this.state.actionPoints - 1;
  }

  private incomeStack(): Partial<Record<MineProduct, number>> {
    const income: Partial<Record<MineProduct, number>> = {};
    for (const tile of this.state.tiles) {
      if (tile.owner !== 'player' || !tile.enabled || !tile.product) {
        continue;
      }
      if (tile.acquiredTurn === this.state.turnNumber) {
        continue;
      }
      const amount = tile.mines * unitFor(tile.product);
      income[tile.product] = (income[tile.product] ?? 0) + amount;
    }
    return income;
  }

  private legalTargets(): ServerTile[] {
    if (this.state.status !== 'started') {
      return [];
    }
    return this.state.tiles.filter(tile =>
      tile.enabled
      && tile.revealed
      && tile.owner === 'neutral'
      && this.state.tiles.some(current => current.owner === 'player' && current.enabled && aligned(current, tile))
    );
  }

  private isPairResolved(attackId: string, gameId: string): boolean {
    return this.state.resolvedAttacks.some(pair => pair.attackId === attackId && pair.gameId === gameId);
  }

  private assertStarted(): void {
    if (this.state.status === 'finished') {
      throw new ConflictError('Campaign is finished');
    }
  }

  private assertNoBattle(): void {
    if (this.state.activeBattle) {
      const gameId = this.state.activeBattle.gameId ?? undefined;
      throw new ConflictError('A battle is already open', gameId);
    }
  }

  private assertOnMap(q: number, r: number): void {
    if (!Number.isInteger(q) || !Number.isInteger(r) || !onMap(q, r)) {
      throw new ValidationError('Coordinates are not on the map');
    }
  }

  private tileAt(q: number, r: number): ServerTile {
    const tile = this.state.tiles.find(current => sameAxial(current, { q, r }));
    if (!tile) {
      throw new NotFoundError('Tile not found');
    }
    return tile;
  }

  private mapTile(q: number, r: number, update: (tile: ServerTile) => ServerTile): ServerTile[] {
    return this.state.tiles.map(tile => tile.q === q && tile.r === r ? update(tile) : tile);
  }

  private entry(now: number, type: CampaignLogType, summary: string, turnNumber = this.state.turnNumber): CampaignLogEntry {
    return { at: now, turn: turnNumber + 1, type, summary };
  }

  private branch(patch: Partial<CampaignState>): Campaign {
    return new Campaign({ ...this.state, ...patch });
  }
}

function spentItems(wager: ItemStack, leftovers: ItemStack): ItemStack {
  const spent: ItemStack = {};
  for (const key of ITEM_KEYS) {
    const used = Math.max(0, (wager[key] ?? 0) - (leftovers[key] ?? 0));
    if (used > 0) {
      spent[key] = used;
    }
  }
  return spent;
}

function summarizeIncome(income: Partial<Record<MineProduct, number>>): string {
  const parts = PRODUCT_ORDER
    .filter(product => (income[product] ?? 0) > 0)
    .map(product => summarizeProduct(product, income[product] ?? 0));
  return parts.length > 0 ? parts.join(', ') : 'nothing';
}

function summarizeProduct(product: MineProduct, amount: number): string {
  return `${amount} ${product}`;
}

function summarizeStack(items: ItemStack, currencies: CurrencyStack): string {
  const parts: string[] = [];
  for (const key of ITEM_KEYS) {
    if ((items[key] ?? 0) > 0) {
      parts.push(`${items[key]} ${key}`);
    }
  }
  for (const key of CURRENCY_KEYS) {
    if ((currencies[key] ?? 0) > 0) {
      parts.push(`${currencies[key]} ${key}`);
    }
  }
  return parts.join(', ');
}

function fallbackNpc(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : NPC_ALGORITHM_V1;
}

function reviveTile(raw: any, fallback: string): ServerTile {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('Invalid tile');
  }
  const { defenderKit, garrison, ...rest } = raw;
  const tile = structuredClone(rest) as ServerTile;
  if (tile.owner === 'player') {
    tile.garrison = null;
    return tile;
  }
  if (garrison) {
    tile.garrison = garrison instanceof Garrison
      ? Garrison.fromJSON(garrison.toJSON())
      : Garrison.fromJSON(garrison);
    return tile;
  }
  const kit = defenderKit && typeof defenderKit === 'object' ? defenderKit : {};
  tile.garrison = Garrison.hidden(fallback, kit);
  return tile;
}

function storeTile(tile: ServerTile): Record<string, unknown> {
  const stored: Record<string, unknown> = { ...tile, garrison: null };
  if (tile.garrison) {
    stored.garrison = tile.garrison.toJSON();
  }
  return stored;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`${label} is required`);
  }
  return value;
}

function requireCount(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${label} must be a non-negative integer`);
  }
  return value;
}

export function tileByAxial(tiles: readonly ServerTile[], q: number, r: number): ServerTile | undefined {
  return tiles.find(tile => tile.q === q && tile.r === r);
}
