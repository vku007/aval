import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CampaignService } from './CampaignService.js';
import { GameProcessorService } from './GameProcessorService.js';
import { loadConfig } from '../../config/environment.js';
import { User } from '../../domain/entity/User.js';
import { GameEntity } from '../../domain/entity/GameEntity.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { GamePlayerInventory } from '../../domain/value-object/GamePlayerInventory.js';
import { Round } from '../../domain/value-object/Round.js';
import { RoundStatus } from '../../domain/value-object/RoundStatus.js';
import { FileGameRepository } from '../../infrastructure/persistence/FileGameRepository.js';
import { FileUserRepository } from '../../infrastructure/persistence/FileUserRepository.js';
import { LocalJsonStore } from '../../infrastructure/persistence/LocalJsonStore.js';
import { Logger } from '../../shared/logging/Logger.js';
import { ConflictError, NotFoundError, PreconditionFailedError, ValidationError } from '../../shared/errors/index.js';
import { Campaign } from '../../domain/campaign/Campaign.js';
import { CHAPTER_I } from '../../domain/campaign/ChapterI.js';
import { Action } from '../../domain/value-object/Action.js';
import { ActionType } from '../../domain/value-object/ActionType.js';
import { ActionContext } from '../../domain/value-object/ActionContext.js';

