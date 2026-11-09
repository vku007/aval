import { describe, expect, it } from 'vitest';
import { Game } from '../../domain/entity/Game.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { GameCreateContext } from '../dto/processor/GameCreateContext.js';
import { GameType } from '../../domain/value-object/GameType.js';
import { RoundsLength } from '../../domain/value-object/RoundsLength.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';
import { GameLevel } from '../../domain/value-object/GameLevel.js';
import { CampaignContext } from '../../domain/value-object/CampaignContext.js';
import { GamePlayerInventory } from '../../domain/value-object/GamePlayerInventory.js';
import { FileGameRepository } from '../../infrastructure/persistence/FileGameRepository.js';
import { LocalJsonStore } from '../../infrastructure/persistence/LocalJsonStore.js';
import { GameEntity } from '../../domain/entity/GameEntity.js';
import { loadConfig } from '../../config/environment.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AUTOBATTLE_THROW_CAP, freshAutobattleMemory, planPlayerThrow, playAutobattle } from './Autobattle.js';
import { GameProcessorService } from '../services/GameProcessorService.js';

describe('Autobattle', () => {
  it('plays the same moves as a throw-by-throw match with the same seed', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'aval-autobattle-'));
    try {
      const simulated = battle(11);
      const stepped = battle(11);
      playAutobattle(simulated);

      const store = new LocalJsonStore(dir);
      const games = new FileGameRepository(store, loadConfig(), (id, usersIds, rounds, isFinished, etag, metadata) =>
        GameEntity.create(id, usersIds, rounds, isFinished ? GameStatus.Finished : GameStatus.Created, etag, metadata)
      );
      const service = new GameProcessorService(games);
      await games.save(new GameEntity(
        stepped.id,
        stepped.usersIds,
        stepped.rounds,
        stepped.status,
        undefined,
        undefined,
        stepped.createContext,
        stepped.endTime,
        stepped.outcome.toJSON(),
        stepped.inventories,
        stepped.campaignLink()
      ), { ifNoneMatch: '*' });

      const memory = freshAutobattleMemory();
      let guard = 0;
      while (guard < 60) {
        const loaded = await service.load(stepped.id);
        if (!loaded || loaded.game.status === GameStatus.Finished || loaded.game.status === GameStatus.Broken) {
          break;
        }
        const action = planPlayerThrow(loaded.game, memory);
        await service.updateGame('human-1', stepped.id, action);
        guard += 1;
      }
      const finished = await service.load(stepped.id);
      expect(signatures(simulated)).toEqual(signatures(finished!.game));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('breaks a match that reaches the throw cap and does not call the cap for a normal fight', () => {
    expect(AUTOBATTLE_THROW_CAP).toBe(48);
    const game = battle(4);
    playAutobattle(game, 1);
    expect(game.status).toBe(GameStatus.Broken);
  });
});

function battle(seed: number): Game {
  const game = new Game(
    'game-seed',
    ['human-1', 'NPC_1'],
    GameStatus.Created,
    new GameCreateContext(
      GameType.PVE,
      RoundsLength.BO5,
      KindOfGame.Extended,
      new GameLevel('easy'),
      new CampaignContext('Chapter I')
    )
  );
  const now = 10;
  game.inventories = [
    GamePlayerInventory.advancedFor('human-1', now),
    GamePlayerInventory.advancedFor('NPC_1', now)
  ];
  game.assignCampaignLink({
    campaignId: 'campaign-1',
    campaignTile: { q: 0, r: -1 },
    campaignAttackId: 'attack-1',
    campaignBattleSeed: seed
  });
  return game;
}

function signatures(game: Game) {
  return [...game.usersIds.flatMap(userId => game.getMovesForUser(userId).map(move => ({
    userId,
    moveType: move.context.moveType,
    size: move.context.size,
    effects: move.context.effects.map(effect => effect.kind)
  })))];
}
