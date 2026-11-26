import { describe, expect, it } from 'vitest';
import { GameCreateContext } from '../dto/processor/GameCreateContext.js';
import { factsFromGame } from './Repair.js';
import { Game } from '../../domain/entity/Game.js';
import { CampaignContext } from '../../domain/value-object/CampaignContext.js';
import { GameLevel } from '../../domain/value-object/GameLevel.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { GameType } from '../../domain/value-object/GameType.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';
import { Round } from '../../domain/value-object/Round.js';
import { RoundStatus } from '../../domain/value-object/RoundStatus.js';
import { RoundsLength } from '../../domain/value-object/RoundsLength.js';

const ATTACK = 'attack-1';

describe('factsFromGame', () => {
  it('treats a finished extended match with no best-of winner as an attacker loss', () => {
    const tied = finished(KindOfGame.Extended);
    const ahead = finished(KindOfGame.Extended);
    award(ahead, 'player-1', 2);
    award(ahead, 'NPC_1', 1);

    expect(factsFromGame(tied, ATTACK)).toEqual({
      attackId: ATTACK,
      gameId: tied.id,
      kind: 'loss',
      leftovers: {
        items: { ...tied.inventories[0].items },
        currencies: { ...tied.inventories[0].currencies }
      },
      npcLeftovers: {
        items: { ...tied.inventories[1].items },
        currencies: { ...tied.inventories[1].currencies }
      },
      playerRoundWins: 0,
      npcRoundWins: 0
    });
    expect(factsFromGame(ahead, ATTACK)).toMatchObject({
      kind: 'loss',
      playerRoundWins: 2,
      npcRoundWins: 1
    });
  });

  it('keeps a reached best-of threshold as a win or a loss', () => {
    const won = finished(KindOfGame.Extended);
    award(won, 'player-1', 3);
    const lost = finished(KindOfGame.Extended);
    award(lost, 'NPC_1', 3);

    expect(factsFromGame(won, ATTACK)).toMatchObject({ kind: 'win', playerRoundWins: 3, npcRoundWins: 0 });
    expect(factsFromGame(lost, ATTACK)).toMatchObject({ kind: 'loss', playerRoundWins: 0, npcRoundWins: 3 });
  });

  it('leaves classic, a missing length, an outside winner, a broken game, and an open game alone', () => {
    const classic = finished(KindOfGame.Classic);
    const missingLength = finished(KindOfGame.Extended);
    award(missingLength, 'player-1', 3);
    (missingLength.createContext as { rounds?: RoundsLength }).rounds = undefined;
    const outsider = finished(KindOfGame.Extended);
    award(outsider, 'other-seat', 3);

    expect(factsFromGame(classic, ATTACK)).toBe('unresolved');
    expect(factsFromGame(missingLength, ATTACK)).toBe('unresolved');
    expect(factsFromGame(outsider, ATTACK)).toBe('unresolved');
    expect(factsFromGame(finished(KindOfGame.Extended, GameStatus.Broken), ATTACK)).toMatchObject({
      kind: 'broken'
    });
    expect(factsFromGame(finished(KindOfGame.Extended, GameStatus.Created), ATTACK)).toBe('open');
    expect(factsFromGame(finished(KindOfGame.Extended, GameStatus.Started), ATTACK)).toBe('open');
  });
});

function finished(kind: KindOfGame, status: GameStatus = GameStatus.Finished): Game {
  return new Game(
    'game-1',
    ['player-1', 'NPC_1'],
    status,
    new GameCreateContext(
      GameType.PVE,
      RoundsLength.BO5,
      kind,
      new GameLevel('normal'),
      new CampaignContext('Chapter I')
    )
  );
}

function award(game: Game, winnerId: string, count: number): void {
  for (let i = 0; i < count; i++) {
    game.addRound(new Round(`round-${game.rounds.length + 1}`, RoundStatus.Finished, 1, winnerId, 2));
  }
}
