import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import { parseChapterSettings, type ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Route } from '../model/document.js';
import { RoutesPanel } from './RoutesPanel.js';

function bundled(): ChapterSettings {
  return parseChapterSettings(JSON.parse(chapterRaw));
}

function renderPanel(routes: Route[] = [], selection: { q: number; r: number }[] = []) {
  const onRoutes = vi.fn();
  const view = render(
    <RoutesPanel settings={bundled()} routes={routes} selection={selection} onRoutes={onRoutes} />
  );
  return { ...view, onRoutes };
}

afterEach(() => {
  cleanup();
});

describe('RoutesPanel', () => {
  it('shows the bare rush score and the south-stash failure', () => {
    renderPanel();
    const rush = document.querySelector('[data-route="Bare rush"]');
    const south = document.querySelector('[data-route="South stash"]');
    expect(rush?.getAttribute('data-completed')).toBe('true');
    expect(rush?.textContent).toContain('Score 325');
    expect(rush?.textContent).toContain('pace 4, extra 0');
    expect(rush?.textContent).toContain('total 325');
    expect(south?.getAttribute('data-completed')).toBe('false');
    expect(south?.textContent).toContain('Not enough copper');
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('adds a designer route and an attack for the selected cell', () => {
    const { onRoutes, rerender } = renderPanel([], [{ q: 0, r: -1 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Add route' }));
    const added = [{ name: 'Route 1', steps: [] }];
    expect(onRoutes).toHaveBeenCalledWith(added);

    rerender(
      <RoutesPanel settings={bundled()} routes={added} selection={[{ q: 0, r: -1 }]} onRoutes={onRoutes} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Route 1 attack' }));
    expect(onRoutes).toHaveBeenLastCalledWith([
      { name: 'Route 1', steps: [{ type: 'attack', q: 0, r: -1 }] }
    ]);
  });

  it('adds an end turn from the form, reorders it, and drops an invalid amount', () => {
    const route: Route = { name: 'Notes', steps: [{ type: 'end_turn' }] };
    const onRoutes = vi.fn();
    const { rerender } = render(
      <RoutesPanel settings={bundled()} routes={[route]} selection={[]} onRoutes={onRoutes} />
    );

    fireEvent.change(screen.getByLabelText('Notes step type'), { target: { value: 'end_turn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Notes add step' }));
    expect(onRoutes).toHaveBeenLastCalledWith([
      { name: 'Notes', steps: [{ type: 'end_turn' }, { type: 'end_turn' }] }
    ]);

    const longer: Route = { name: 'Notes', steps: [{ type: 'end_turn' }, { type: 'dig', q: 0, r: 0 }] };
    rerender(<RoutesPanel settings={bundled()} routes={[longer]} selection={[]} onRoutes={onRoutes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Notes move step 2 up' }));
    expect(onRoutes).toHaveBeenLastCalledWith([
      {
        name: 'Notes',
        steps: [
          { type: 'dig', q: 0, r: 0 },
          { type: 'end_turn' }
        ]
      }
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Notes delete step 1' }));
    expect(onRoutes).toHaveBeenLastCalledWith([{ name: 'Notes', steps: [{ type: 'dig', q: 0, r: 0 }] }]);

    onRoutes.mockClear();
    fireEvent.change(screen.getByLabelText('Notes step type'), { target: { value: 'buy' } });
    fireEvent.input(screen.getByLabelText('Notes amount'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Notes add step' }));
    expect(onRoutes).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Notes amount').getAttribute('aria-invalid')).toBe('true');
  });
});
