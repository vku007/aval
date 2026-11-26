import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import { parseChapterSettings, type ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditorState, reduce, type Cell, type DocAction } from '../model/document.js';
import { TilePanel } from './TilePanel.js';

const gate: Cell = { q: 0, r: -1 };
const papers: Cell = { q: 1, r: 0 };

function bundled(): ChapterSettings {
  return parseChapterSettings(JSON.parse(chapterRaw));
}

function apply(settings: ChapterSettings, action: DocAction): ChapterSettings {
  return reduce(createEditorState(settings, 'test'), action).doc;
}

function open(cells: Cell[], settings: ChapterSettings = bundled()) {
  const onAction = vi.fn();
  const view = render(<TilePanel settings={settings} selection={cells} onAction={onAction} />);
  return { ...view, onAction };
}

afterEach(() => {
  cleanup();
});

describe('TilePanel', () => {
  it('asks for a tile when nothing is selected', () => {
    open([]);
    expect(screen.getByText('Select a tile on the map')).toBeTruthy();
    expect(screen.queryByLabelText('Owner')).toBeNull();
  });

  it('hides the fight when the tile is unavailable', () => {
    const settings = bundled();
    const state = apply(settings, { type: 'setUnavailable', cells: [gate], unavailable: true });
    const { onAction } = open([gate], state);
    expect(screen.getByLabelText('Unavailable')).toBeTruthy();
    expect((screen.getByLabelText('Unavailable') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText('Product')).toBeTruthy();
    expect(screen.getByLabelText('Revealed')).toBeTruthy();
    expect(screen.queryByLabelText('Mines')).toBeNull();
    expect(screen.queryByLabelText('Difficulty')).toBeNull();
    expect(screen.queryByLabelText('Objective')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Defender kit' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Stash' })).toBeNull();
    fireEvent.click(screen.getByLabelText('Unavailable'));
    expect(onAction).toHaveBeenCalledWith({ type: 'setUnavailable', cells: [gate], unavailable: false });
  });

  it('hides difficulty and the kit when the owner becomes Player', () => {
    const { onAction, rerender } = open([gate]);
    expect(screen.getByLabelText('Difficulty')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Defender kit' })).toBeTruthy();
    expect(screen.getByLabelText('NPC algorithm')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: 'player' } });
    expect(onAction).toHaveBeenCalledWith({ type: 'setOwner', cells: [gate], owner: 'player' });

    rerender(
      <TilePanel settings={apply(bundled(), onAction.mock.calls[0][0])} selection={[gate]} onAction={onAction} />
    );
    expect(screen.queryByLabelText('Difficulty')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Defender kit' })).toBeNull();
    expect(screen.queryByLabelText('NPC algorithm')).toBeNull();
    expect((screen.getByLabelText('Objective') as HTMLInputElement).disabled).toBe(true);
  });

  it('starts a custom kit as a copy of the difficulty kit', () => {
    const { onAction, rerender } = open([gate]);
    const kit = () => screen.getByRole('group', { name: 'Defender kit' });
    expect(kit().querySelector('.stack-editor input')).toBeNull();

    fireEvent.click(within(kit()).getByRole('radio', { name: 'Defender kit Custom' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'setKit', cells: [gate], kit: 'copy-difficulty' });

    const settings = apply(bundled(), onAction.mock.calls[0][0]);
    rerender(<TilePanel settings={settings} selection={[gate]} onAction={onAction} />);
    const custom = screen.getByRole('group', { name: 'Defender kit' });
    expect((within(custom).getByLabelText('Stone') as HTMLInputElement).value).toBe('9');
    expect((within(custom).getByLabelText('Scissors') as HTMLInputElement).value).toBe('4');
    expect((within(custom).getByLabelText('Paper') as HTMLInputElement).value).toBe('7');
    expect((within(custom).getByLabelText('Stone NA') as HTMLInputElement).value).toBe('1');
    expect(custom.textContent).toContain('same as the normal kit');
    expect(within(custom).getByRole('button', { name: 'Reset to difficulty kit' })).toBeTruthy();
    expect(settings.tiles.find((tile) => tile.label === 'gate')?.defenderKit).toEqual({
      stones: 9,
      scissors: 4,
      papers: 7,
      NA_effect_stone: 1
    });
  });

  it('keeps a custom kit when difficulty changes and updates the difference', () => {
    const cells = [gate];
    const settings = apply(bundled(), { type: 'setKit', cells, kit: { scissors: 7 } });
    const { onAction, rerender } = open(cells, settings);
    const kit = () => screen.getByRole('group', { name: 'Defender kit' });
    expect(kit().textContent).toContain('−9 stones, +3 scissors, −7 papers, −1 NA_effect_stone');

    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'easy' } });
    expect(onAction).toHaveBeenCalledWith({ type: 'setTiles', cells, patch: { difficulty: 'easy' } });

    const next = apply(settings, onAction.mock.calls[0][0]);
    rerender(<TilePanel settings={next} selection={cells} onAction={onAction} />);
    const updated = screen.getByRole('group', { name: 'Defender kit' });
    expect((within(updated).getByLabelText('Scissors') as HTMLInputElement).value).toBe('7');
    expect(updated.textContent).toContain('−6 stones, +4 scissors, −4 papers');
    expect(updated.textContent).not.toContain('NA_effect_stone');
    expect(next.tiles.find((tile) => tile.q === 0 && tile.r === -1)?.defenderKit).toEqual({ scissors: 7 });
  });

  it('shows mixed products and writes one product onto every selected tile', () => {
    const cells = [gate, papers];
    const { onAction, rerender } = open(cells);
    expect(screen.getAllByText('Mixed').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'copper' } });
    expect(onAction).toHaveBeenCalledWith({ type: 'setTiles', cells, patch: { product: 'copper' } });

    const next = apply(bundled(), onAction.mock.calls[0][0]);
    rerender(<TilePanel settings={next} selection={cells} onAction={onAction} />);
    expect((screen.getByLabelText('Product') as HTMLSelectElement).value).toBe('copper');
    expect(next.tiles.filter((tile) => cells.some((cell) => cell.q === tile.q && cell.r === tile.r)).map((tile) => tile.product)).toEqual([
      'copper',
      'copper'
    ]);
  });

  it('shows the derived lines and leaves a simulation slot', () => {
    open([gate]);
    expect(screen.getByText('(0,-1)')).toBeTruthy();
    expect((screen.getByLabelText('Label') as HTMLInputElement).value).toBe('gate');
    expect(screen.getByText('Income per turn: 1')).toBeTruthy();
    expect(screen.getByText('Dig yield: 2')).toBeTruthy();
    expect(screen.queryByText(/^Dig net:/)).toBeNull();
    expect(screen.getByText('Rounds: BO5')).toBeTruthy();
    expect(screen.getByText('Garrison: 9 stones, 4 scissors, 7 papers, 1 NA_effect_stone')).toBeTruthy();
    expect(document.querySelector('[data-slot="simulation"]')).toBeTruthy();
    cleanup();

    open([{ q: 0, r: -2 }]);
    expect(screen.getByText('Income per turn: never pays: taking it ends the chapter')).toBeTruthy();
    expect(screen.getByText('Rounds: BO7')).toBeTruthy();
    expect((screen.getByLabelText('Objective') as HTMLInputElement).checked).toBe(true);
    cleanup();

    open([{ q: 0, r: 0 }]);
    expect(screen.getByText('Income per turn: 2')).toBeTruthy();
    expect(screen.getByText('Dig yield: 4')).toBeTruthy();
    expect(screen.getByText('Dig net: 0')).toBeTruthy();
    expect(screen.getByText('Rounds: none')).toBeTruthy();
    expect(screen.getByText('Garrison: none')).toBeTruthy();
    expect(screen.queryByLabelText('Difficulty')).toBeNull();
  });
});
