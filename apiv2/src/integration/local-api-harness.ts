import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLAYER_ID = 'test-admin';
export const NPC_ID = 'NPC_1';
export const MOVE_TYPES = ['Stone', 'Paper', 'Scissors'] as const;
export const MAX_PLAYER_MOVES = 40;

const localEntry = path.resolve(fileURLToPath(new URL('../local.ts', import.meta.url)));
const apiv2Root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

export type ApiResult = { status: number; json: any };

export interface LocalApi {
  baseUrl: string;
  dataDir: string;
  stop(): Promise<void>;
}

export async function startLocalApi(): Promise<LocalApi> {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'aval-extended-game-'));
  const port = await getFreePort();
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', localEntry],
    {
      cwd: apiv2Root,
      env: {
        ...process.env,
        SKIP_AUTH: 'true',
        DATA_DIR: dataDir,
        CORS_ORIGIN: '*',
        PORT: String(port)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  await waitForListen(child, port);

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    dataDir,
    async stop() {
      if (child.pid) {
        child.kill('SIGTERM');
        await waitForExit(child);
      }
      await rm(dataDir, { recursive: true, force: true });
    }
  };
}

export async function api(baseUrl: string, method: string, pathname: string, body?: unknown): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : undefined
  };
}

export async function playExtendedBo3(baseUrl: string): Promise<{ gameId: string; payload: any }> {
  const created = await api(baseUrl, 'POST', '/apiv2/external/games', {
    gameType: 'PVE',
    rounds: 'BO3',
    kind: 'extended',
    level: { name: 'Level1' },
    episode: { name: 'Episode1' }
  });

  if (created.status !== 200 || created.json.status !== 'created') {
    throw new Error(`Failed to create game: ${JSON.stringify(created)}`);
  }

  const gameId = created.json.gameId as string;
  let gameStatus = 'created';
  let payload: any;

  for (let i = 0; i < MAX_PLAYER_MOVES && gameStatus !== 'finished'; i++) {
    const updated = await api(baseUrl, 'PUT', `/apiv2/external/games/${gameId}`, {
      type: 'Move',
      context: {
        move: {
          userId: PLAYER_ID,
          context: {
            moveType: MOVE_TYPES[i % MOVE_TYPES.length],
            size: 5 + (i % 6),
            decorId: 1
          },
          time: Date.now()
        }
      }
    });

    if (updated.status !== 200) {
      throw new Error(`Move failed: ${JSON.stringify(updated.json)}`);
    }

    payload = updated.json.payload;
    gameStatus = payload?.gameContext?.status;
  }

  if (gameStatus !== 'finished') {
    throw new Error(`Game ${gameId} did not finish after ${MAX_PLAYER_MOVES} player moves`);
  }

  return { gameId, payload };
}

export async function deleteGame(baseUrl: string, gameId: string): Promise<void> {
  const result = await api(baseUrl, 'DELETE', `/apiv2/internal/games/${gameId}`);
  if (result.status !== 204 && result.status !== 200) {
    throw new Error(`Failed to delete game ${gameId}: ${JSON.stringify(result)}`);
  }
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on('error', reject);
  });
}

function waitForListen(child: ChildProcess, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Local API did not start on port ${port}`));
    }, 15_000);

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.includes('Local API listening')) {
        cleanup();
        resolve();
      }
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`Local API exited before listen (code ${code})`));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout?.off('data', onData);
      child.off('exit', onExit);
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('exit', onExit);
    child.once('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

function waitForExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 3_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
