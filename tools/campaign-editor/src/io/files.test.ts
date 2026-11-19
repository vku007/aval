import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import type { ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Route } from '../model/document.js';
import { readChapterText } from '../model/serialize.js';
import { CAMPAIGN_EDITOR_SAVE_ROUTE } from './savePlugin.js';
import {
  clearDraft,
  downloadChapter,
  loadDraft,
  openFile,
  saveDraft,
  saveToRepo,
  type ChapterDraft
} from './files.js';

const DRAFT_KEY = 'campaign-editor:draft:v1';

function bundled(): ChapterSettings {
  const result = readChapterText(chapterRaw);
  if (!result.ok) throw new Error('bundled file did not parse');
  return result.settings;
}

function draft(): ChapterDraft {
  const doc = bundled();
  const routes: Route[] = [
    {
      name: 'rush',
      steps: [
        { type: 'attack', q: 0, r: -1 },
        { type: 'buy', item: 'stones', amount: 1 },
        { type: 'end_turn' }
      ]
    }
  ];
  return { doc, baseline: structuredClone(doc), sourceName: 'bundled', routes };
}

function installStorage(): void {
  const memory = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => {
      memory.clear();
    },
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() {
      return memory.size;
    }
  });
}

describe('draft storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips the document, baseline, source name, and routes', () => {
    installStorage();
    const saved = draft();
    saveDraft(saved);
    saved.doc.title = 'changed after save';
    saved.routes.push({ name: 'later', steps: [] });

    expect(loadDraft()).toEqual(draft());
    clearDraft();
    expect(loadDraft()).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('stores only the draft fields and rejects a draft that fails the schema', () => {
    installStorage();
    const saved = draft();
    saveDraft({ ...saved, selection: [{ q: 0, r: 0 }] } as ChapterDraft & { selection: { q: number; r: number }[] });
    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(['baseline', 'doc', 'routes', 'sourceName']);

    localStorage.setItem(DRAFT_KEY, '{');
    expect(loadDraft()).toBeNull();

    saveDraft({ ...saved, doc: {} as ChapterSettings });
    expect(loadDraft()).toBeNull();
  });
});

describe('openFile', () => {
  it('reads a chapter file and rejects text that is not JSON', async () => {
    const opened = await openFile(new File([chapterRaw], 'chapter-i.json', { type: 'application/json' }));
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.settings.id).toBe('chapter-i');

    const rejected = await openFile(new File(['not json'], 'bad.json'));
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.issues[0]?.path).toEqual([]);
  });
});

describe('downloadChapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downloads chapter-i.json', () => {
    const clicks: string[] = [];
    const anchor = {
      href: '',
      download: '',
      click() {
        clicks.push(this.download);
      },
      remove() {
        /* detached */
      }
    };
    vi.stubGlobal('document', {
      body: { appendChild: () => anchor },
      createElement: () => anchor
    });
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => {
        expect(blob.type).toBe('application/json');
        return 'blob:chapter';
      },
      revokeObjectURL: () => undefined
    });

    downloadChapter('{"id":"chapter-i"}\n');
    expect(anchor.href).toBe('blob:chapter');
    expect(clicks).toEqual(['chapter-i.json']);
  });
});

describe('saveToRepo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the canonical text to the dev server', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ path: '/repo/chapter-i.json' }), { status: 200 });
    });

    expect(await saveToRepo('{"id":"chapter-i"}\n')).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(CAMPAIGN_EDITOR_SAVE_ROUTE);
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBe('{"id":"chapter-i"}\n');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
  });

  it('returns problems when the server refuses the chapter', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({
      problems: [{
        level: 'error',
        code: 'price-zero',
        path: ['rules', 'marketplace', 'stones'],
        message: 'Marketplace price must be at least 1'
      }]
    }), { status: 422 }));

    const result = await saveToRepo('{}');
    expect(result).toEqual({
      ok: false,
      problems: [{
        level: 'error',
        code: 'price-zero',
        path: ['rules', 'marketplace', 'stones'],
        message: 'Marketplace price must be at least 1'
      }]
    });
  });

  it('returns the server message when the body is not JSON', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ message: 'Unexpected token' }), { status: 400 }));
    expect(await saveToRepo('not json')).toEqual({ ok: false, message: 'Unexpected token' });
  });
});
