import { describe, it, expect } from 'vitest';
import { NPC_EXTENDED_MAX_SIZE, NpcActor } from './NpcActor.js';
import { Game } from '../../domain/entity/Game.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { Round } from '../../domain/value-object/Round.js';
import { RoundStatus } from '../../domain/value-object/RoundStatus.js';
import { SubRound } from '../../domain/value-object/SubRound.js';
import { SubRoundStatus } from '../../domain/value-object/SubRoundStatus.js';
import { Move, MoveContext, MoveType } from '../../domain/value-object/Move.js';
import { ActionType } from '../../domain/value-object/ActionType.js';
import { GameCreateContext } from '../dto/processor/GameCreateContext.js';
import { GameType } from '../../domain/value-object/GameType.js';
import { RoundsLength } from '../../domain/value-object/RoundsLength.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';
import { GameLevel } from '../../domain/value-object/GameLevel.js';
import { EpisodeContext } from '../../domain/value-object/EpisodeContext.js';

describe('NpcActor.nextAction', () => {
  const actor = new NpcActor();
  const USER_1 = 'user-1';
  const NPC_1 = 'NPC_1';

  function createGame(
    usersIds: string[],
    kind: KindOfGame = KindOfGame.Classic,
    status: GameStatus = GameStatus.Created
  ): Game {
    const createContext = new GameCreateContext(
      GameType.PVE,
      RoundsLength.BO3,
      kind,
      new GameLevel('Level1'),
      new EpisodeContext('Episode1')
    );
    return new Game('game-1', usersIds, status, createContext);
  }

  function addOpenSubRound(game: Game, moves: Move[] = [], status = SubRoundStatus.WaitPlayer): SubRound {
    const now = Date.now();
    const round = new Round('round-1', RoundStatus.Current, now);
    const subRound = new SubRound(1, now, null, now);
    subRound.status = status;
    subRound.moves = moves;
    round.subRounds = [subRound];
    game.addRound(round);
    return subRound;
  }

  function playerMove(size = 10): Move {
    return new Move(USER_1, new MoveContext(MoveType.Stone, size, 0), Date.now());
  }

  it('returns null when the game is finished', () => {
    const game = createGame([USER_1, NPC_1], KindOfGame.Classic, GameStatus.Finished);
    addOpenSubRound(game, [playerMove()]);

    expect(actor.nextAction(game)).toBeNull();
  });

  it('returns null when the game is broken', () => {
    const game = createGame([USER_1, NPC_1], KindOfGame.Classic, GameStatus.Broken);
    addOpenSubRound(game, [playerMove()]);

    expect(actor.nextAction(game)).toBeNull();
  });

  it('returns null when no NPC player exists', () => {
    const game = createGame([USER_1, 'user-2']);
    addOpenSubRound(game, [playerMove()]);

    expect(actor.nextAction(game)).toBeNull();
  });

  it('returns null when there is no round', () => {
    const game = createGame([USER_1, NPC_1]);

    expect(actor.nextAction(game)).toBeNull();
  });

  it('returns null when the last round is finished', () => {
    const game = createGame([USER_1, NPC_1]);
    const now = Date.now();
    const round = new Round('round-1', RoundStatus.Finished, now, USER_1, now);
    const subRound = new SubRound(1, now, now, now);
    subRound.status = SubRoundStatus.Done;
    subRound.moves = [playerMove()];
    round.subRounds = [subRound];
    game.addRound(round);

    expect(actor.nextAction(game)).toBeNull();
  });

  it('returns null when there is no sub-round', () => {
    const game = createGame([USER_1, NPC_1]);
    game.addRound(new Round('round-1', RoundStatus.Current, Date.now()));

    expect(actor.nextAction(game)).toBeNull();
  });

  it('returns null when the NPC already threw in this sub-round', () => {
    const game = createGame([USER_1, NPC_1]);
    addOpenSubRound(game, [
      playerMove(),
      new Move(NPC_1, new MoveContext(MoveType.Paper, 0, 0), Date.now()),
    ]);

    expect(actor.nextAction(game)).toBeNull();
  });

  it('returns null when the sub-round is done', () => {
    const game = createGame([USER_1, NPC_1]);
    addOpenSubRound(game, [playerMove()], SubRoundStatus.Done);

    expect(actor.nextAction(game)).toBeNull();
  });

  it('returns a Move action without mutating the game', () => {
    const game = createGame([USER_1, NPC_1]);
    const subRound = addOpenSubRound(game, [playerMove()]);

    const action = actor.nextAction(game);

    expect(action).not.toBeNull();
    expect(action!.type).toBe(ActionType.Move);
    expect(action!.context.move?.userId).toBe(NPC_1);
    expect([MoveType.Stone, MoveType.Paper, MoveType.Scissors]).toContain(
      action!.context.move!.context.moveType
    );
    expect(subRound.moves).toHaveLength(1);
  });

  it('Classic NPC uses size 0', () => {
    const game = createGame([USER_1, NPC_1], KindOfGame.Classic);
    addOpenSubRound(game, [playerMove()]);

    const action = actor.nextAction(game);

    expect(action!.context.move!.context.size).toBe(0);
  });

  it('Extended NPC uses size in 0..NPC_EXTENDED_MAX_SIZE', () => {
    const game = createGame([USER_1, NPC_1], KindOfGame.Extended);
    addOpenSubRound(game, [playerMove()]);

    const action = actor.nextAction(game);
    const size = action!.context.move!.context.size;

    expect(size).toBeGreaterThanOrEqual(0);
    expect(size).toBeLessThanOrEqual(NPC_EXTENDED_MAX_SIZE);
  });

  it('can throw first when the sub-round is init', () => {
    const game = createGame([USER_1, NPC_1]);
    addOpenSubRound(game, [], SubRoundStatus.Init);

    const action = actor.nextAction(game);

    expect(action?.context.move?.userId).toBe(NPC_1);
  });
});
