import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import { parseChapterSettings, type ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditorState, reduce, type DocAction } from '../model/document.js';
import { kitUsage } from '../model/derive.js';
import { ChapterPanel } from './ChapterPanel.js';
import { InventoryPanel } from './InventoryPanel.js';
import { RewardsPanel } from './RewardsPanel.js';
import { RulesPanel } from './RulesPanel.js';

function bundled(): ChapterSettings {
  return parseChapterSettings(JSON.parse(chapterRaw));
}

function apply(settings: ChapterSettings, action: DocAction): ChapterSettings {
  return reduce(createEditorState(settings, 'test'), action).doc;
}

function usageLine(count: number): string {
  return `used by ${count} ${count === 1 ? 'tile' : 'tiles'} by default`;
}

afterEach(() => {
  cleanup();
});

describe('ChapterPanel', () => {
  it('shows the id and bumps the ruleset version', () => {
    const onAction = vi.fn();
    render(<ChapterPanel settings={bundled()} onAction={onAction} />);
    expect(screen.getByText('chapter-i')).toBeTruthy();
    expect(screen.queryByLabelText('Id')).toBeNull();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Chapter I');

    fireEvent.click(screen.getByRole('button', { name: 'Bump' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'setChapter', patch: { rulesetVersion: 2 } });
    expect(apply(bundled(), onAction.mock.calls[0][0]).rulesetVersion).toBe(2);
  });
});

describe('RulesPanel', () => {
  it('dispatches price null when an item is marked Not for sale', () => {
    const onAction = vi.fn();
    const { rerender } = render(<RulesPanel settings={bundled()} onAction={onAction} />);
    expect(screen.getByText('For sale', { selector: '[data-item="stones"] .market-sale' })).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Stone for sale' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'setMarketplaceItem', item: 'stones', price: null });

    const next = apply(bundled(), onAction.mock.calls[0][0]);
    expect(next.rules.marketplace.stones).toBeUndefined();
    rerender(<RulesPanel settings={next} onAction={onAction} />);
    const row = document.querySelector('[data-item="stones"]') as HTMLElement;
    expect(row.textContent).toContain('Not for sale');
    expect(within(row).queryByLabelText('Stone price')).toBeNull();

    fireEvent.click(within(row).getByRole('checkbox', { name: 'Stone for sale' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'setMarketplaceItem', item: 'stones', price: 1 });
    expect(apply(next, onAction.mock.calls[1][0]).rules.marketplace.stones).toBe(1);
  });

  it('does not write a marketplace price below 1', () => {
    const onAction = vi.fn();
    render(<RulesPanel settings={bundled()} onAction={onAction} />);
    const price = screen.getByLabelText('Stone price');
    fireEvent.input(price, { target: { value: '0' } });
    fireEvent.blur(price);
    expect(price.getAttribute('aria-invalid')).toBe('true');
    expect(onAction).not.toHaveBeenCalled();
  });

  it('removes attackFee when battle entry switches to wager', () => {
    const onAction = vi.fn();
    const { rerender } = render(<RulesPanel settings={bundled()} onAction={onAction} />);
    expect(screen.getByLabelText('Attack fee')).toBeTruthy();
    expect(screen.queryByLabelText('Stone')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Wager' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'setBattleEntry', entry: 'wager' });

    const next = apply(bundled(), onAction.mock.calls[0][0]);
    expect(next.rules.battleEntry).toBe('wager');
    expect('attackFee' in next.rules).toBe(false);
    expect(next.rules.battleKit).toEqual({});

    rerender(<RulesPanel settings={next} onAction={onAction} />);
    expect(screen.queryByLabelText('Attack fee')).toBeNull();
    expect(screen.getByLabelText('Stone')).toBeTruthy();
  });

  it('labels dig turns and income units as fixed by code', () => {
    render(<RulesPanel settings={bundled()} onAction={vi.fn()} />);
    const fixed = screen.getByRole('region', { name: 'Fixed by code' });
    expect(fixed.textContent).toContain('Dig turns: 2, fixed by code.');
    expect(fixed.textContent).toContain('Income per mine: Stone 1, Scissors 1, Paper 1, Copper 2, fixed by code.');
  });
});

describe('InventoryPanel', () => {
  it('shows the bundled kit usage and selects a custom-kit tile', () => {
    const settings = bundled();
    const usage = kitUsage(settings);
    const onAction = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(<InventoryPanel settings={settings} onAction={onAction} onSelect={onSelect} />);

    expect(within(screen.getByRole('group', { name: 'Easy' })).getByText(usageLine(usage.easy.defaultCount))).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Normal' })).getByText(usageLine(usage.normal.defaultCount))).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Hard' })).getByText(usageLine(usage.hard.defaultCount))).toBeTruthy();
    expect(usage).toEqual({
      easy: { defaultCount: 16, customCells: [] },
      normal: { defaultCount: 1, customCells: [] },
      hard: { defaultCount: 1, customCells: [] }
    });

    const edited = apply(settings, { type: 'setKit', cells: [{ q: 0, r: -1 }], kit: { scissors: 7 } });
    rerender(<InventoryPanel settings={edited} onAction={onAction} onSelect={onSelect} />);
    expect(kitUsage(edited).normal).toEqual({ defaultCount: 0, customCells: [{ q: 0, r: -1 }] });
    expect(screen.getByText('used by 0 tiles by default')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'gate (0,-1)' }));
    expect(onSelect).toHaveBeenCalledWith({ q: 0, r: -1 });
  });
});

describe('RewardsPanel', () => {
  it('writes one easy reward stack', () => {
    const onAction = vi.fn();
    render(<RewardsPanel settings={bundled()} onAction={onAction} />);
    const copper = screen.getByRole('group', { name: 'Copper' });
    const amount = within(copper).getByLabelText('Copper');
    fireEvent.input(amount, { target: { value: '9' } });
    fireEvent.blur(amount);
    expect(onAction).toHaveBeenCalledWith({
      type: 'setStack',
      path: ['easyRewards', 'copper'],
      items: {},
      currencies: { copper: 9 }
    });
  });
});
