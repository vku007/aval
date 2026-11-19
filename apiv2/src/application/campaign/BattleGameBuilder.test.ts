import { describe, expect, it, vi } from 'vitest';
import { buildBattleGame } from './BattleGameBuilder.js';
import { GameProcessorService } from '../services/GameProcessorService.js';
import type { BattleGameSpec } from '../services/CampaignGamePort.js';
import type { IGameRepository } from '../services/GameService.js';
import { GameEntity } from '../../domain/entity/GameEntity.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { GameType } from '../../domain/value-object/GameType.js';
import { RoundsLength } from '../../domain/value-object/RoundsLength.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';
import { ITEM_KEYS } from '../../domain/value-object/GamePlayerInventory.js';
import { NPC_ALGORITHM_V1 } from '../../domain/campaign/Garrison.js';
import { ValidationError } from '../../shared/errors/index.js';
import type { EntityMetadata } from '../../shared/types/common.js';

function spec(): BattleGameSpec {
  return {
    userId: 'player-1',
    campaignId: 'chapter-i',
    attackId: 'attack-9',
    seed: 42,
    tile: { q: 1, r: -1 },
    rounds: RoundsLength.BO7,
    levelName: 'hard',
    title: 'Chapter I',
    humanItems: { stones: 4, scissors: 1 },
    npcItems: { papers: 3, NT_effect: 1 },
    npcCurrencies: { gold: 5, copper: 2 },
    npcAlgorithmId: NPC_ALGORITHM_V1
  };
}

class MemoryGames implements IGameRepository {
  readonly saves: { game: GameEntity; opts?: { ifMatch?: string; ifNoneMatch?: string } }[] = [];

  async findById(): Promise<GameEntity | null> {
    return null;
  }

  async save(game: GameEntity, opts?: { ifMatch?: string; ifNoneMatch?: string }): Promise<GameEntity> {
    this.saves.push({ game, opts });
    return game;
  }

  async delete(): Promise<void> {}

  async findAll(): Promise<{ items: GameEntity[] }> {
    return { items: [] };
  }

  async listIds(): Promise<{ names: string[] }> {
    return { names: [] };
  }

  async getMetadata(): Promise<EntityMetadata> {
    return {};
  }
}

describe('buildBattleGame', () => {
  it('builds the campaign battle createBattle used to build inline', () => {
    const game = buildBattleGame(spec(), 'game-fixed', 1700000000000);

    expect(game.usersIds).toEqual(['player-1', 'NPC_1']);
    expect(game.status).toBe(GameStatus.Created);
    expect(game.createContext?.gameType).toBe(GameType.PVE);
    expect(game.createContext?.rounds).toBe(RoundsLength.BO7);
    expect(game.createContext?.kind).toBe(KindOfGame.Extended);
    expect(game.createContext?.level.name).toBe('hard');
    expect(game.createContext?.campaign.name).toBe('Chapter I');

    const [human, npc] = game.inventories;
    expect(human.userId).toBe('player-1');
    expect(human.time).toBe(1700000000000);
    expect(human.currencies).toEqual({ gold: 0, silver: 0, copper: 0 });
    expect(human.items).toEqual({
      stones: 4,
      scissors: 1,
      papers: 0,
      NA_effect_stone: 0,
      NA_effect_scissors: 0,
      NA_effect_papers: 0,
      NT_effect: 0
    });
    expect(Object.keys(human.items)).toEqual([...ITEM_KEYS]);

    expect(npc.userId).toBe('NPC_1');
    expect(npc.items).toEqual({
      stones: 0,
      scissors: 0,
      papers: 3,
      NA_effect_stone: 0,
      NA_effect_scissors: 0,
      NA_effect_papers: 0,
      NT_effect: 1
    });
    expect(npc.currencies).toEqual({ gold: 5, silver: 0, copper: 2 });

    expect(game.campaignLink()).toEqual({
      campaignId: 'chapter-i',
      campaignTile: { q: 1, r: -1 },
      campaignAttackId: 'attack-9',
      campaignBattleSeed: 42,
      campaignNpcAlgorithmId: NPC_ALGORITHM_V1
    });
  });

  it('rejects an unsupported algorithm', () => {
    expect(() => buildBattleGame({ ...spec(), npcAlgorithmId: 'npc-unknown' }, 'game-fixed', 0))
      .toThrow(ValidationError);
  });
});

describe('createBattle', () => {
  it('saves the builder game and passes ifNoneMatch *', async () => {
    const now = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const games = new MemoryGames();
    const service = new GameProcessorService(games);
    const input = spec();

    try {
      const { gameId } = await service.createBattle(input);

      expect(games.saves).toHaveLength(1);
      expect(games.saves[0].opts).toEqual({ ifNoneMatch: '*' });
      const saved = games.saves[0].game;
      const built = buildBattleGame(input, gameId, now);
      expect(saved.inventories.map(inventory => inventory.toJSON()))
        .toEqual(built.inventories.map(inventory => inventory.toJSON()));
      expect(saved.campaignLink).toEqual(built.campaignLink());
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('throws on an unsupported algorithm before any save', async () => {
    const games = new MemoryGames();
    const service = new GameProcessorService(games);

    await expect(service.createBattle({ ...spec(), npcAlgorithmId: 'npc-unknown' }))
      .rejects.toThrow(ValidationError);
    expect(games.saves).toHaveLength(0);
  });
});