describe('CampaignService', () => {
  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('UC-1, UC-2, UC-3, UC-13, UC-16: catalog, start, replay, and another player', async () => {
    const { campaigns, users } = await boot();
    const first = await campaigns.catalog('player-1', { name: 'Ada Lovelace', externalId: 17 });
    const chapter = (first.body.definitions as Array<Record<string, unknown>>)[0];
    expect(chapter).toMatchObject({ id: 'chapter-i', currentStatus: 'not_started', bestScore: null, history: [] });
    expect(chapter.instanceId).toBeUndefined();

    const started = await campaigns.start('player-1', 'chapter-i', first.etag!);
    const campaign = started.body.campaign as { id: string; status: string; turns: number };
    expect(campaign.status).toBe('started');
    expect(campaign.turns).toBe(1);
    await expect(campaigns.start('player-1', 'chapter-i', started.etag!)).rejects.toBeInstanceOf(ConflictError);
    await expect(campaigns.start('player-1', 'missing', started.etag!)).rejects.toBeInstanceOf(NotFoundError);
    await expect(campaigns.get('player-2', campaign.id)).rejects.toBeInstanceOf(NotFoundError);

    const left = await campaigns.act('player-1', campaign.id, { type: 'leave' }, started.etag!);
    expect((left.body.campaign as { finishReason: string }).finishReason).toBe('abandoned');
    expect((left.body.campaign as { score?: unknown }).score).toBeUndefined();
    const again = await campaigns.start('player-1', 'chapter-i', left.etag!);
    expect((again.body.campaign as { id: string }).id).not.toBe(campaign.id);
    const stored = await users.findById('player-1');
    expect(stored?.campaigns).toHaveLength(2);
    expect(stored?.campaigns.find(item => item.id === campaign.id)?.status).toBe('finished');

    const catalog = await campaigns.catalog('player-1', { name: 'Ada Lovelace', externalId: 17 });
    const row = (catalog.body.definitions as Array<Record<string, unknown>>)[0];
    expect(row.currentStatus).toBe('started');
    expect(row.bestScore).toBeNull();
    expect(row.history).toEqual([
      expect.objectContaining({ instanceId: campaign.id, finishReason: 'abandoned', score: null })
    ]);
  });

  it('keeps campaigns when the profile is renamed, and loads a file that has none', async () => {
    const { users, store } = await boot();
    const created = await users.save(User.create('player-1', 'Ada Lovelace', 17));
    const withRun = created.withCampaigns([Campaign.start(CHAPTER_I, 1, 'campaign-keep')]);
    const saved = await users.save(withRun, { ifMatch: created.metadata?.etag });
    const renamed = await users.save(saved.updateName('Ada Renamed'), { ifMatch: saved.metadata?.etag });
    const loaded = await users.findById('player-1');
    expect(loaded?.name).toBe('Ada Renamed');
    expect(renamed.campaigns.map(campaign => campaign.id)).toEqual(['campaign-keep']);
    expect(loaded?.campaigns.map(campaign => campaign.id)).toEqual(['campaign-keep']);
    expect(loaded?.campaigns[0].rules.digCost).toBe(4);
    expect(loaded?.settings).toEqual({});

    const flagged = await users.save(
      loaded!.withSettings({ hideAttackFeeNotice: true }),
      { ifMatch: loaded?.metadata?.etag }
    );
    const kept = await users.findById('player-1');
    expect(flagged.settings).toEqual({ hideAttackFeeNotice: true });
    expect(kept?.settings).toEqual({ hideAttackFeeNotice: true });
    expect(kept?.campaigns.map(campaign => campaign.id)).toEqual(['campaign-keep']);

    await store.put('json/users/old-user.json', { name: 'Old File', externalId: 4 });
    const old = await users.findById('old-user');
    expect(old?.campaigns).toEqual([]);
    expect(old?.settings).toEqual({});
    const onDisk = JSON.parse(await readFile(path.join(dir, 'json/users/player-1.json'), 'utf8'));
    expect(Array.isArray(onDisk.campaigns)).toBe(true);
    expect(onDisk.campaigns.length).toBeGreaterThan(0);
  });

  it('UC-5, UC-5b, UC-15, UC-17: attack, autobattle, lobby create, and a stale end turn', async () => {
    const { campaigns, games } = await boot();
    const started = await open('player-1', campaigns);
    const attacked = await campaigns.act('player-1', started.id, {
      type: 'attack', q: 0, r: -1, from: { q: 0, r: 0 }
    }, started.etag);
    expect(attacked.body.gameId).toEqual(expect.any(String));
    const view = attacked.body.campaign as {
      actionPoints: number;
      activeBattle: { gameId: string };
      inventory: { items: { stones: number; scissors: number }; currencies: { copper: number; gold: number } };
      rules: { battleEntry: string; attackFee: { copper: number }; battleKit?: unknown };
    };
    expect(view.actionPoints).toBe(0);
    expect(view.inventory.items.stones).toBe(0);
    expect(view.inventory.items.scissors).toBe(0);
    expect(view.inventory.currencies.copper).toBe(6);
    expect(view.inventory.currencies.gold).toBe(0);
    expect(view.rules.battleEntry).toBe('fee');
    expect(view.rules.attackFee.copper).toBe(10);
    expect(view.rules.battleKit).toBeUndefined();
    expect(view.activeBattle.gameId).toBe(attacked.body.gameId);
    const linked = await games.load(String(attacked.body.gameId));
    expect(linked?.game.campaignId).toBe(started.id);
    expect(linked?.game.createContext?.campaign.name).toBe('Chapter I');
    expect(linked?.game.inventories[0].currencies.copper).toBe(0);
    expect(linked?.game.inventories[0].items).toMatchObject({
      stones: 14,
      scissors: 10,
      papers: 14,
      NA_effect_stone: 2,
      NA_effect_scissors: 2,
      NA_effect_papers: 2,
      NT_effect: 2
    });
    expect(linked?.game.inventories[1].currencies.copper).toBe(0);
    expect(linked?.game.inventories[1].items.stones).toBe(9);
    expect(linked?.game.campaignNpcAlgorithmId).toBe('npc-v1');
    await expect(campaigns.act('player-1', started.id, { type: 'dig', q: 0, r: 0 }, attacked.etag!)).rejects.toBeInstanceOf(ConflictError);
    await expect(campaigns.act('player-1', started.id, { type: 'end_turn' }, attacked.etag!)).rejects.toBeInstanceOf(ConflictError);
    await expect(campaigns.act('player-1', started.id, { type: 'leave' }, attacked.etag!)).rejects.toBeInstanceOf(ConflictError);

    const played = await campaigns.act('player-1', started.id, { type: 'autobattle' }, attacked.etag!);
    expect(played.body.battleOutcome).toEqual(expect.objectContaining({
      q: 0,
      r: -1,
      result: expect.stringMatching(/victory|defeat/)
    }));
    const battleGame = await games.load(String(attacked.body.gameId));
    expect(battleGame?.game.rounds.length).toBeGreaterThan(0);
    await expect(campaigns.act('player-1', started.id, { type: 'autobattle' }, played.etag!)).rejects.toBeInstanceOf(ConflictError);

    const { GameCreateContext } = await import('../dto/processor/GameCreateContext.js');
    const lobby = await games.createGame({
      userId: 'player-1',
      gameCreateContext: GameCreateContext.fromJSON({
        gameType: 'PVE',
        rounds: 'BO3',
        kind: 'classic',
        level: { name: 'Level1' },
        campaign: { name: 'Episode1' }
      })
    } as never);
    const lobbyGame = await games.load(lobby.gameId);
    expect(lobbyGame?.game.campaignId).toBeUndefined();
    const afterLobby = await campaigns.get('player-1', started.id);
    expect((afterLobby.body.campaign as { id: string }).id).toBe(started.id);

    const fresh = await open('player-2', campaigns);
    const paid = await campaigns.act('player-2', fresh.id, { type: 'end_turn' }, fresh.etag);
    expect((paid.body.campaign as { inventory: { currencies: { copper: number } } }).inventory.currencies.copper).toBe(18);
    await expect(campaigns.act('player-2', fresh.id, { type: 'end_turn' }, fresh.etag)).rejects.toBeInstanceOf(PreconditionFailedError);
    const once = await campaigns.get('player-2', fresh.id);
    expect((once.body.campaign as { inventory: { currencies: { copper: number } } }).inventory.currencies.copper).toBe(18);
  });

  it('rejects autobattle after a throw, and resolves a finished game on the next read', async () => {
    const { campaigns, games } = await boot();
    const started = await open('player-1', campaigns);
    const attacked = await campaigns.act('player-1', started.id, { type: 'attack', q: 0, r: -1 }, started.etag);
    const gameId = String(attacked.body.gameId);
    await games.updateGame('player-1', gameId, new Action(ActionType.Surrender, new ActionContext()));
    const afterThrow = await campaigns.get('player-1', started.id);
    await expect(campaigns.act('player-1', started.id, { type: 'autobattle' }, afterThrow.etag!)).rejects.toBeInstanceOf(ConflictError);
    const read = await campaigns.get('player-1', started.id);
    const campaign = read.body.campaign as {
      activeBattle: unknown;
      tiles: Array<{ q: number; r: number; visibility: string }>;
      inventory: { items: { stones: number } };
    };
    expect(campaign.activeBattle).toBeNull();
    expect(read.body.battleOutcome).toEqual(expect.objectContaining({ result: 'defeat' }));
    expect(campaign.tiles.find(tile => tile.q === 0 && tile.r === -1)?.visibility).toBe('seen');
    expect(campaign.inventory.items.stones).toBeLessThanOrEqual(14);

    const second = await open('player-3', campaigns);
    const battle = await campaigns.act('player-3', second.id, { type: 'attack', q: 0, r: -1 }, second.etag);
    const loaded = await games.load(String(battle.body.gameId));
    const game = loaded!.game;
    for (let i = 0; i < 3; i++) {
      game.addRound(new Round(`round-${i + 1}`, RoundStatus.Finished, 1, 'player-3', 2));
    }
    game.setStatus(GameStatus.Finished);
    await games.save(game, loaded!.etag);
    const repaired = await campaigns.get('player-3', second.id);
    const won = repaired.body.campaign as { tiles: Array<{ q: number; r: number; visibility: string }>; inventory: { items: { stones: number }; currencies: { silver: number } } };
    expect(repaired.body.battleOutcome).toEqual(expect.objectContaining({ result: 'victory' }));
    expect(won.tiles.find(tile => tile.q === 0 && tile.r === -1)?.visibility).toBe('owned');
    expect(won.inventory.items.stones).toBe(17);
    expect(won.inventory.currencies.silver).toBe(1);
    const twice = await campaigns.get('player-3', second.id);
    expect((twice.body.campaign as { inventory: { items: { stones: number } } }).inventory.items.stones).toBe(17);
    expect(won.tiles.find(tile => tile.q === 0 && tile.r === -1)).not.toHaveProperty('garrison');
  });

  it('writes a lost garrison back and seats the next attack from it', async () => {
    const { campaigns, games } = await boot();
    const started = await open('player-4', campaigns);
    const battle = await campaigns.act('player-4', started.id, { type: 'attack', q: 0, r: -1 }, started.etag);
    const loaded = await games.load(String(battle.body.gameId));
    const game = loaded!.game;
    game.inventories = game.inventories.map(row => row.userId === 'NPC_1'
      ? new GamePlayerInventory(row.userId, { ...row.items, stones: 2 }, { ...row.currencies }, row.time)
      : row);
    for (let i = 0; i < 3; i++) {
      game.addRound(new Round(`round-${i + 1}`, RoundStatus.Finished, 1, 'NPC_1', 2));
    }
    game.setStatus(GameStatus.Finished);
    await games.save(game, loaded!.etag);
    const repaired = await campaigns.get('player-4', started.id);
    const lost = repaired.body.campaign as {
      tiles: Array<{ q: number; r: number; garrison?: { inventory: { items: { stones: number } }; npcAlgorithmId: string } }>;
      inventory: { items: { stones: number } };
    };
    const gate = lost.tiles.find(tile => tile.q === 0 && tile.r === -1);
    expect(gate?.garrison?.npcAlgorithmId).toBe('npc-v1');
    expect(gate?.garrison).not.toHaveProperty('known');
    expect(gate?.garrison?.inventory.items.stones).toBe(2);
    expect(lost.inventory.items.stones).toBe(14);
    expect(repaired.body.battleOutcome).toEqual(expect.objectContaining({
      result: 'defeat',
      reward: null
    }));
    const paid = await campaigns.act('player-4', started.id, { type: 'end_turn' }, repaired.etag!);
    const cleared = await campaigns.get('player-4', started.id);
    expect(cleared.body.battleOutcome).toBeUndefined();
    const funded = await campaigns.act('player-4', started.id, { type: 'end_turn' }, paid.etag!);
    const again = await campaigns.act('player-4', started.id, { type: 'attack', q: 0, r: -1 }, funded.etag!);
    const next = await games.load(String(again.body.gameId));
    expect(next?.game.inventories.find(row => row.userId === 'NPC_1')?.items.stones).toBe(2);
    expect(next?.game.campaignNpcAlgorithmId).toBe('npc-v1');
  });

  it('copies a npc-greed-v1 garrison onto the game and still seats NPC_1', async () => {
    const { campaigns, games, users } = await boot();
    const started = await open('player-6', campaigns);
    const user = await users.findById('player-6');
    const raw = user!.campaigns[0].toJSON() as {
      tiles: Array<{ q: number; r: number; garrison: { npcAlgorithmId: string } | null }>;
    };
    const gate = raw.tiles.find(tile => tile.q === 0 && tile.r === -1);
    gate!.garrison!.npcAlgorithmId = 'npc-greed-v1';
    const saved = await users.save(user!.withCampaigns([Campaign.fromJSON(raw)]), { ifMatch: user!.metadata?.etag });
    const attacked = await campaigns.act('player-6', started.id, { type: 'attack', q: 0, r: -1 }, saved.metadata!.etag!);
    const linked = await games.load(String(attacked.body.gameId));
    expect(linked?.game.usersIds).toEqual(['player-6', 'NPC_1']);
    expect(linked?.game.campaignNpcAlgorithmId).toBe('npc-greed-v1');
  });

  it('rejects an unknown garrison algorithm and leaves the campaign unchanged', async () => {
    const { campaigns, users } = await boot();
    const started = await open('player-5', campaigns);
    const user = await users.findById('player-5');
    const raw = user!.campaigns[0].toJSON() as {
      tiles: Array<{ q: number; r: number; garrison: { npcAlgorithmId: string } | null }>;
    };
    const gate = raw.tiles.find(tile => tile.q === 0 && tile.r === -1);
    gate!.garrison!.npcAlgorithmId = 'npc-other';
    const saved = await users.save(user!.withCampaigns([Campaign.fromJSON(raw)]), { ifMatch: user!.metadata?.etag });
    await expect(campaigns.act('player-5', started.id, { type: 'attack', q: 0, r: -1 }, saved.metadata!.etag!))
      .rejects.toBeInstanceOf(ValidationError);
    const after = await campaigns.get('player-5', started.id);
    const view = after.body.campaign as { activeBattle: unknown; inventory: { items: { stones: number } } };
    expect(view.activeBattle).toBeNull();
    expect(view.inventory.items.stones).toBe(14);
  });

  it('UC-8 and the empty gameId refund', async () => {
    const { campaigns, games, users } = await boot();
    const started = await open('player-1', campaigns);
    const attacked = await campaigns.act('player-1', started.id, { type: 'attack', q: 0, r: -1 }, started.etag);
    const loaded = await games.load(String(attacked.body.gameId));
    loaded!.game.setStatus(GameStatus.Broken);
    await games.save(loaded!.game, loaded!.etag);
    const refunded = await campaigns.get('player-1', started.id);
    const view = refunded.body.campaign as {
      actionPoints: number;
      activeBattle: unknown;
      inventory: { items: { stones: number } };
      tiles: Array<{ q: number; r: number; garrison?: unknown }>;
    };
    expect(view.actionPoints).toBe(1);
    expect(view.activeBattle).toBeNull();
    expect(view.inventory.items.stones).toBe(14);
    expect(view.tiles.find(tile => tile.q === 0 && tile.r === -1)).not.toHaveProperty('garrison');
    expect(refunded.body.battleOutcome).toBeUndefined();

    const user = await users.findById('player-1');
    const raw = user!.campaigns[0].toJSON() as {
      activeBattle: {
        attackId: string;
        battleSeed: number;
        gameId: string | null;
        q: number;
        r: number;
        wager: Record<string, number>;
        resolved: boolean;
      } | null;
    };
    raw.activeBattle = {
      attackId: 'attack-open',
      battleSeed: 1,
      gameId: null,
      q: 0,
      r: -1,
      wager: { stones: 8, scissors: 5, papers: 8, NA_effect_stone: 1, NA_effect_scissors: 1, NA_effect_papers: 1, NT_effect: 1 },
      resolved: false
    };
    const { Campaign } = await import('../../domain/campaign/Campaign.js');
    const debited = Campaign.fromJSON({
      ...user!.campaigns[0].toJSON(),
      activeBattle: raw.activeBattle,
      actionPoints: 0,
      inventory: {
        items: { ...user!.campaigns[0].inventory.items, stones: 6 },
        currencies: user!.campaigns[0].inventory.toJSON().currencies
      }
    });
    await users.save(user!.withCampaigns([debited]), { ifMatch: user!.metadata?.etag });
    const repaired = await campaigns.get('player-1', debited.id);
    expect((repaired.body.campaign as { inventory: { items: { stones: number } }; actionPoints: number }).inventory.items.stones).toBe(14);
    expect((repaired.body.campaign as { actionPoints: number }).actionPoints).toBe(1);
  });

  it('UC-19: external finish, and UC-11 catalog after victory', async () => {
    const { campaigns, games } = await boot();
    const started = await open('player-1', campaigns);
    await expect(campaigns.finishExternal('player-1', started.id, 'not-the-etag')).rejects.toBeInstanceOf(PreconditionFailedError);
    const finished = await campaigns.finishExternal('player-1', started.id, started.etag);
    expect((finished.body.campaign as { finishReason: string; score?: unknown }).finishReason).toBe('external');
    expect((finished.body.campaign as { score?: unknown }).score).toBeUndefined();
    await expect(campaigns.act('player-1', started.id, { type: 'end_turn' }, finished.etag!)).rejects.toBeInstanceOf(ConflictError);
    const catalog = await campaigns.catalog('player-1', { name: 'Ada Lovelace', externalId: 17 });
    expect((catalog.body.definitions as Array<{ currentStatus: string; bestScore: null }>)[0].currentStatus).toBe('not_started');

    const replay = await open('player-4', campaigns);
    const gate = await campaigns.act('player-4', replay.id, { type: 'attack', q: 0, r: -1 }, replay.etag);
    await winGame(games, String(gate.body.gameId), 'player-4', 3);
    const after = await campaigns.get('player-4', replay.id);
    const turned = await campaigns.act('player-4', replay.id, { type: 'end_turn' }, after.etag!);
    const citadel = await campaigns.act('player-4', replay.id, {
      type: 'attack', q: 0, r: -2, from: { q: 0, r: -1 }
    }, turned.etag!);
    await winGame(games, String(citadel.body.gameId), 'player-4', 4);
    const done = await campaigns.get('player-4', replay.id);
    const finalView = done.body.campaign as { status: string; finishReason: string; score: { total: number } };
    expect(finalView.status).toBe('finished');
    expect(finalView.finishReason).toBe('victory');
    expect(finalView.score.total).toEqual(expect.any(Number));
    const listed = await campaigns.catalog('player-4', { name: 'Ada Lovelace', externalId: 17 });
    const row = (listed.body.definitions as Array<{ currentStatus: string; bestScore: number; history: Array<{ finishReason: string; score: { total: number } | null }> }>)[0];
    expect(row.currentStatus).toBe('not_started');
    expect(row.bestScore).toBe(finalView.score.total);
    expect(row.history[0]).toMatchObject({ finishReason: 'victory', score: { total: finalView.score.total } });
  });

  it('cancels an attack that has no move and returns the items and the fee', async () => {
    const { campaigns, games } = await boot();
    const started = await open('player-1', campaigns);
    const attacked = await campaigns.act('player-1', started.id, { type: 'attack', q: 0, r: -1 }, started.etag);
    const cancelled = await campaigns.act('player-1', started.id, { type: 'cancel_attack' }, attacked.etag!);
    const view = cancelled.body.campaign as {
      actionPoints: number;
      activeBattle: unknown;
      inventory: { items: { stones: number }; currencies: { copper: number } };
    };
    expect(view.actionPoints).toBe(1);
    expect(view.activeBattle).toBeNull();
    expect(view.inventory.items.stones).toBe(14);
    expect(view.inventory.currencies.copper).toBe(16);
    const stored = await games.load(String(attacked.body.gameId));
    expect(stored?.game.status).toBe(GameStatus.Broken);
    await expect(campaigns.act('player-1', started.id, { type: 'cancel_attack' }, cancelled.etag!)).rejects.toBeInstanceOf(ConflictError);

    const again = await campaigns.act('player-1', started.id, { type: 'attack', q: 0, r: -1 }, cancelled.etag!);
    const openGame = await games.load(String(again.body.gameId));
    openGame!.game.addRound(new Round('round-1', RoundStatus.Current, 1));
    await games.save(openGame!.game, openGame!.etag);
    await expect(campaigns.act('player-1', started.id, { type: 'cancel_attack' }, again.etag!))
      .rejects.toThrow('The battle already has a move');
    const held = await campaigns.get('player-1', started.id);
    const heldView = held.body.campaign as { activeBattle: { gameId: string }; inventory: { items: { stones: number } } };
    expect(heldView.activeBattle.gameId).toBe(again.body.gameId);
    expect(heldView.inventory.items.stones).toBe(0);
  });

  it('rejects sell, an unpriced buy, and a missing If-Match at the schema and domain', async () => {
    const { campaigns } = await boot();
    const started = await open('player-1', campaigns);
    await expect(campaigns.act('player-1', started.id, { type: 'buy', item: 'silver', amount: 1 }, started.etag))
      .rejects.toBeInstanceOf(ValidationError);
    const bought = await campaigns.act('player-1', started.id, { type: 'buy', item: 'stones', amount: 2 }, started.etag);
    expect((bought.body.campaign as { inventory: { items: { stones: number }; currencies: { copper: number } } }).inventory)
      .toMatchObject({ items: { stones: 16 }, currencies: { copper: 10 } });
  });
});

