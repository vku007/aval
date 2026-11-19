import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import { parseChapterSettings, type ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { describe, expect, it } from 'vitest';
import { createEditorState } from './document.js';
import { EditorHistory } from './history.js';

function bundled(): ChapterSettings {
  return parseChapterSettings(JSON.parse(chapterRaw));
}

function mines(history: EditorHistory, q: number, r: number): number {
  const tile = history.state.doc.tiles.find(item => item.q === q && item.r === r);
  if (!tile) throw new Error(`missing ${q},${r}`);
  return tile.mines;
}

describe('EditorHistory', () => {
  it('undoes and redoes document actions', () => {
    const history = new EditorHistory(createEditorState(bundled(), 'bundled'));
    const cell = [{ q: 0, r: -1 }];
    history.dispatch({ type: 'setTiles', cells: cell, patch: { mines: 2 } });
    history.dispatch({ type: 'setTiles', cells: cell, patch: { mines: 3 } });
    expect(history.past).toHaveLength(2);
    expect(mines(history, 0, -1)).toBe(3);

    history.undo();
    expect(mines(history, 0, -1)).toBe(2);
    history.undo();
    expect(mines(history, 0, -1)).toBe(1);
    history.undo();
    expect(mines(history, 0, -1)).toBe(1);

    history.redo();
    expect(mines(history, 0, -1)).toBe(2);
    history.dispatch({ type: 'setTiles', cells: cell, patch: { mines: 4 } });
    expect(history.future).toHaveLength(0);
    expect(mines(history, 0, -1)).toBe(4);
    history.redo();
    expect(mines(history, 0, -1)).toBe(4);
  });

  it('treats three grouped setTiles as one undo step', () => {
    const history = new EditorHistory(createEditorState(bundled(), 'bundled'));
    const cells = [
      { q: 0, r: -1 },
      { q: 1, r: -1 },
      { q: 1, r: 0 }
    ];
    cells.forEach((cell, index) => {
      history.dispatch({ type: 'setTiles', cells: [cell], patch: { mines: index + 2 } }, 'brush');
    });
    expect(history.past).toHaveLength(1);
    expect(history.future).toHaveLength(0);
    expect(mines(history, 0, -1)).toBe(2);
    expect(mines(history, 1, -1)).toBe(3);
    expect(mines(history, 1, 0)).toBe(4);

    history.undo();
    expect(mines(history, 0, -1)).toBe(1);
    expect(mines(history, 1, -1)).toBe(1);
    expect(mines(history, 1, 0)).toBe(1);
    expect(history.future).toHaveLength(1);

    history.redo();
    expect(mines(history, 0, -1)).toBe(2);
    expect(mines(history, 1, -1)).toBe(3);
    expect(mines(history, 1, 0)).toBe(4);
  });

  it('keeps a group open across a selection', () => {
    const history = new EditorHistory(createEditorState(bundled(), 'bundled'));
    const cell = [{ q: 0, r: -1 }];
    history.dispatch({ type: 'setTiles', cells: cell, patch: { mines: 2 } }, 'brush');
    history.dispatch({ type: 'select', cells: [{ q: 0, r: 0 }] });
    history.dispatch({ type: 'setTiles', cells: cell, patch: { mines: 3 } }, 'brush');
    expect(history.past).toHaveLength(1);
    expect(history.state.selection).toEqual([{ q: 0, r: 0 }]);
    history.undo();
    expect(mines(history, 0, -1)).toBe(1);
    expect(history.state.selection).toEqual([{ q: 0, r: 0 }]);
  });

  it('does not record a selection', () => {
    const history = new EditorHistory(createEditorState(bundled(), 'bundled'));
    history.dispatch({ type: 'select', cells: [{ q: 0, r: 0 }] });
    expect(history.past).toHaveLength(0);
    expect(history.state.selection).toEqual([{ q: 0, r: 0 }]);
  });

  it('clears history and sets the baseline on load', () => {
    const history = new EditorHistory(createEditorState(bundled(), 'bundled'));
    history.dispatch({ type: 'setTiles', cells: [{ q: 0, r: -1 }], patch: { mines: 3 } });
    const replacement = bundled();
    replacement.title = 'Other';
    history.dispatch({ type: 'load', doc: replacement, sourceName: 'other.json' });
    expect(history.past).toEqual([]);
    expect(history.future).toEqual([]);
    expect(history.state.sourceName).toBe('other.json');
    expect(history.state.doc.title).toBe('Other');
    expect(history.state.baseline.title).toBe('Other');
    expect(history.state.doc).not.toBe(history.state.baseline);
    history.undo();
    expect(history.state.doc.title).toBe('Other');
    history.state.doc.title = 'mutated';
    expect(history.state.baseline.title).toBe('Other');
  });
});
