import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import type { ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDraft, saveDraft } from './io/files.js';
import * as files from './io/files.js';
import { readChapterText } from './model/serialize.js';
import { App } from './App.js';

function bundled(): ChapterSettings {
  const read = readChapterText(chapterRaw);
  if (!read.ok) throw new Error('bundled file did not parse');
  return read.settings;
}

function chooseFile(file: File): void {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  fireEvent.change(input);
}

function button(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('App', () => {
  it('exports the bundled chapter unchanged', () => {
    const download = vi.spyOn(files, 'downloadChapter').mockImplementation(() => {});
    render(<App />);
    expect(button('Export').disabled).toBe(false);
    expect(button('Undo').disabled).toBe(true);
    expect(button('Redo').disabled).toBe(true);
    expect(screen.getByText('0 errors 4 warnings')).toBeTruthy();

    fireEvent.click(button('Export'));
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0]).toBe(chapterRaw);
  });

  it('disables Export and Save to repo while a price-zero document is open', async () => {
    render(<App />);
    const settings = structuredClone(bundled());
    settings.rules.marketplace.stones = 0;
    chooseFile(new File([JSON.stringify(settings)], 'zero.json', { type: 'application/json' }));

    expect(await screen.findByText('zero.json')).toBeTruthy();
    expect(screen.getByText('1 error 4 warnings')).toBeTruthy();
    expect(button('Export').disabled).toBe(true);
    expect(button('Save to repo').disabled).toBe(true);

    fireEvent.click(screen.getByRole('tab', { name: 'Problems' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marketplace price must be at least 1' }));
    expect(screen.getByRole('tab', { name: 'Rules' }).getAttribute('aria-selected')).toBe('true');
  });

  it('selects the tile for a problem and leaves the other tiles unselected', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Problems' }));
    const camp = screen.getByRole('button', { name: '(0,0) Digging this copper tile nets no copper' });
    const south = screen.getByRole('button', { name: '(-1,1) Digging this copper tile nets no copper' });

    fireEvent.click(camp);
    expect(camp.getAttribute('aria-current')).toBe('true');
    expect(south.getAttribute('aria-current')).toBeNull();

    fireEvent.click(south);
    expect(south.getAttribute('aria-current')).toBe('true');
    expect(camp.getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Problems' }).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps the current document when a file fails to open', async () => {
    render(<App />);
    chooseFile(new File(['{'], 'bad.json', { type: 'application/json' }));

    const dialog = await screen.findByRole('dialog', { name: 'Could not open file' });
    expect(dialog.textContent).toContain('JSON');
    expect(screen.getByText('bundled')).toBeTruthy();
    expect(screen.getByText('0 errors 4 warnings')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    const settings = structuredClone(bundled());
    const stash = settings.tiles.find((tile) => tile.stash);
    if (!stash?.stash) throw new Error('missing stash');
    (stash.stash.items as Record<string, number>).not_an_item = 1;
    chooseFile(new File([JSON.stringify(settings)], 'unknown.json', { type: 'application/json' }));

    const rejected = await screen.findByRole('dialog', { name: 'Could not open file' });
    expect(rejected.textContent).toContain('not_an_item');
    expect(screen.getByText('bundled')).toBeTruthy();
    expect(screen.queryByText('unknown.json')).toBeNull();
  });

  it('offers a stored draft, then discards it without loading it', () => {
    const doc = structuredClone(bundled());
    doc.title = 'Kept';
    saveDraft({ doc, baseline: bundled(), sourceName: 'notes.json', routes: [] });
    render(<App />);

    expect(screen.getByText('bundled')).toBeTruthy();
    expect(button('Resume draft')).toBeTruthy();
    fireEvent.click(button('Discard'));
    expect(screen.queryByRole('button', { name: 'Resume draft' })).toBeNull();
    expect(loadDraft()).toBeNull();
    expect(screen.getByText('bundled')).toBeTruthy();
    expect(screen.getByText('0 errors 4 warnings')).toBeTruthy();
  });

  it('resumes a draft against its saved baseline', () => {
    const baseline = bundled();
    const doc = structuredClone(baseline);
    doc.rules.marketplace.stones = 4;
    saveDraft({
      doc,
      baseline,
      sourceName: 'notes.json',
      routes: [{ name: 'rush', steps: [] }]
    });
    render(<App />);
    fireEvent.click(button('Resume draft'));

    expect(screen.getByText('notes.json')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resume draft' })).toBeNull();
    expect(screen.getByText('0 errors 5 warnings')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Problems' }));
    fireEvent.click(screen.getByRole('button', { name: /Best score keeps the highest total/ }));
    expect(screen.getByRole('tab', { name: 'Chapter' }).getAttribute('aria-selected')).toBe('true');
  });

  it('drops a chapter file onto the window', async () => {
    render(<App />);
    const transfer = new DataTransfer();
    transfer.items.add(new File([chapterRaw], 'dropped.json', { type: 'application/json' }));
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: transfer });
    document.body.dispatchEvent(event);
    expect(await screen.findByText('dropped.json')).toBeTruthy();
  });

  it('selects on click, toggles on shift-click, and clears on Escape', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '(0,-1) gate, normal, papers 1/3' }));
    expect(screen.getByText('(0,-1)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Apply this kit to selection' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '(1,-1) (1,-1), easy, papers 1/2' }), { shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: '(0,0) camp, player, copper 1/3' }), { shiftKey: true });
    expect(screen.getByText('(0,-1), (1,-1), (0,0)')).toBeTruthy();

    const markers = (cell: string) => document.querySelector(`[data-cell="${cell}"] .hex-markers`)?.textContent ?? '';
    fireEvent.click(screen.getByRole('button', { name: 'Apply this kit to selection' }));
    expect(markers('0,-1')).toBe('r k');
    expect(markers('1,-1')).toBe('k');
    expect(markers('0,0')).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Reset kits to Default' }));
    expect(markers('1,-1')).toBe('');
    expect(markers('0,-1')).toBe('r');

    fireEvent.click(button('Undo'));
    expect(markers('1,-1')).toBe('k');
    expect(markers('0,0')).toBe('');

    fireEvent.click(screen.getByRole('button', { name: '(0,-1) gate, normal, papers 1/3' }), { shiftKey: true });
    expect(screen.getByText('(1,-1), (0,0)')).toBeTruthy();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByText('Select a tile on the map')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Apply this kit to selection' })).toBeNull();
  });

  it('paints a difficulty drag as one undo and skips the owned camp', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    const gate = screen.getByRole('button', { name: '(0,-1) gate, normal, papers 1/3' });
    const east = screen.getByRole('button', { name: '(1,-1) (1,-1), easy, papers 1/2' });
    const camp = screen.getByRole('button', { name: '(0,0) camp, player, copper 1/3' });
    const papers = screen.getByRole('button', { name: '(1,0) (1,0), easy, papers 1/2' });
    fireEvent.pointerDown(gate);
    fireEvent.pointerEnter(east);
    fireEvent.pointerEnter(camp);
    fireEvent.pointerEnter(papers);
    fireEvent.pointerUp(papers);

    expect(screen.getByRole('button', { name: '(0,-1) gate, hard, papers 1/3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '(1,-1) (1,-1), hard, papers 1/2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '(1,0) (1,0), hard, papers 1/2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '(0,0) camp, player, copper 1/3' })).toBeTruthy();
    expect(button('Undo').disabled).toBe(false);

    fireEvent.click(button('Undo'));
    expect(button('Undo').disabled).toBe(true);
    expect(screen.getByRole('button', { name: '(0,-1) gate, normal, papers 1/3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '(1,-1) (1,-1), easy, papers 1/2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '(1,0) (1,0), easy, papers 1/2' })).toBeTruthy();
  });

  it('recolors the start view and highlights a hover while reveal is on', () => {
    const { container } = render(<App />);
    fireEvent.pointerEnter(screen.getByRole('button', { name: '(0,-1) gate, normal, papers 1/3' }));
    expect(container.querySelector('[data-cell="0,-2"] .hex-reveal-ring')).not.toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hover reveal' }));
    expect(container.querySelector('.hex-reveal-ring')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Start view' }));
    expect(container.querySelector('[data-cell="0,-2"] .hex-shape')?.classList.contains('hex-fill-hidden')).toBe(true);
    expect(container.querySelector('[data-cell="0,-1"] .hex-shape')?.classList.contains('hex-fill-seen')).toBe(true);
    expect(container.querySelector('[data-cell="0,0"] .hex-shape')?.classList.contains('hex-fill-player')).toBe(true);
  });

  it('does not replace a pending draft when Bundled reloads the file already on screen', () => {
    const doc = structuredClone(bundled());
    doc.title = 'Kept';
    saveDraft({ doc, baseline: bundled(), sourceName: 'notes.json', routes: [] });
    render(<App />);
    fireEvent.click(button('Bundled'));
    expect(loadDraft()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resume draft' })).toBeNull();
    expect(screen.getByText('bundled')).toBeTruthy();
  });
});
