import { describe, expect, it } from 'vitest';
import { Campaign } from './Campaign.js';
import { CHAPTER_I } from './ChapterI.js';
import { campaignScore } from './CampaignScore.js';
import { toCampaignView } from './CampaignView.js';
import { ConflictError, ValidationError } from '../../shared/errors/index.js';

const NOW = 1_700_000_000_000;

describe('Campaign score', () => {
  const weights = CHAPTER_I.rules.scoreWeights;

  it('matches the Chapter I tuning rows', () => {
    expect(campaignScore({ turns: 2, victories: 2, silver: 3, copper: 14, weights }).total).toBe(214);
    expect(campaignScore({ turns: 3, victories: 3, silver: 5, copper: 18, weights }).total).toBe(228);
    expect(campaignScore({ turns: 4, victories: 4, silver: 5, copper: 22, weights }).total).toBe(202);
    expect(campaignScore({ turns: 3, victories: 2, silver: 3, copper: 16, weights }).total).toBe(166);
  });
});

describe('Chapter I instance', () => {
  function fresh(): Campaign {
    return Campaign.start(CHAPTER_I, NOW, 'campaign-1');
  }

  it('UC-2 and UC-4: copies the fresh map into views', () => {
    const campaign = fresh();
    const view = toCampaignView(campaign);
    expect(view.turnNumber).toBe(0);
    expect(view.turns).toBe(1);
    expect(view.actionPoints).toBe(1);
    expect(view.inventory).toMatchObject({ currencies: { copper: 16, silver: 0, gold: 0 } });
    const tiles = view.tiles as Array<Record<string, unknown>>;
    expect(tiles).toHaveLength(19);
    expect(tiles.filter(tile => tile.visibility === 'hidden')).toHaveLength(12);
    const gate = tiles.find(tile => tile.q === 0 && tile.r === -1);
    expect(gate).toMatchObject({ visibility: 'seen', difficulty: 'normal', rounds: 'BO5', objective: false });
    expect(gate).not.toHaveProperty('income');
    expect(gate).not.toHaveProperty('mines');
    expect(gate).not.toHaveProperty('garrison');
    const easy = tiles.find(tile => tile.q === 1 && tile.r === 0);
    expect(easy).toMatchObject({ visibility: 'seen', difficulty: 'easy', rounds: 'BO5' });
    const camp = tiles.find(tile => tile.q === 0 && tile.r === 0);
    expect(camp).toMatchObject({
      visibility: 'owned',
      income: { product: 'copper', perTurn: 2 },
      mines: 1,
      maxMines: 3,
      dugThisTurn: false,
      searchedThisTurn: false,
      increasedThisTurn: false,
      searchAvailable: false
    });
    const citadel = tiles.find(tile => tile.q === 0 && tile.r === -2);
    expect(citadel).toEqual({ q: 0, r: -2, visibility: 'hidden' });
    expect(view.rules).not.toHaveProperty('economyConsumesActionPoint');
    expect(view.rules).toMatchObject({ battleEntry: 'fee', attackFee: { copper: 10 } });
    expect(view.rules).not.toHaveProperty('battleKit');
    expect(view).not.toHaveProperty('npcAlgorithmId');
    expect((campaign.toJSON() as { rules: { economyConsumesActionPoint: boolean } }).rules.economyConsumesActionPoint).toBe(false);
    expect(campaign.toJSON()).not.toHaveProperty('npcAlgorithmId');
    expect(campaign.tiles.find(tile => tile.q === 0 && tile.r === 0)?.garrison).toBeNull();
    expect(campaign.tiles.find(tile => tile.q === 0 && tile.r === -1)?.garrison).toMatchObject({
      npcAlgorithmId: 'npc-v1',
      known: false
    });
    expect(campaign.tiles.find(tile => tile.q === 0 && tile.r === -1)?.garrison?.inventory.items.stones).toBe(9);
    expect(campaign.tiles.find(tile => tile.q === 1 && tile.r === 0)?.garrison?.inventory.items.stones).toBe(6);
    expect(campaign.tiles.find(tile => tile.q === 0 && tile.r === -2)?.garrison?.inventory.items).toMatchObject({
      stones: 12,
      scissors: 8,
      papers: 8,
      NT_effect: 1
    });
  });

  it('keeps stored rules when the definition object is edited after start', () => {
    const definition = structuredClone(CHAPTER_I);
    const campaign = Campaign.start(definition, NOW, 'campaign-1');
    definition.rules.digCost = 99;
    definition.tiles[0].mines = 9;
    expect(campaign.rules.digCost).toBe(4);
    expect(campaign.tiles[0].mines).toBe(1);
  });

  it('UC-9: the first payday is 2 copper, and an unspent point is allowed', () => {
    const paid = fresh().endTurn(NOW + 1);
    expect(paid.turnNumber).toBe(1);
    expect(paid.turns).toBe(2);
    expect(paid.actionPoints).toBe(1);
    expect(paid.inventory.currencies.copper).toBe(18);
    expect(paid.log[0]).toMatchObject({ type: 'income', summary: '2 copper', turn: 2 });
  });

  it('UC-14: illegal attacks change nothing', () => {
    const campaign = fresh();
    const before = campaign.toJSON();
    const reject = (run: () => void) => {
      expect(run).toThrow(ValidationError);
      expect(campaign.toJSON()).toEqual(before);
    };
    reject(() => campaign.beginAttack(0, 0, undefined, 'a', 1, NOW));
    reject(() => campaign.beginAttack(2, 2, undefined, 'a', 1, NOW));
    reject(() => campaign.beginAttack(0, -2, undefined, 'a', 1, NOW));
    reject(() => campaign.beginAttack(3, 0, undefined, 'a', 1, NOW));
    reject(() => campaign.beginAttack(0, -1, { q: 1, r: 0 }, 'a', 1, NOW));
    const broke = campaign.beginAttack(0, -1, { q: 0, r: 0 }, 'a', 1, NOW);
    expect(() => broke.beginAttack(1, 0, undefined, 'b', 2, NOW)).toThrow(ConflictError);
    const poor = Campaign.fromJSON({
      ...campaign.toJSON(),
      inventory: {
        items: { ...campaign.inventory.items },
        currencies: { ...campaign.inventory.toJSON().currencies, copper: 9 }
      }
    });
    expect(() => poor.beginAttack(0, -1, undefined, 'a', 1, NOW)).toThrow(/copper/);
    expect(poor.blockedReasons()).toContain('cannot_afford_battle');
    const lost = broke.attachGame('game-1', NOW).applyBattle({
      attackId: 'a',
      gameId: 'game-1',
      kind: 'loss',
      leftovers: { items: { ...stake(broke) }, currencies: {} },
      playerRoundWins: 0,
      npcRoundWins: 3
    }, NOW).campaign;
    expect(() => lost.beginAttack(0, -1, undefined, 'b', 2, NOW)).toThrow(/No action point/);
  });

  it('UC-10: dig, upgrade, search, and the next income', () => {
    const dug = fresh().dig(0, 0, NOW);
    expect(dug.inventory.currencies.copper).toBe(16);
    expect(dug.tiles.find(tile => tile.q === 0 && tile.r === 0)?.dugThisTurn).toBe(true);
    expect(() => dug.dig(0, 0, NOW)).toThrow(ValidationError);
    expect(() => dug.search(0, 0, NOW)).toThrow(/no stash/);

    const upgraded = dug.increaseMines(0, 0, NOW);
    expect(upgraded.tiles.find(tile => tile.q === 0 && tile.r === 0)?.mines).toBe(2);
    expect(upgraded.inventory.currencies.copper).toBe(10);
    const paid = upgraded.endTurn(NOW);
    expect(paid.inventory.currencies.copper).toBe(14);

    const opened = captureGate(fresh());
    const gateDug = opened.dig(0, -1, NOW);
    expect(gateDug.inventory.items.stones).toBe(opened.inventory.items.stones + 2);
    expect(gateDug.inventory.currencies.copper).toBe(opened.inventory.currencies.copper - 4);
    const afterCapture = opened.endTurn(NOW);
    expect(afterCapture.inventory.items.stones).toBe(opened.inventory.items.stones);
    expect(afterCapture.inventory.currencies.copper).toBe(opened.inventory.currencies.copper + 2);
    const next = afterCapture.endTurn(NOW);
    expect(next.inventory.items.stones).toBe(afterCapture.inventory.items.stones + 1);

    const south = captureSouth(opened).endTurn(NOW);
    const searched = south.search(0, 1, NOW);
    expect(searched.found).toEqual({ items: { scissors: 4 }, currencies: { silver: 2, copper: 6 } });
    expect(searched.campaign.inventory.currencies.silver).toBe(south.inventory.currencies.silver + 2);
    expect(toCampaignView(searched.campaign).tiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ q: 0, r: 1, searchAvailable: false, searchedThisTurn: true })
      ])
    );
  });

  it('searches stashes in template order and rejects a second search the same turn', () => {
    const raw = fresh().toJSON() as { tiles: Array<{ q: number; r: number; owner: string; revealed: boolean; stashes: unknown[] }> };
    const south = raw.tiles.find(tile => tile.q === 0 && tile.r === 1);
    if (!south) {
      throw new Error('south tile missing');
    }
    south.owner = 'player';
    south.revealed = true;
    south.stashes.push({ id: 'second', items: { stones: 1 }, currencies: {}, found: false });
    const campaign = Campaign.fromJSON(raw);
    const first = campaign.search(0, 1, NOW);
    expect(first.found.currencies.silver).toBe(2);
    expect(() => first.campaign.search(0, 1, NOW)).toThrow(ValidationError);
    const later = first.campaign.endTurn(NOW).search(0, 1, NOW);
    expect(later.found.items.stones).toBe(1);
  });

  it('UC-10b: buy spends copper for the whole order', () => {
    const bought = fresh().buy('stones', 2, NOW);
    expect(bought.inventory.items.stones).toBe(16);
    expect(bought.inventory.currencies.copper).toBe(10);
    const effect = fresh().buy('NT_effect', 1, NOW);
    expect(effect.inventory.items.NT_effect).toBe(3);
    expect(effect.inventory.currencies.copper).toBe(4);
    expect(() => fresh().buy('stones', 6, NOW)).toThrow(ValidationError);
    expect(() => fresh().buy('silver', 1, NOW)).toThrow(ValidationError);
    expect(() => fresh().buy('gold', 1, NOW)).toThrow(ValidationError);
    const open = fresh().beginAttack(0, -1, { q: 0, r: 0 }, 'attack-1', 1, NOW);
    expect(() => open.buy('stones', 1, NOW)).toThrow(ConflictError);
  });

  it('spends an action point on the economy only when the stored flag says so', () => {
    const raw = fresh().toJSON() as { rules: { economyConsumesActionPoint: boolean }; actionPoints: number };
    raw.rules.economyConsumesActionPoint = true;
    raw.actionPoints = 0;
    const empty = Campaign.fromJSON(raw);
    expect(() => empty.dig(0, 0, NOW)).toThrow(/No action point/);
    raw.actionPoints = 1;
    const spent = Campaign.fromJSON(raw).dig(0, 0, NOW);
    expect(spent.actionPoints).toBe(0);
  });

  it('UC-6, UC-7, UC-8, and a second delivery: resolution is idempotent', () => {
    const opened = fresh().beginAttack(0, -1, { q: 0, r: 0 }, 'attack-1', 7, NOW).attachGame('game-1', NOW);
    const won = opened.applyBattle(facts('win', opened), NOW + 1);
    expect(won.outcome?.captured).toBe(true);
    expect(won.outcome?.result).toBe('victory');
    expect(won.campaign.activeBattle).toBeNull();
    expect(won.campaign.tiles.find(tile => tile.q === 0 && tile.r === -1)?.owner).toBe('player');
    expect(won.campaign.tiles.find(tile => tile.q === 0 && tile.r === -1)?.garrison).toBeNull();
    expect(won.outcome).not.toHaveProperty('garrison');
    expect(won.campaign.tiles.find(tile => tile.q === 0 && tile.r === -2)?.revealed).toBe(true);
    expect(won.campaign.tiles.find(tile => tile.q === -1 && tile.r === -1)?.revealed).toBe(true);
    expect(won.campaign.tiles.find(tile => tile.q === 1 && tile.r === -2)?.revealed).toBe(true);
    expect(won.campaign.actionPoints).toBe(0);
    const npcWouldHaveAdded = 9;
    expect(won.campaign.inventory.items.stones).toBe(14 + 3);
    expect(won.campaign.inventory.items.stones).not.toBe(14 + 3 + npcWouldHaveAdded);
    expect(won.campaign.inventory.currencies.copper).toBe(10);
    expect(won.campaign.lastBattleOutcome).toEqual(won.outcome);
    const stored = Campaign.fromJSON(won.campaign.toJSON());
    expect(stored.lastBattleOutcome?.result).toBe('victory');
    expect(stored.lastBattleOutcome?.reward?.items.stones).toBe(3);
    expect(won.campaign.endTurn(NOW + 2).lastBattleOutcome).toBeNull();
    const again = won.campaign.applyBattle(facts('win', opened), NOW + 2);
    expect(again.outcome).toBeNull();
    expect(again.campaign.inventory.items.stones).toBe(won.campaign.inventory.items.stones);

    const lost = opened.applyBattle(facts('loss', opened), NOW + 1);
    expect(lost.outcome?.result).toBe('defeat');
    expect(lost.outcome?.captured).toBe(false);
    expect(lost.campaign.tiles.find(tile => tile.q === 0 && tile.r === -1)?.owner).toBe('neutral');
    expect(lost.campaign.tiles.find(tile => tile.q === 0 && tile.r === -1)?.garrison?.known).toBe(true);
    expect(lost.campaign.tiles.find(tile => tile.q === 0 && tile.r === -1)?.garrison?.inventory.items.stones).toBe(4);
    expect(lost.outcome?.garrison?.inventory.items.stones).toBe(4);
    expect(lost.outcome?.garrison).not.toHaveProperty('known');
    const lostGate = (toCampaignView(lost.campaign).tiles as Array<Record<string, unknown>>)
      .find(tile => tile.q === 0 && tile.r === -1);
    expect(lostGate?.garrison).toMatchObject({ npcAlgorithmId: 'npc-v1' });
    expect(lostGate?.garrison).not.toHaveProperty('known');
    expect(lost.campaign.inventory.items.stones).toBe(14);
    expect(lost.campaign.inventory.currencies.copper).toBe(6);
    expect(lost.campaign.actionPoints).toBe(0);
    expect(lost.campaign.lastBattleOutcome?.result).toBe('defeat');
    expect(lost.campaign.lastBattleOutcome?.reward).toBeNull();
    const worn = lost.campaign.endTurn(NOW + 2).endTurn(NOW + 3).beginAttack(0, -1, undefined, 'b', 2, NOW + 4);
    expect(worn.tiles.find(tile => tile.q === 0 && tile.r === -1)?.garrison?.inventory.items.stones).toBe(4);
    const emptied = worn.attachGame('game-2', NOW + 3).applyBattle({
      attackId: 'b',
      gameId: 'game-2',
      kind: 'loss',
      leftovers: { items: { ...stake(worn) }, currencies: {} },
      npcLeftovers: { items: {}, currencies: {} },
      playerRoundWins: 0,
      npcRoundWins: 3
    }, NOW + 4);
    expect(emptied.campaign.tiles.find(tile => tile.q === 0 && tile.r === -1)?.garrison?.inventory.items.stones).toBe(0);
    expect(emptied.outcome?.garrison?.npcAlgorithmId).toBe('npc-v1');

    const broken = opened.applyBattle({ ...facts('broken', opened), leftovers: { items: { stones: 1 }, currencies: {} } }, NOW + 1);
    expect(broken.campaign.inventory.items.stones).toBe(14);
    expect(broken.campaign.inventory.currencies.copper).toBe(16);
    expect(broken.campaign.actionPoints).toBe(1);
    expect(broken.campaign.activeBattle).toBeNull();
    expect(broken.campaign.lastBattleOutcome).toBeNull();
    expect(Campaign.fromJSON(fresh().toJSON()).lastBattleOutcome).toBeNull();
    expect(broken.campaign.tiles.find(tile => tile.q === 0 && tile.r === -1)?.garrison?.known).toBe(false);
    expect(broken.campaign.tiles.find(tile => tile.q === 0 && tile.r === -1)?.garrison?.inventory.items.stones).toBe(9);
    const hiddenGate = (toCampaignView(broken.campaign).tiles as Array<Record<string, unknown>>)
      .find(tile => tile.q === 0 && tile.r === -1);
    expect(hiddenGate).not.toHaveProperty('garrison');
  });

  it('loads a defender kit as a hidden garrison', () => {
    const raw = fresh().toJSON() as {
      npcAlgorithmId?: string;
      tiles: Array<Record<string, unknown> & { owner?: string; garrison?: { inventory: { items: Record<string, number> } } | null }>;
    };
    raw.npcAlgorithmId = 'npc-v1';
    raw.tiles = raw.tiles.map(tile => {
      if (tile.owner === 'player') {
        const { garrison: _garrison, ...rest } = tile;
        return { ...rest, defenderKit: {} };
      }
      const kit = tile.garrison?.inventory.items ?? {};
      const { garrison: _garrison, ...rest } = tile;
      return { ...rest, defenderKit: kit };
    });
    const loaded = Campaign.fromJSON(raw);
    const gate = loaded.tiles.find(tile => tile.q === 0 && tile.r === -1);
    expect(gate?.garrison?.npcAlgorithmId).toBe('npc-v1');
    expect(gate?.garrison?.known).toBe(false);
    expect(gate?.garrison?.inventory.items.stones).toBe(9);
    expect(loaded.tiles.find(tile => tile.q === 0 && tile.r === 0)?.garrison).toBeNull();
    expect(loaded.toJSON()).not.toHaveProperty('npcAlgorithmId');
    const storedGate = (loaded.toJSON() as { tiles: Array<Record<string, unknown>> }).tiles
      .find(tile => tile.q === 0 && tile.r === -1);
    expect(storedGate).not.toHaveProperty('defenderKit');
    expect(storedGate?.garrison).toMatchObject({ npcAlgorithmId: 'npc-v1', known: false });
  });

  it('UC-11 and UC-12: victory freezes a score, leave does not', () => {
    const won = takeCitadel(fresh());
    expect(won.status).toBe('finished');
    expect(won.finishReason).toBe('victory');
    expect(won.score?.total).toBeGreaterThan(0);
    expect(won.lastBattleOutcome?.result).toBe('victory');
    expect(won.lastBattleOutcome?.q).toBe(0);
    expect(won.lastBattleOutcome?.r).toBe(-2);
    expect(() => won.endTurn(NOW)).toThrow(ConflictError);
    expect(() => won.beginAttack(1, 0, undefined, 'later', 1, NOW)).toThrow(ConflictError);
    const retry = won.applyBattle({
      attackId: 'citadel',
      gameId: 'game-citadel',
      kind: 'win',
      leftovers: { items: {}, currencies: {} },
      playerRoundWins: 4,
      npcRoundWins: 0
    }, NOW);
    expect(retry.campaign.score).toEqual(won.score);

    const left = fresh().leave(NOW);
    expect(left.finishReason).toBe('abandoned');
    expect(left.score).toBeUndefined();
    expect(left.toJSON()).not.toHaveProperty('score');
    expect(() => left.leave(NOW)).toThrow(ConflictError);
  });

  it('refunds an attack that never received a game id', () => {
    const debited = fresh().beginAttack(0, -1, undefined, 'attack-1', 1, NOW);
    expect(debited.inventory.items.stones).toBe(0);
    expect(debited.inventory.items.scissors).toBe(0);
    expect(debited.inventory.items.NT_effect).toBe(0);
    expect(debited.inventory.currencies.copper).toBe(6);
    expect(debited.inventory.currencies.gold).toBe(0);
    expect(debited.activeBattle?.committedItems).toMatchObject({
      stones: 14,
      scissors: 10,
      papers: 14,
      NA_effect_stone: 2,
      NA_effect_scissors: 2,
      NA_effect_papers: 2,
      NT_effect: 2
    });
    expect(debited.activeBattle?.feeCopper).toBe(10);
    expect(debited.activeBattle).not.toHaveProperty('wager');
    expect(debited.actionPoints).toBe(0);
    const refunded = debited.refundOpenAttack(NOW + 1);
    expect(refunded.inventory.items.stones).toBe(14);
    expect(refunded.inventory.currencies.copper).toBe(16);
    expect(refunded.actionPoints).toBe(1);
    expect(refunded.activeBattle).toBeNull();
    expect(refunded.log.at(-1)?.type).toBe('battle_refunded');
  });

  it('rejects an attack on a hidden neighbor and ignores it as a target', () => {
    const raw = fresh().toJSON() as { tiles: Array<{ q: number; r: number; revealed: boolean }> };
    const gate = raw.tiles.find(tile => tile.q === 0 && tile.r === -1);
    if (!gate) {
      throw new Error('gate missing');
    }
    gate.revealed = false;
    const hidden = Campaign.fromJSON(raw);
    expect(() => hidden.beginAttack(0, -1, { q: 0, r: 0 }, 'a', 1, NOW)).toThrow(/hidden/);
    expect(hidden.blockedReasons()).not.toContain('no_attack_target');
    expect(hidden.inventory.items.stones).toBe(14);
  });

  it('does not grant a battle again when the instance is already finished', () => {
    const won = takeCitadel(fresh());
    const raw = won.toJSON() as {
      activeBattle: unknown;
      inventory: { items: { stones: number } };
    };
    raw.activeBattle = {
      attackId: 'other',
      battleSeed: 1,
      gameId: 'game-x',
      q: 1,
      r: 0,
      wager: { stones: 8 },
      resolved: false
    };
    const stuck = Campaign.fromJSON(raw);
    const again = stuck.applyBattle({
      attackId: 'other',
      gameId: 'game-x',
      kind: 'win',
      leftovers: { items: { stones: 50 }, currencies: { silver: 9 } },
      playerRoundWins: 4,
      npcRoundWins: 0
    }, NOW);
    expect(again.outcome).toBeNull();
    expect(again.campaign.activeBattle).toBeNull();
    expect(again.campaign.score).toEqual(won.score);
    expect(again.campaign.inventory.items.stones).toBe(stuck.inventory.items.stones);
  });

  it('rejects end turn, dig, and leave while a battle is open', () => {
    const open = fresh().beginAttack(0, -1, undefined, 'attack-1', 1, NOW);
    expect(() => open.endTurn(NOW)).toThrow(ConflictError);
    expect(() => open.dig(0, 0, NOW)).toThrow(ConflictError);
    expect(() => open.leave(NOW)).toThrow(ConflictError);
    expect(() => open.finishExternal(NOW)).toThrow(ConflictError);
    expect(open.inventory.currencies.copper).toBe(6);
    expect(open.inventory.items.stones).toBe(0);
  });

  it('keeps a kit debit when stored rules have no battle entry', () => {
    const raw = fresh().toJSON() as {
      rules: { battleEntry?: string; attackFee?: number; battleKit?: Record<string, number> };
    };
    delete raw.rules.battleEntry;
    delete raw.rules.attackFee;
    raw.rules.battleKit = {
      stones: 8,
      scissors: 5,
      papers: 8,
      NA_effect_stone: 1,
      NA_effect_scissors: 1,
      NA_effect_papers: 1,
      NT_effect: 1
    };
    const campaign = Campaign.fromJSON(raw);
    expect(toCampaignView(campaign).rules).toMatchObject({ battleEntry: 'wager' });
    expect(toCampaignView(campaign).rules).not.toHaveProperty('attackFee');
    const short = Campaign.fromJSON({
      ...raw,
      inventory: {
        items: { ...campaign.inventory.items, stones: 7 },
        currencies: campaign.inventory.toJSON().currencies
      }
    });
    expect(() => short.beginAttack(0, -1, undefined, 'a', 1, NOW)).toThrow(/battle kit/);
    expect(short.blockedReasons()).toContain('cannot_afford_battle');
    const opened = campaign.beginAttack(0, -1, undefined, 'a', 1, NOW);
    expect(opened.inventory.items.stones).toBe(6);
    expect(opened.inventory.items.scissors).toBe(5);
    expect(opened.inventory.currencies.copper).toBe(16);
    expect(opened.activeBattle?.wager).toMatchObject({ stones: 8, scissors: 5 });
    expect(opened.activeBattle?.committedItems).toBeUndefined();
    expect(opened.activeBattle?.feeCopper).toBeUndefined();
  });

  it('rejects an attack with no action point while the fee can be paid', () => {
    const raw = fresh().toJSON() as { actionPoints: number };
    raw.actionPoints = 0;
    const spent = Campaign.fromJSON(raw);
    expect(() => spent.beginAttack(0, -1, undefined, 'a', 1, NOW)).toThrow(/No action point/);
    expect(spent.inventory.currencies.copper).toBe(16);
    expect(spent.inventory.items.stones).toBe(14);
  });
});

