import {
  safeParseChapterSettings,
  type ChapterSettings
} from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import type { Route } from '../model/document.js';
import { readChapterText, type ReadChapterResult } from '../model/serialize.js';

const DRAFT_KEY = 'campaign-editor:draft:v1';
const DOWNLOAD_NAME = 'chapter-i.json';

export interface ChapterDraft {
  doc: ChapterSettings;
  baseline: ChapterSettings;
  sourceName: string;
  routes: Route[];
}

export async function openFile(file: File): Promise<ReadChapterResult> {
  return readChapterText(await file.text());
}

export function downloadChapter(text: string): void {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.href = url;
  link.download = DOWNLOAD_NAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function saveDraft(state: ChapterDraft): void {
  const payload: ChapterDraft = {
    doc: state.doc,
    baseline: state.baseline,
    sourceName: state.sourceName,
    routes: state.routes
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
}

export function loadDraft(): ChapterDraft | null {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    const doc = settingsIfValid(value.doc);
    const baseline = settingsIfValid(value.baseline);
    if (!doc || !baseline) return null;
    if (typeof value.sourceName !== 'string') return null;
    if (!Array.isArray(value.routes) || !value.routes.every(isRoute)) return null;
    return { doc, baseline, sourceName: value.sourceName, routes: value.routes };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

export interface SaveProblem {
  path: (string | number)[];
  message: string;
  level?: 'error' | 'warning';
  code?: string;
  tile?: { q: number; r: number };
}

export type SaveToRepoResult =
  | { ok: true }
  | { ok: false; problems: SaveProblem[] }
  | { ok: false; message: string };

export async function saveToRepo(text: string): Promise<SaveToRepoResult> {
  if (import.meta.env.DEV) {
    return postChapterToDevServer(text);
  }
  return { ok: false, message: 'Saving is not available in this build.' };
}

async function postChapterToDevServer(text: string): Promise<SaveToRepoResult> {
  let response: Response;
  try {
    response = await fetch('/__campaign-editor/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: text
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Save failed';
    return { ok: false, message };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: `Save failed (${response.status})` };
  }

  if (response.status === 200 && isRecord(payload) && typeof payload.path === 'string') {
    return { ok: true };
  }
  if (response.status === 422) {
    const problems = problemsFrom(payload);
    if (problems) return { ok: false, problems };
  }
  if (isRecord(payload) && typeof payload.message === 'string') {
    return { ok: false, message: payload.message };
  }
  return { ok: false, message: `Save failed (${response.status})` };
}

function problemsFrom(value: unknown): SaveProblem[] | null {
  if (!isRecord(value) || !Array.isArray(value.problems) || !value.problems.every(isSaveProblem)) {
    return null;
  }
  return value.problems;
}

function isSaveProblem(value: unknown): value is SaveProblem {
  if (!isRecord(value) || typeof value.message !== 'string' || !Array.isArray(value.path)) return false;
  return value.path.every((part) => typeof part === 'string' || typeof part === 'number');
}

function settingsIfValid(value: unknown): ChapterSettings | null {
  if (!safeParseChapterSettings(value).ok) return null;
  return value as ChapterSettings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRoute(value: unknown): value is Route {
  if (!isRecord(value)) return false;
  return typeof value.name === 'string' && Array.isArray(value.steps);
}
