import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import { parseChapterSettings, type ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Brush } from '../model/document.js';
import { MapTools, SelectionKitActions } from './MapTools.js';

function bundled(): ChapterSettings {
  return parseChapterSettings(JSON.parse(chapterRaw));
}

function renderTools(brush: Brush | null = null) {
  const onBrush = vi.fn();
  const onOverlay = vi.fn();
  const onHoverReveal = vi.fn();
  const view = render(
    <MapTools
      brush={brush}
      overlay="design"
      hoverReveal={true}
      onBrush={onBrush}
      onOverlay={onOverlay}
      onHoverReveal={onHoverReveal}
    />
  );
  return { ...view, onBrush, onOverlay, onHoverReveal };
}

afterEach(() => {
  cleanup();
});

describe('MapTools', () => {
  it('sets the brush, the overlay, and hover reveal', () => {
    const { onBrush, onOverlay, onHoverReveal } = renderTools();
    expect(screen.getByRole('button', { name: 'None' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Hard' }).getAttribute('aria-pressed')).toBe('false');
    expect((screen.getByRole('radio', { name: 'Design' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Hover reveal' }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    expect(onBrush).toHaveBeenCalledWith({ field: 'difficulty', value: 'hard' });
    fireEvent.click(screen.getByRole('button', { name: 'Copper' }));
    expect(onBrush).toHaveBeenCalledWith({ field: 'product', value: 'copper' });
    fireEvent.click(screen.getByRole('button', { name: 'Hidden' }));
    expect(onBrush).toHaveBeenCalledWith({ field: 'revealed', value: false });
    fireEvent.click(screen.getByRole('button', { name: 'Kit: Default' }));
    expect(onBrush).toHaveBeenCalledWith({ field: 'kit', value: 'default' });
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(onBrush).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole('radio', { name: 'Start view' }));
    expect(onOverlay).toHaveBeenCalledWith('start');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hover reveal' }));
    expect(onHoverReveal).toHaveBeenCalledWith(false);
  });

  it('shows the active brush pressed', () => {
    renderTools({ field: 'difficulty', value: 'normal' });
    expect(screen.getByRole('button', { name: 'Normal' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'None' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Easy' }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('SelectionKitActions', () => {
  it('applies the first neutral kit and resets the same cells', () => {
    const onAction = vi.fn();
    const settings = bundled();
    const { rerender } = render(
      <SelectionKitActions settings={settings} selection={[{ q: 0, r: -1 }]} onAction={onAction} />
    );
    expect(screen.queryByRole('group', { name: 'Selection' })).toBeNull();

    rerender(
      <SelectionKitActions
        settings={settings}
        selection={[
          { q: 0, r: 0 },
          { q: 0, r: -1 },
          { q: 1, r: -1 }
        ]}
        onAction={onAction}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply this kit to selection' }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'setKit',
      cells: [
        { q: 0, r: -1 },
        { q: 1, r: -1 }
      ],
      kit: settings.defenderKits.normal
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reset kits to Default' }));
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'setKit',
      cells: [
        { q: 0, r: -1 },
        { q: 1, r: -1 }
      ],
      kit: null
    });
  });
});
