import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { playExtendedBo3, PLAYER_ID, startLocalApi, type LocalApi } from './local-api-harness.js';

const repoRoot = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const resultFile = path.join(repoRoot, 'testresult', 'extended-game.json');

describe('extended game on local host', () => {
  let local: LocalApi;

  beforeAll(async () => {
    local = await startLocalApi();
  }, 20_000);

  afterAll(async () => {
    await local?.stop();
  });

  it('creates an extended game, plays until finished, and writes JSON to testresult', async () => {
    const { gameId, payload } = await playExtendedBo3(local.baseUrl);

    const storedPath = path.join(local.dataDir, 'json', 'games', `${gameId}.json`);
    const stored = JSON.parse(await readFile(storedPath, 'utf8'));
    const dump = { id: gameId, ...stored };

    await mkdir(path.dirname(resultFile), { recursive: true });
    await writeFile(resultFile, `${JSON.stringify(dump, null, 2)}\n`, 'utf8');

    expect(payload.gameContext.status).toBe('finished');
    expect(dump.status).toBe('finished');
    expect(dump.createContext?.kind).toBe('extended');
    expect(dump.usersIds).toContain(PLAYER_ID);
    expect(dump.usersIds).toContain('NPC_1');
    expect(dump.rounds.length).toBeGreaterThan(0);

    const onDisk = JSON.parse(await readFile(resultFile, 'utf8'));
    expect(onDisk.id).toBe(gameId);
    expect(onDisk.status).toBe('finished');
  });
});