function stake(opened: Campaign): Record<string, number> {
  const battle = opened.activeBattle;
  return { ...(battle?.committedItems ?? battle?.wager ?? {}) };
}

function facts(kind: 'win' | 'loss' | 'broken', opened: Campaign) {
  return {
    attackId: 'attack-1',
    gameId: 'game-1',
    kind,
    leftovers: { items: { ...stake(opened) }, currencies: { gold: 0, silver: 0, copper: 0 } },
    npcLeftovers: { items: { stones: 4 }, currencies: {} },
    playerRoundWins: kind === 'win' ? 3 : 1,
    npcRoundWins: kind === 'win' ? 1 : 3
  };
}

function captureGate(campaign: Campaign): Campaign {
  const opened = campaign.beginAttack(0, -1, { q: 0, r: 0 }, 'attack-1', 1, NOW).attachGame('game-1', NOW);
  return opened.applyBattle(facts('win', opened), NOW).campaign;
}

function captureSouth(campaign: Campaign): Campaign {
  const ready = campaign.actionPoints > 0 ? campaign : campaign.endTurn(NOW);
  const opened = ready.beginAttack(0, 1, { q: 0, r: 0 }, 'attack-south', 2, NOW).attachGame('game-south', NOW);
  return opened.applyBattle({
    attackId: 'attack-south',
    gameId: 'game-south',
    kind: 'win',
    leftovers: { items: { ...stake(opened) }, currencies: {} },
    playerRoundWins: 3,
    npcRoundWins: 0
  }, NOW).campaign;
}

function takeCitadel(campaign: Campaign): Campaign {
  const owned = captureGate(campaign).endTurn(NOW);
  const opened = owned.beginAttack(0, -2, { q: 0, r: -1 }, 'citadel', 3, NOW).attachGame('game-citadel', NOW);
  return opened.applyBattle({
    attackId: 'citadel',
    gameId: 'game-citadel',
    kind: 'win',
    leftovers: { items: { ...stake(opened) }, currencies: {} },
    playerRoundWins: 4,
    npcRoundWins: 2
  }, NOW).campaign;
}
