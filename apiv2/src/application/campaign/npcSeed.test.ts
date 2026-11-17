import { describe, expect, it } from 'vitest';
import { Game } from '../../domain/entity/Game.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { Action } from '../../domain/value-object/Action.js';
import { ActionContext } from '../../domain/value-object/ActionContext.js';
import { ActionType } from '../../domain/value-object/ActionType.js';
import { Move, MoveContext, MoveType } from '../../domain/value-object/Move.js';
import { GameType } from '../../domain/value-object/GameType.js';
import { RoundsLength } from '../../domain/value-object/RoundsLength.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';
import { GameLevel } from '../../domain/value-object/GameLevel.js';
import { CampaignContext } from '../../domain/value-object/CampaignContext.js';
import { GameCreateContext } from '../dto/processor/GameCreateContext.js';
import { Logger } from '../../shared/logging/Logger.js';
import { NPC_ALGORITHM_GREED_V1 } from '../../domain/campaign/Garrison.js';
import { campaignProcessor } from './npcSeed.js';

describe('campaignProcessor NPC algorithm', () => {
  it('npc-greed-v1 throws size 1 while the seat stays NPC_1', () => {
    const game = battle(NPC_ALGORITHM_GREED_V1);
    const processor = campaignProcessor(game, new Logger());
    const move = new Move('human-1', new MoveContext(MoveType.Stone, 1, 0), Date.now());
    processor.processAction(game, new Action(ActionType.Move, new ActionContext(move)), 'human-1');
    processor.doNpcAction(game);

    const npcMove = game.getMovesForUser('NPC_1')[0];
    expect(npcMove.context.size).toBe(1);
    expect(game.usersIds).toEqual(['human-1', 'NPC_1']);
  });
});

function battle(algorithmId: string): Game {
  const game = new Game(
    'game-algorithm',
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
  game.assignCampaignLink({
    campaignId: 'campaign-1',
    campaignTile: { q: 0, r: -1 },
    campaignAttackId: 'attack-1',
    campaignBattleSeed: 7,
    campaignNpcAlgorithmId: algorithmId
  });
  return game;
}