async function boot() {
  dir = await mkdtemp(path.join(tmpdir(), 'aval-campaign-'));
  const store = new LocalJsonStore(dir);
  const config = loadConfig();
  const users = new FileUserRepository(store, config, (id, name, externalId, etag, metadata) =>
    User.create(id, name, externalId, etag, metadata)
  );
  const games = new FileGameRepository(store, config, (id, usersIds, rounds, isFinished, etag, metadata) =>
    GameEntity.create(id, usersIds, rounds, isFinished ? GameStatus.Finished : GameStatus.Created, etag, metadata)
  );
  const processor = new GameProcessorService(games);
  const campaigns = new CampaignService(users, processor, new Logger());
  processor.setBattleSink(campaigns);
  return { campaigns, users, games: processor, store };
}

let dir: string;

async function winGame(games: GameProcessorService, gameId: string, userId: string, wins: number) {
  const loaded = await games.load(gameId);
  if (!loaded) {
    throw new Error(`missing ${gameId}`);
  }
  for (let i = 0; i < wins; i++) {
    loaded.game.addRound(new Round(`round-${i + 1}`, RoundStatus.Finished, 1, userId, 2));
  }
  loaded.game.setStatus(GameStatus.Finished);
  await games.save(loaded.game, loaded.etag);
}

async function open(userId: string, campaigns: CampaignService) {
  const catalog = await campaigns.catalog(userId, { name: 'Ada Lovelace', externalId: 17 });
  const started = await campaigns.start(userId, 'chapter-i', catalog.etag!);
  const campaign = started.body.campaign as { id: string };
  return { id: campaign.id, etag: started.etag! };
}
