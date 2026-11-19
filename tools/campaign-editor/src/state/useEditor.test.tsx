import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import type { ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import type { Route } from '../model/document.js';
import { readChapterText } from '../model/serialize.js';
import { loadDraft, saveDraft } from '../io/files.js';
import { tabForProblem, useEditor } from './useEditor.js';

const DRAFT_KEY = 'campaign-editor:draft:v1';

function bundled(): ChapterSettings {
  const read = readChapterText(chapterRaw);
  if (!read.ok) throw new Error('bundled file did not parse');
  return read.settings;
}

function campMines(doc: ChapterSettings): number {
  const tile = doc.tiles.find((item) => item.q === 0 && item.r === 0);
  if (!tile) throw new Error('missing camp');
  return tile.mines;
}

function pricedDraft(): { doc: ChapterSettings; baseline: ChapterSettings; sourceName: string; routes: Route[] } {
  const baseline = bundled();
  const doc = structuredClone(baseline);
  doc.rules.marketplace.stones = 4;
  return {
    doc,
    baseline,
    sourceName: 'notes.json',
    routes: [{ name: 'rush', steps: [{ type: 'end_turn' }] }]
  };
}

function Harness() {
  const editor = useEditor();
  const camp = campMines(editor.state.doc);
  const versionWarnings = editor.problems.filter((problem) => problem.code === 'version-unchanged').length;
  return (
    <div>
      <span data-testid="title">{editor.state.doc.title}</span>
      <span data-testid="source">{editor.state.sourceName}</span>
      <span data-testid="mines">{camp}</span>
      <span data-testid="routes">{editor.state.routes.length}</span>
      <span data-testid="version">{versionWarnings}</span>
      <button
        type="button"
        onClick={() => editor.dispatch({ type: 'setTiles', cells: [{ q: 0, r: 0 }], patch: { mines: 3 } })}
      >
        Edit mines
      </button>
      <button type="button" onClick={() => editor.resumeDraft()}>
        Resume
      </button>
      <button type="button" onClick={() => editor.loadBundled()}>
        Load bundled
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('tabForProblem', () => {
  it('opens the tab that owns the path', () => {
    expect(tabForProblem(['rules', 'marketplace', 'stones'])).toBe('rules');
    expect(tabForProblem(['defenderKits', 'easy'])).toBe('inventory');
    expect(tabForProblem(['rounds', 'hard'])).toBe('inventory');
    expect(tabForProblem(['startingInventory', 'items'])).toBe('inventory');
    expect(tabForProblem(['easyRewards', 'stones'])).toBe('rewards');
    expect(tabForProblem(['id'])).toBe('chapter');
    expect(tabForProblem(['title'])).toBe('chapter');
    expect(tabForProblem(['goal'])).toBe('chapter');
    expect(tabForProblem(['rulesetVersion'])).toBe('chapter');
    expect(tabForProblem(['tiles', 1, 'mines'])).toBe('tile');
    expect(tabForProblem(['tileCount'])).toBeNull();
  });
});

describe('useEditor', () => {
  it('does not autosave the bundled chapter until the document changes', () => {
    render(<Harness />);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit mines' }));
    expect(screen.getByTestId('mines').textContent).toBe('3');
    expect(campMines(loadDraft()!.doc)).toBe(3);
  });

  it('leaves a pending draft in storage until it is resumed', async () => {
    const draft = pricedDraft();
    saveDraft(draft);
    render(<Harness />);

    expect(screen.getByTestId('title').textContent).toBe('Chapter I');
    expect(loadDraft()?.doc.rules.marketplace.stones).toBe(4);
    expect(screen.getByTestId('version').textContent).toBe('0');

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByTestId('source').textContent).toBe('notes.json');
    expect(screen.getByTestId('routes').textContent).toBe('1');
    expect(screen.getByTestId('version').textContent).toBe('1');

    await waitFor(() => {
      const stored = loadDraft();
      expect(stored?.doc.rules.marketplace.stones).toBe(4);
      expect(stored?.baseline.rules.marketplace.stones).toBe(3);
      expect(stored?.routes).toEqual(draft.routes);
    });
  });

  it('writes the bundled chapter over an edited draft', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit mines' }));
    expect(campMines(loadDraft()!.doc)).toBe(3);

    fireEvent.click(screen.getByRole('button', { name: 'Load bundled' }));
    expect(screen.getByTestId('mines').textContent).toBe('1');
    expect(campMines(loadDraft()!.doc)).toBe(1);
    expect(screen.getByTestId('source').textContent).toBe('bundled');
  });

  it('replaces a pending draft when the bundled document is edited', () => {
    const draft = pricedDraft();
    saveDraft(draft);
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit mines' }));
    expect(loadDraft()?.doc.title).toBe('Chapter I');
    expect(campMines(loadDraft()!.doc)).toBe(3);
    expect(loadDraft()?.baseline.rules.marketplace.stones).toBe(3);
  });

  it('undoes and redoes with Cmd/Ctrl+Z and ignores the shortcut while typing', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit mines' }));
    expect(screen.getByTestId('mines').textContent).toBe('3');

    const field = document.createElement('input');
    document.body.appendChild(field);
    field.focus();
    fireEvent.keyDown(field, { key: 'z', metaKey: true });
    expect(screen.getByTestId('mines').textContent).toBe('3');
    field.remove();

    fireEvent.keyDown(document.body, { key: 'z', metaKey: true });
    expect(screen.getByTestId('mines').textContent).toBe('1');
    expect(campMines(loadDraft()!.doc)).toBe(1);

    fireEvent.keyDown(document.body, { key: 'Z', metaKey: true, shiftKey: true });
    expect(screen.getByTestId('mines').textContent).toBe('3');

    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, altKey: true });
    expect(screen.getByTestId('mines').textContent).toBe('3');

    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(screen.getByTestId('mines').textContent).toBe('1');
    fireEvent.keyDown(document.body, { key: 'Z', ctrlKey: true, shiftKey: true });
    expect(screen.getByTestId('mines').textContent).toBe('3');
  });
});
