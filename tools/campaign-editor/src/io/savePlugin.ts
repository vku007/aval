import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

export const CAMPAIGN_EDITOR_SAVE_ROUTE = '/__campaign-editor/save';

const CHAPTER_SCHEMA_MODULE = '@apiv2/domain/campaign/ChapterSettingsSchema.ts';

export interface SaveProblem {
  level: 'error' | 'warning';
  code?: string;
  path: (string | number)[];
  message: string;
  tile?: { q: number; r: number };
}

export interface ChapterSchemaModule {
  safeParseChapterSettings(value: unknown):
    | { ok: true; settings: unknown }
    | { ok: false; issues: { path: (string | number)[]; message: string }[] };
  checkChapterSettings(settings: unknown, options?: { baseline?: unknown }): SaveProblem[];
  chapterErrors(problems: SaveProblem[]): SaveProblem[];
}

export interface SaveRequest {
  method?: string;
  url?: string;
  originalUrl?: string;
}

export interface SaveResponse {
  statusCode: number;
  writableEnded?: boolean;
  setHeader(name: string, value: string): void;
  end(chunk?: string): void;
}

export interface SaveHandlerOptions {
  targetPath: string;
  loadSchema: () => Promise<ChapterSchemaModule>;
}

export function chapterSettingsPath(configRoot: string): string {
  return path.resolve(configRoot, '../../apiv2/src/domain/campaign/chapter-i.json');
}

export function campaignEditorSavePlugin(): Plugin {
  return {
    name: 'campaign-editor-save',
    apply: 'serve',
    configureServer(server) {
      const targetPath = chapterSettingsPath(server.config.root);
      server.middlewares.use((req, res, next) => {
        handleCampaignSave(req, res, next, {
          targetPath,
          loadSchema: () => loadChapterSchema(server)
        }).catch((error: unknown) => {
          if (res.writableEnded) return;
          const message = error instanceof Error ? error.message : 'Save failed';
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ message }));
        });
      });
    }
  };
}

export function handleCampaignSave(
  req: SaveRequest & AsyncIterable<Uint8Array | string>,
  res: SaveResponse,
  next: () => void,
  options: SaveHandlerOptions
): Promise<void> {
  if (!isSavePost(req)) {
    next();
    return Promise.resolve();
  }
  return performSave(req, res, options);
}

async function loadChapterSchema(server: ViteDevServer): Promise<ChapterSchemaModule> {
  const loaded = await server.ssrLoadModule(CHAPTER_SCHEMA_MODULE);
  return schemaModule(loaded);
}

function schemaModule(loaded: Record<string, unknown>): ChapterSchemaModule {
  const safeParseChapterSettings = loaded.safeParseChapterSettings;
  const checkChapterSettings = loaded.checkChapterSettings;
  const chapterErrors = loaded.chapterErrors;
  if (
    typeof safeParseChapterSettings !== 'function'
    || typeof checkChapterSettings !== 'function'
    || typeof chapterErrors !== 'function'
  ) {
    throw new Error('Chapter settings schema did not load');
  }
  return {
    safeParseChapterSettings,
    checkChapterSettings,
    chapterErrors
  } as ChapterSchemaModule;
}

function isSavePost(req: SaveRequest): boolean {
  return (req.method ?? '').toUpperCase() === 'POST' && requestPath(req) === CAMPAIGN_EDITOR_SAVE_ROUTE;
}

function requestPath(req: SaveRequest): string {
  return pathOnly(req.url ?? req.originalUrl ?? '');
}

function pathOnly(raw: string): string {
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      return new URL(raw).pathname;
    } catch {
      return '';
    }
  }
  const cut = raw.search(/[?#]/);
  return cut === -1 ? raw : raw.slice(0, cut);
}

async function performSave(
  req: SaveRequest & AsyncIterable<Uint8Array | string>,
  res: SaveResponse,
  options: SaveHandlerOptions
): Promise<void> {
  let sent = false;
  const send = (status: number, body: unknown) => {
    if (sent || res.writableEnded) return;
    sent = true;
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  };

  try {
    const text = await readBody(req);
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      send(400, { message });
      return;
    }

    const schema = await options.loadSchema();
    const parsed = schema.safeParseChapterSettings(value);
    if (!parsed.ok) {
      send(422, {
        problems: parsed.issues.map((issue) => ({
          level: 'error' as const,
          path: issue.path,
          message: issue.message
        }))
      });
      return;
    }

    const errors = schema.chapterErrors(schema.checkChapterSettings(parsed.settings));
    if (errors.length > 0) {
      send(422, { problems: errors });
      return;
    }

    await writeChapterFile(options.targetPath, text);
    send(200, { path: options.targetPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Save failed';
    send(500, { message });
  }
}

async function readBody(req: AsyncIterable<Uint8Array | string>): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function writeChapterFile(targetPath: string, text: string): Promise<void> {
  const temporary = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  );
  try {
    await fs.writeFile(temporary, text, 'utf8');
    await fs.rename(temporary, targetPath);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}
