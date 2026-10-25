import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MAX_PAPER_PER_TURN,
  DEFAULT_MAX_SCISSORS_PER_TURN,
  DEFAULT_MAX_STONE_PER_TURN,
  GameCreateContext
} from './GameCreateContext.js';
import { GameContext } from './response/context/GameContext.js';
import { GameType } from '../../../domain/value-object/GameType.js';
import { RoundsLength } from '../../../domain/value-object/RoundsLength.js';
import { KindOfGame } from '../../../domain/value-object/KindOfGame.js';
import { GameStatus } from '../../../domain/value-object/GameStatus.js';
import { ValidationError } from '../../../shared/errors/index.js';

const base = {
  gameType: 'PVE',
  rounds: 'BO3',
  level: { name: 'Level1' },
  episode: { name: 'Episode1' }
};

describe('GameCreateContext turn caps', () => {
  it('defaults extended caps and omits them for classic', () => {
    const extended = GameCreateContext.fromJSON({ ...base, kind: 'extended' });
    expect(extended.maxStonePerTurn).toBe(DEFAULT_MAX_STONE_PER_TURN);
    expect(extended.maxScissorsPerTurn).toBe(DEFAULT_MAX_SCISSORS_PER_TURN);
    expect(extended.maxPaperPerTurn).toBe(DEFAULT_MAX_PAPER_PER_TURN);
    expect(extended.toJSON()).toMatchObject({
      max_stone_per_turn: 9,
      max_scissors_per_turn: 4,
      max_paper_per_turn: 7
    });

    const classic = GameCreateContext.fromJSON({ ...base, kind: 'classic' });
    expect(classic.maxStonePerTurn).toBeUndefined();
    expect(classic.toJSON()).not.toHaveProperty('max_stone_per_turn');
  });

  it('keeps a provided extended cap and rejects a non-positive one', () => {
    const custom = GameCreateContext.fromJSON({
      ...base,
      kind: 'extended',
      max_stone_per_turn: 3
    });
    expect(custom.maxStonePerTurn).toBe(3);
    expect(custom.maxPaperPerTurn).toBe(DEFAULT_MAX_PAPER_PER_TURN);
    expect(GameCreateContext.fromJSON(custom.toJSON()).maxStonePerTurn).toBe(3);

    expect(() => GameCreateContext.fromJSON({
      ...base,
      kind: 'extended',
      max_scissors_per_turn: 0
    })).toThrow(ValidationError);
  });

  it('puts extended caps on GameContext', () => {
    const createContext = new GameCreateContext(
      GameType.PVE,
      RoundsLength.BO3,
      KindOfGame.Extended,
      customLevel(),
      customEpisode(),
      2,
      3,
      5
    );
    const gameContext = GameContext.fromCreateContext(GameStatus.Created, createContext);

    expect(gameContext.toJSON()).toMatchObject({
      status: 'created',
      max_stone_per_turn: 2,
      max_scissors_per_turn: 3,
      max_paper_per_turn: 5
    });
  });
});

function customLevel() {
  return GameCreateContext.fromJSON({ ...base, kind: 'classic' }).level;
}

function customEpisode() {
  return GameCreateContext.fromJSON({ ...base, kind: 'classic' }).episode;
}
