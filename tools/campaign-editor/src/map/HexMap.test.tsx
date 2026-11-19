import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import { parseChapterSettings, type ChapterSettings, type Problem } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HexMap, type HexMapProps } from './HexMap.js';

function bundled(): ChapterSettings {
  return parseChapterSettings(JSON.parse(chapterRaw));
}

function renderMap(overrides: Partial<HexMapProps> = {}) {
  const onCellClick = vi.fn();
  const onCellPointer = vi.fn();
  const view = render(
    <HexMap
      settings={bundled()}
      selection={[]}
      problems={[]}
      overlay="design"
      hoverReveal={false}
      onCellClick={onCellClick}
      onCellPointer={onCellPointer}
      {...overrides}
    />
  );
  return { ...view, onCellClick, onCellPointer };
}

afterEach(() => {
  cleanup();
});

describe('HexMap', () => {
  it('renders 19 cells and the citadel star and glyph', () => {
    const { container } = renderMap();
    expect(container.querySelectorAll('[data-cell]')).toHaveLength(19);

    const citadel = container.querySelector('[data-cell="0,-2"]');
    expect(citadel?.getAttribute('aria-label')).toBe('(0,-2) citadel, hard, papers 2/4');
    expect(citadel?.textContent).toContain('★');
    expect(citadel?.textContent).toContain('Pa 2/4');
    expect(citadel?.querySelector('.hex-shape')?.classList.contains('hex-fill-hard')).toBe(true);
    expect(citadel?.querySelector('.hex-hatch')).not.toBeNull();

    const gate = container.querySelector('[data-cell="0,-1"]');
    expect(gate?.getAttribute('aria-label')).toBe('(0,-1) gate, normal, papers 1/3');
    expect(gate?.textContent).toContain('Pa 1/3');
    expect(gate?.querySelector('.hex-markers')?.textContent).toBe('r');
    expect(gate?.querySelector('.hex-hatch')).toBeNull();

    const stash = container.querySelector('[data-cell="0,1"]');
    expect(stash?.querySelector('.hex-markers')?.textContent).toBe('s');

    const camp = container.querySelector('[data-cell="0,0"]');
    expect(camp?.getAttribute('aria-label')).toBe('(0,0) camp, player, copper 1/3');
    expect(camp?.textContent).toContain('C 1/3');
    expect(camp?.querySelector('.hex-shape')?.classList.contains('hex-fill-player')).toBe(true);
    expect(camp?.querySelector('.hex-markers')).toBeNull();
  });

  it('marks a custom defender kit with k', () => {
    const settings = bundled();
    const gate = settings.tiles.find(tile => tile.q === 0 && tile.r === -1);
    gate!.defenderKit = { scissors: 7 };
    const { container } = renderMap({ settings });
    expect(container.querySelector('[data-cell="0,-1"] .hex-markers')?.textContent).toBe('r k');
  });

  it('gives a mines-range problem the error class, and a warning the warning class', () => {
    const problems: Problem[] = [
      {
        level: 'error',
        code: 'mines-range',
        path: ['tiles', 0, 'mines'],
        tile: { q: 0, r: 0 },
        message: 'mines exceed maxMines'
      },
      {
        level: 'warning',
        code: 'dig-net',
        path: ['tiles', 5, 'mines'],
        tile: { q: -1, r: 1 },
        message: 'dig does not pay'
      }
    ];
    const { container } = renderMap({ problems, selection: [{ q: 0, r: 0 }] });
    const camp = container.querySelector('[data-cell="0,0"]');
    expect(camp?.classList.contains('hex-error')).toBe(true);
    expect(camp?.classList.contains('hex-warning')).toBe(false);
    expect(camp?.classList.contains('hex-selected')).toBe(true);
    const copper = container.querySelector('[data-cell="-1,1"]');
    expect(copper?.classList.contains('hex-warning')).toBe(true);
    expect(copper?.classList.contains('hex-error')).toBe(false);
    expect(container.querySelector('[data-cell="0,-2"]')?.classList.contains('hex-error')).toBe(false);
  });

  it('reports shift-click and pointer phases', () => {
    const onCellClick = vi.fn();
    const onCellPointer = vi.fn();
    const { container } = renderMap({ onCellClick, onCellPointer });
    const gate = container.querySelector('[data-cell="0,-1"]');
    expect(gate).not.toBeNull();
    fireEvent.click(gate!, { shiftKey: true });
    expect(onCellClick).toHaveBeenCalledWith({ q: 0, r: -1 }, { shift: true });
    fireEvent.click(gate!, { shiftKey: false });
    expect(onCellClick).toHaveBeenCalledWith({ q: 0, r: -1 }, { shift: false });
    fireEvent.pointerDown(gate!);
    fireEvent.pointerEnter(gate!);
    fireEvent.pointerUp(gate!);
    expect(onCellPointer).toHaveBeenNthCalledWith(1, { q: 0, r: -1 }, 'down');
    expect(onCellPointer).toHaveBeenNthCalledWith(2, { q: 0, r: -1 }, 'enter');
    expect(onCellPointer).toHaveBeenNthCalledWith(3, { q: 0, r: -1 }, 'up');
  });

  it('recolors the start view and highlights the cells a hover would reveal', () => {
    const { container } = renderMap({ overlay: 'start', hoverReveal: true });
    expect(container.querySelector('[data-cell="0,0"] .hex-shape')?.classList.contains('hex-fill-player')).toBe(true);
    expect(container.querySelector('[data-cell="0,-1"] .hex-shape')?.classList.contains('hex-fill-seen')).toBe(true);
    expect(container.querySelector('[data-cell="0,-2"] .hex-shape')?.classList.contains('hex-fill-hidden')).toBe(true);

    fireEvent.pointerEnter(container.querySelector('[data-cell="0,-1"]')!);
    expect(container.querySelector('[data-cell="1,-2"] .hex-reveal-ring')).not.toBeNull();
    expect(container.querySelector('[data-cell="0,-2"] .hex-reveal-ring')).not.toBeNull();
    expect(container.querySelector('[data-cell="-1,-1"] .hex-reveal-ring')).not.toBeNull();
    expect(container.querySelector('[data-cell="0,-1"] .hex-reveal-ring')).toBeNull();

    fireEvent.pointerLeave(container.querySelector('[data-cell="0,-1"]')!);
    expect(container.querySelector('.hex-reveal-ring')).toBeNull();
  });

  it('does not highlight when hover reveal is off', () => {
    const { container } = renderMap({ hoverReveal: false });
    fireEvent.pointerEnter(container.querySelector('[data-cell="0,-1"]')!);
    expect(container.querySelector('.hex-reveal-ring')).toBeNull();
  });
});
