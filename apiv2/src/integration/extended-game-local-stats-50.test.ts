import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteGame,
  NPC_ID,
  playExtendedBo3,
  PLAYER_ID,
  startLocalApi,
  type LocalApi
} from './local-api-harness.js';

const GAMES = 500;
const repoRoot = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const resultFile = path.join(repoRoot, 'testresult', 'extended-game-stats-50.txt');

type MoveSample = { userId: string; moveType: string; size: number };

describe('extended game local stats (50 games)', () => {
  let local: LocalApi;

  beforeAll(async () => {
    local = await startLocalApi();
  }, 20_000);

  afterAll(async () => {
    await local?.stop();
  });

  it('plays 50 extended PVE BO3 games and writes win/action/size stats', async () => {
    let playerGameWins = 0;
    let npcGameWins = 0;
    let playerRoundWins = 0;
    let npcRoundWins = 0;
    const moves: MoveSample[] = [];

    for (let n = 0; n < GAMES; n++) {
      const { gameId, payload } = await playExtendedBo3(local.baseUrl);
      const roundStates = payload.playerContext?.roundStates ?? [];

      let playerRounds = 0;
      let npcRounds = 0;
      for (const round of roundStates) {
        if (round.winnerId === PLAYER_ID) {
          playerRounds++;
        } else if (round.winnerId === NPC_ID) {
          npcRounds++;
        }
        for (const sub of round.subRoundStates ?? []) {
          for (const move of sub.moves ?? []) {
            moves.push({
              userId: move.userId,
              moveType: move.context?.moveType,
              size: move.context?.size
            });
          }
        }
      }

      playerRoundWins += playerRounds;
      npcRoundWins += npcRounds;
      if (playerRounds > npcRounds) {
        playerGameWins++;
      } else if (npcRounds > playerRounds) {
        npcGameWins++;
      }

      await deleteGame(local.baseUrl, gameId);
    }

    const report = formatStats({
      games: GAMES,
      playerGameWins,
      npcGameWins,
      playerRoundWins,
      npcRoundWins,
      moves
    });

    await mkdir(path.dirname(resultFile), { recursive: true });
    await writeFile(resultFile, report, 'utf8');

    expect(playerGameWins + npcGameWins).toBe(GAMES);
    expect(moves.length).toBeGreaterThan(0);
    expect(await readFile(resultFile, 'utf8')).toContain('Win ratio');
    expect(await readFile(resultFile, 'utf8')).toContain('Ratio of actions');
    expect(await readFile(resultFile, 'utf8')).toContain('Sizes');
  }, 60_000);
});

function formatStats(input: {
  games: number;
  playerGameWins: number;
  npcGameWins: number;
  playerRoundWins: number;
  npcRoundWins: number;
  moves: MoveSample[];
}): string {
  const playerMoves = input.moves.filter((m) => m.userId === PLAYER_ID);
  const npcMoves = input.moves.filter((m) => m.userId === NPC_ID);
  const lines: string[] = [];

  lines.push(`Extended PVE BO3 — ${input.games} games`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Win ratio');
  lines.push(ratioLine('player games', input.playerGameWins, input.games));
  lines.push(ratioLine('npc games', input.npcGameWins, input.games));
  const roundTotal = input.playerRoundWins + input.npcRoundWins;
  lines.push(ratioLine('player rounds', input.playerRoundWins, roundTotal));
  lines.push(ratioLine('npc rounds', input.npcRoundWins, roundTotal));
  lines.push('');
  lines.push('Ratio of actions (moveType)');
  lines.push('player:');
  lines.push(...actionRatioLines(playerMoves));
  lines.push('npc:');
  lines.push(...actionRatioLines(npcMoves));
  lines.push('all:');
  lines.push(...actionRatioLines(input.moves));
  lines.push('');
  lines.push('Sizes');
  lines.push('player:');
  lines.push(...sizeLines(playerMoves));
  lines.push('npc:');
  lines.push(...sizeLines(npcMoves));
  lines.push('');

  return lines.join('\n');
}

function ratioLine(label: string, count: number, total: number): string {
  const pct = total === 0 ? '0.0' : ((count / total) * 100).toFixed(1);
  return `  ${label}: ${count} / ${total} (${pct}%)`;
}

function actionRatioLines(moves: MoveSample[]): string[] {
  const types = ['Stone', 'Paper', 'Scissors'];
  const counts = new Map<string, number>(types.map((t) => [t, 0]));
  for (const move of moves) {
    counts.set(move.moveType, (counts.get(move.moveType) ?? 0) + 1);
  }
  return types.map((type) => ratioLine(type, counts.get(type) ?? 0, moves.length));
}

function sizeLines(moves: MoveSample[]): string[] {
  if (moves.length === 0) {
    return ['  (no moves)'];
  }
  const sizes = moves.map((m) => m.size).filter((n) => Number.isFinite(n));
  const sum = sizes.reduce((a, b) => a + b, 0);
  const mean = (sum / sizes.length).toFixed(2);
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  const histogram = new Map<number, number>();
  for (const size of sizes) {
    histogram.set(size, (histogram.get(size) ?? 0) + 1);
  }
  const keys = [...histogram.keys()].sort((a, b) => a - b);
  const lines = [
    `  count: ${sizes.length}  mean: ${mean}  min: ${min}  max: ${max}`,
    '  histogram:'
  ];
  for (const key of keys) {
    lines.push('  ' + ratioLine(String(key), histogram.get(key) ?? 0, sizes.length));
  }
  return lines;
}
