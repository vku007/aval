import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import { parseChapterSettings, type ChapterSettings, type TileSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { useRef, useState } from 'preact/hooks';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditorState, type Brush, type Cell, type DocAction, type UiAction } from '../model/document.js';
import { EditorHistory } from '../model/history.js';
import { brushAction, kitForSelection, selectionAfterClick, useBrush, useClearSelectionOnEscape } from './useBrush.js';

const gate: Cell = { q: 0, r: -1 };
const east: Cell = { q: 1, r: -1 };
const papers: Cell = { q: 1, r: 0 };
const camp: Cell = { q: 0, r: 0 };
const hard: Brush = { field: 'difficulty', value: 'hard' };

function bundled(): ChapterSettings {
  return parseChapterSettings(JSON.parse(chapterRaw));
}

function tileAt(settings: ChapterSettings, cell: Cell): TileSettings {
  const tile = settings.tiles.find((item) => item.q === cell.q && item.r === cell.r);
  if (!tile) throw new Error(`missing ${cell.q},${cell.r}`);
  return tile;
}

function Harness({
  brush,
  history
}: {
  brush: Brush | null;
  history: EditorHistory;
}) {
  const [, bump] = useState(0);
  const dispatches = useRef(0);
  const onPointer = useBrush(brush, history.state.doc.tiles, (action, groupId) => {
    dispatches.current += 1;
    history.dispatch(action, groupId);
    bump((value) => value + 1);
  });
  const cells = [camp, gate, east, papers];
  return (
    <div>
      {cells.map((cell) => {
        const key = `${cell.q},${cell.r}`;
        return (
          <button
            key={key}
            type="button"
            data-cell={key}
            onPointerDown={() => onPointer(cell, 'down')}
            onPointerEnter={() => onPointer(cell, 'enter')}
            onPointerUp={() => onPointer(cell, 'up')}
          >
            {key}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => {
          history.undo();
          bump((value) => value + 1);
        }}
      >
        Undo stroke
      </button>
      <div data-testid="past">{history.past.length}</div>
      <div data-testid="dispatches">{dispatches.current}</div>
    </div>
  );
}

function cellButton(cell: Cell): HTMLButtonElement {
  const button = document.querySelector(`[data-cell="${cell.q},${cell.r}"]`);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`missing ${cell.q},${cell.r}`);
  return button;
}

function drag(cells: Cell[]): void {
  fireEvent.pointerDown(cellButton(cells[0]!));
  for (let index = 1; index < cells.length; index += 1) {
    fireEvent.pointerEnter(cellButton(cells[index]!));
  }
  fireEvent.pointerUp(cellButton(cells[cells.length - 1]!));
}

afterEach(() => {
  cleanup();
});

describe('selectionAfterClick', () => {
  it('replaces on click and toggles on shift-click', () => {
    const start = [Object.freeze(camp)];
    expect(selectionAfterClick(start, gate, false)).toEqual([gate]);
    expect(start).toEqual([camp]);

    const added = selectionAfterClick(start, gate, true);
    expect(added).toEqual([camp, gate]);
    expect(selectionAfterClick(added, camp, true)).toEqual([gate]);
    expect(selectionAfterClick(added, { q: 2, r: -2 }, true)).toEqual([camp, gate, { q: 2, r: -2 }]);
  });
});

describe('brushAction', () => {
  const settings = bundled();

  it('skips an owned tile for difficulty and kit, and paints product and revealed', () => {
    const owned = tileAt(settings, camp);
    expect(brushAction(hard, camp, owned)).toBeNull();
    expect(brushAction({ field: 'kit', value: 'default' }, camp, { ...owned, defenderKit: { scissors: 1 } })).toBeNull();
    expect(brushAction({ field: 'product', value: 'papers' }, camp, owned)).toEqual({
      type: 'setTiles',
      cells: [camp],
      patch: { product: 'papers' }
    });
    expect(brushAction({ field: 'revealed', value: false }, camp, owned)).toEqual({
      type: 'setTiles',
      cells: [camp],
      patch: { revealed: false }
    });
  });

  it('paints a wall, including the camp, and skips a wall that is already painted', () => {
    const owned = tileAt(settings, camp);
    const gateTile = tileAt(settings, gate);
    expect(brushAction({ field: 'unavailable' }, camp, owned)).toEqual({
      type: 'setUnavailable',
      cells: [camp],
      unavailable: true
    });
    const wall = { ...gateTile, unavailable: true as const };
    expect(brushAction({ field: 'unavailable' }, gate, wall)).toBeNull();
    expect(brushAction(hard, gate, wall)).toBeNull();
    expect(brushAction({ field: 'kit', value: 'default' }, gate, { ...wall, defenderKit: { scissors: 1 } })).toBeNull();
  });

  it('skips a cell that already has the painted value', () => {
    const normal = tileAt(settings, gate);
    expect(brushAction({ field: 'difficulty', value: 'normal' }, gate, normal)).toBeNull();
    expect(brushAction({ field: 'kit', value: 'default' }, gate, normal)).toBeNull();
    expect(brushAction(hard, gate, undefined)).toBeNull();
  });
});

describe('kitForSelection', () => {
  it('copies the first neutral tile kit and leaves owned tiles out', () => {
    const settings = bundled();
    expect(kitForSelection(settings, [gate])).toBeNull();
    expect(kitForSelection(settings, [camp, gate, east])).toEqual({
      cells: [gate, east],
      kit: settings.defenderKits.normal
    });
    expect(kitForSelection(settings, [east, gate])?.kit).toEqual(settings.defenderKits.easy);

    const bothOwned = structuredClone(settings);
    tileAt(bothOwned, east).owner = 'player';
    expect(kitForSelection(bothOwned, [camp, east])).toBeNull();
  });
});

describe('useBrush', () => {
  function open(brush: Brush | null, prepare?: (history: EditorHistory) => void) {
    const history = new EditorHistory(createEditorState(bundled(), 'test'));
    prepare?.(history);
    const view = render(<Harness brush={brush} history={history} />);
    return { ...view, history };
  }

  it('paints a drag over three cells as one undo step', () => {
    const { history } = open(hard);
    drag([gate, east, papers]);

    expect(screen.getByTestId('past').textContent).toBe('1');
    expect(screen.getByTestId('dispatches').textContent).toBe('3');
    expect(tileAt(history.state.doc, gate).difficulty).toBe('hard');
    expect(tileAt(history.state.doc, east).difficulty).toBe('hard');
    expect(tileAt(history.state.doc, papers).difficulty).toBe('hard');

    fireEvent.click(screen.getByRole('button', { name: 'Undo stroke' }));
    expect(screen.getByTestId('past').textContent).toBe('0');
    expect(tileAt(history.state.doc, gate).difficulty).toBe('normal');
    expect(tileAt(history.state.doc, east).difficulty).toBe('easy');
    expect(tileAt(history.state.doc, papers).difficulty).toBe('easy');

    drag([papers]);
    expect(tileAt(history.state.doc, papers).difficulty).toBe('hard');
    expect(tileAt(history.state.doc, gate).difficulty).toBe('normal');
    fireEvent.click(screen.getByRole('button', { name: 'Undo stroke' }));
    expect(tileAt(history.state.doc, papers).difficulty).toBe('easy');
  });

  it('skips the owned camp when brushing difficulty', () => {
    const { history } = open(hard);
    drag([camp, gate, east]);

    expect(screen.getByTestId('dispatches').textContent).toBe('2');
    expect(tileAt(history.state.doc, camp).owner).toBe('player');
    expect(tileAt(history.state.doc, camp).difficulty).toBeNull();
    expect(tileAt(history.state.doc, camp).product).toBe('copper');
    expect(tileAt(history.state.doc, gate).difficulty).toBe('hard');
    expect(tileAt(history.state.doc, east).difficulty).toBe('hard');

    fireEvent.click(screen.getByRole('button', { name: 'Undo stroke' }));
    expect(tileAt(history.state.doc, gate).difficulty).toBe('normal');
    expect(tileAt(history.state.doc, east).difficulty).toBe('easy');
    expect(tileAt(history.state.doc, camp).difficulty).toBeNull();
  });

  it('does not paint the camp with the default-kit brush, and does paint a neutral custom kit', () => {
    const { history } = open({ field: 'kit', value: 'default' }, (history) => {
      history.dispatch({ type: 'setKit', cells: [camp], kit: { scissors: 1 } });
      history.dispatch({ type: 'setKit', cells: [gate], kit: { scissors: 7 } });
    });
    drag([camp, gate]);

    expect(tileAt(history.state.doc, camp).defenderKit).toEqual({ scissors: 1 });
    expect(tileAt(history.state.doc, gate).defenderKit).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Undo stroke' }));
    expect(tileAt(history.state.doc, gate).defenderKit).toEqual({ scissors: 7 });
    expect(tileAt(history.state.doc, camp).defenderKit).toEqual({ scissors: 1 });
  });

  it('ignores enter before pointer down and after pointer up', () => {
    const { history } = open(hard);
    fireEvent.pointerEnter(cellButton(gate));
    expect(tileAt(history.state.doc, gate).difficulty).toBe('normal');

    fireEvent.pointerDown(cellButton(gate));
    fireEvent.pointerUp(document.body);
    fireEvent.pointerEnter(cellButton(east));
    expect(tileAt(history.state.doc, gate).difficulty).toBe('hard');
    expect(tileAt(history.state.doc, east).difficulty).toBe('easy');
    expect(screen.getByTestId('past').textContent).toBe('1');
  });

  it('does not start a stroke when no brush is selected', () => {
    const { history } = open(null);
    drag([gate, east]);
    expect(screen.getByTestId('dispatches').textContent).toBe('0');
    expect(history.past).toHaveLength(0);
    expect(tileAt(history.state.doc, gate).difficulty).toBe('normal');
  });
});

describe('useClearSelectionOnEscape', () => {
  function Keys() {
    const historyRef = useRef<EditorHistory | null>(null);
    if (historyRef.current === null) {
      historyRef.current = new EditorHistory(createEditorState(bundled(), 'test'));
    }
    const history = historyRef.current;
    const [, bump] = useState(0);
    const dispatch = (action: DocAction | UiAction, groupId?: string) => {
      history.dispatch(action, groupId);
      bump((value) => value + 1);
    };
    useClearSelectionOnEscape(dispatch);
    return (
      <div>
        <button type="button" onClick={() => dispatch({ type: 'select', cells: [gate, camp] })}>
          Select
        </button>
        <input aria-label="Label" />
        <select aria-label="Product" />
        <div data-testid="selection">{history.state.selection.map((cell) => `${cell.q},${cell.r}`).join(' ')}</div>
      </div>
    );
  }

  it('clears the selection, and leaves a focused field alone', () => {
    render(<Keys />);
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.getByTestId('selection').textContent).toBe('0,-1 0,0');

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByTestId('selection').textContent).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    fireEvent.keyDown(screen.getByLabelText('Label'), { key: 'Escape' });
    fireEvent.keyDown(screen.getByLabelText('Product'), { key: 'Escape' });
    expect(screen.getByTestId('selection').textContent).toBe('0,-1 0,0');
  });
});
