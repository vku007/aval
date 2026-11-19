import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import {
  chapterErrors,
  checkChapterSettings,
  safeParseChapterSettings
} from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ViteDevServer } from 'vite';
import {
  CAMPAIGN_EDITOR_SAVE_ROUTE,
  campaignEditorSavePlugin,
  chapterSettingsPath,
  handleCampaignSave,
  type SaveRequest,
  type SaveResponse
} from './savePlugin.js';

const schema = {
  safeParseChapterSettings,
  checkChapterSettings,
  chapterErrors
};

function request(method: string, url: string, body = ''): SaveRequest & AsyncIterable<Uint8Array | string> {
  const payload = Buffer.from(body);
  return {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      yield payload;
    }
  };
}

function response(): SaveResponse & { body: string; ended: boolean; headers: Record<string, string> } {
  const res = {
    statusCode: 0,
    body: '',
    ended: false,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(chunk?: string) {
      this.body = chunk ?? '';
      this.ended = true;
    }
  };
  return res;
}

describe('handleCampaignSave', () => {
  let directory: string;

  afterEach(async () => {
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  });

  async function targetFile(): Promise<string> {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'campaign-editor-save-'));
    return path.join(directory, 'chapter-i.json');
  }

  it('writes valid text to the given path', async () => {
    const targetPath = await targetFile();
    const res = response();
    const next = vi.fn();

    await handleCampaignSave(request('POST', CAMPAIGN_EDITOR_SAVE_ROUTE, chapterRaw), res, next, {
      targetPath,
      loadSchema: async () => schema
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/json');
    expect(JSON.parse(res.body)).toEqual({ path: targetPath });
    expect(await fs.readFile(targetPath, 'utf8')).toBe(chapterRaw);
    const names = await fs.readdir(directory);
    expect(names.filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('returns 422 with problems for a price of zero and does not write', async () => {
    const targetPath = await targetFile();
    const settings = JSON.parse(chapterRaw) as { rules: { marketplace: { stones: number } } };
    settings.rules.marketplace.stones = 0;
    const res = response();

    await handleCampaignSave(
      request('POST', `${CAMPAIGN_EDITOR_SAVE_ROUTE}?path=/tmp/not-the-chapter.json`, JSON.stringify(settings)),
      res,
      vi.fn(),
      { targetPath, loadSchema: async () => schema }
    );

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body) as { problems: { code?: string; level: string; path: (string | number)[] }[] };
    expect(body.problems.every((problem) => problem.level === 'error' && problem.code === 'price-zero')).toBe(true);
    expect(body.problems.map((problem) => problem.path)).toContainEqual(['rules', 'marketplace', 'stones']);
    await expect(fs.access(targetPath)).rejects.toThrow();
  });

  it('returns 422 when the JSON is not chapter settings', async () => {
    const targetPath = await targetFile();
    const res = response();

    await handleCampaignSave(request('POST', CAMPAIGN_EDITOR_SAVE_ROUTE, '{}'), res, vi.fn(), {
      targetPath,
      loadSchema: async () => schema
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body) as { problems: { level: string; path: (string | number)[]; message: string }[] };
    expect(body.problems.length).toBeGreaterThan(0);
    expect(body.problems.every((problem) => problem.level === 'error' && problem.message.length > 0)).toBe(true);
    await expect(fs.access(targetPath)).rejects.toThrow();
  });

  it('returns 400 when the body is not JSON', async () => {
    const targetPath = await targetFile();
    const res = response();

    await handleCampaignSave(request('POST', CAMPAIGN_EDITOR_SAVE_ROUTE, 'not json'), res, vi.fn(), {
      targetPath,
      loadSchema: async () => schema
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { message?: string };
    expect(typeof body.message).toBe('string');
    expect(body.message?.length).toBeGreaterThan(0);
    await expect(fs.access(targetPath)).rejects.toThrow();
  });

  it('ignores other routes and methods', async () => {
    const targetPath = await targetFile();
    const cases = [
      ['GET', CAMPAIGN_EDITOR_SAVE_ROUTE],
      ['PUT', CAMPAIGN_EDITOR_SAVE_ROUTE],
      ['POST', '/__campaign-editor/other'],
      ['POST', '/chapter-i.json']
    ] as const;

    for (const [method, url] of cases) {
      const res = response();
      const next = vi.fn();
      const req = request(method, url, chapterRaw);
      req[Symbol.asyncIterator] = async function* failIfRead() {
        throw new Error('body should not be read');
      };

      await handleCampaignSave(req, res, next, {
        targetPath,
        loadSchema: async () => {
          throw new Error('schema should not load');
        }
      });

      expect(next).toHaveBeenCalledOnce();
      expect(res.ended).toBe(false);
    }
    expect(await fs.readdir(directory)).toEqual([]);
  });
});

describe('campaignEditorSavePlugin', () => {
  let sandbox: string;

  afterEach(async () => {
    if (sandbox) await fs.rm(sandbox, { recursive: true, force: true });
  });

  it('loads the schema through the dev server and writes only the resolved chapter file', async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'campaign-editor-plugin-'));
    const root = path.join(sandbox, 'tools', 'campaign-editor');
    await fs.mkdir(root, { recursive: true });
    const chapterFile = chapterSettingsPath(root);
    expect(chapterFile).toBe(path.join(sandbox, 'apiv2/src/domain/campaign/chapter-i.json'));
    await fs.mkdir(path.dirname(chapterFile), { recursive: true });

    const loaded: string[] = [];
    let middleware: ((req: SaveRequest, res: SaveResponse, next: () => void) => void) | undefined;
    const server = {
      config: { root },
      middlewares: {
        use(fn: (req: SaveRequest, res: SaveResponse, next: () => void) => void) {
          middleware = fn;
        }
      },
      async ssrLoadModule(url: string) {
        loaded.push(url);
        return schema;
      }
    };

    const plugin = campaignEditorSavePlugin();
    expect(plugin.apply).toBe('serve');
    if (typeof plugin.configureServer !== 'function') {
      throw new Error('configureServer was not registered');
    }
    plugin.configureServer(server as unknown as ViteDevServer);
    if (!middleware) throw new Error('save middleware was not registered');

    const ignored = response();
    const next = vi.fn();
    middleware(request('GET', CAMPAIGN_EDITOR_SAVE_ROUTE), ignored, next);
    expect(next).toHaveBeenCalledOnce();
    expect(loaded).toEqual([]);

    const res = response();
    middleware(
      request('POST', `${CAMPAIGN_EDITOR_SAVE_ROUTE}?path=${encodeURIComponent(path.join(sandbox, 'evil.json'))}`, chapterRaw),
      res,
      vi.fn()
    );
    await vi.waitFor(async () => {
      expect(res.ended).toBe(true);
    });

    expect(loaded).toEqual(['@apiv2/domain/campaign/ChapterSettingsSchema.ts']);
    expect(JSON.parse(res.body)).toEqual({ path: chapterFile });
    expect(await fs.readFile(chapterFile, 'utf8')).toBe(chapterRaw);
    await expect(fs.access(path.join(sandbox, 'evil.json'))).rejects.toThrow();
  });
});
