import { CURRENCY_KEYS, ITEM_KEYS } from '@apiv2/domain/value-object/GamePlayerInventory.js';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Checkbox, IntField, MixedHint, Select } from './fields.js';
import { StackEditor, stackWord } from './StackEditor.js';

afterEach(() => {
  cleanup();
});

describe('StackEditor', () => {
  it('emits positive amounts only, and not on each keystroke', () => {
    const onChange = vi.fn();
    const { rerender } = render(<StackEditor items={{ stones: 2, scissors: 0 }} onChange={onChange} />);

    const paper = screen.getByLabelText('Paper');
    fireEvent.input(paper, { target: { value: '3' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(paper);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ stones: 2, papers: 3 });

    rerender(<StackEditor items={{ stones: 2, papers: 3 }} onChange={onChange} />);
    const stone = screen.getByLabelText('Stone');
    fireEvent.input(stone, { target: { value: '0' } });
    fireEvent.keyDown(stone, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({ papers: 3 });
  });

  it('does not emit a non-integer or a negative amount', () => {
    const onChange = vi.fn();
    render(<StackEditor items={{ stones: 2 }} onChange={onChange} />);
    const stone = screen.getByLabelText('Stone');

    for (const value of ['-1', '1.5', 'no']) {
      fireEvent.input(stone, { target: { value } });
      fireEvent.blur(stone);
      expect(stone.getAttribute('aria-invalid')).toBe('true');
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a delta column against compareTo', () => {
    const { container } = render(
      <StackEditor
        items={{ stones: 5, scissors: 1 }}
        compareTo={{ stones: 2, scissors: 2, papers: 1 }}
        onChange={vi.fn()}
      />
    );

    expect(deltaText(container, 'stones')).toBe('+3');
    expect(deltaText(container, 'scissors')).toBe('\u22121');
    expect(deltaText(container, 'papers')).toBe('\u22121');
    expect(deltaText(container, 'NT_effect')).toBe('0');
    expect(container.querySelector('[data-key="copper"]')).toBeNull();
  });

  it('renders no inputs when read-only and lists currencies only when given', () => {
    const itemsOnly = render(<StackEditor items={{ stones: 2, NT_effect: 1 }} readOnly onChange={vi.fn()} />);
    expect(itemsOnly.container.querySelector('input')).toBeNull();
    expect(itemsOnly.container.querySelector('[data-key="stones"] .int-value')?.textContent).toBe('2');
    expect(itemsOnly.container.querySelector('[data-key="scissors"] .int-value')?.textContent).toBe('');
    expect(screen.queryByLabelText('Copper')).toBeNull();
    const itemKeys = [...itemsOnly.container.querySelectorAll('[data-key]')].map((row) => row.getAttribute('data-key'));
    expect(itemKeys).toEqual([...ITEM_KEYS]);
    itemsOnly.unmount();

    const onChange = vi.fn();
    const withCoins = render(
      <StackEditor items={{ stones: 1 }} currencies={{ copper: 4, gold: 0 }} onChange={onChange} />
    );
    const keys = [...withCoins.container.querySelectorAll('[data-key]')].map((row) => row.getAttribute('data-key'));
    expect(keys).toEqual([...ITEM_KEYS, ...CURRENCY_KEYS]);
    expect(ITEM_KEYS.map((key) => stackWord(key))).toEqual([
      'Stone',
      'Scissors',
      'Paper',
      'Stone NA',
      'Scissors NA',
      'Paper NA',
      'Core'
    ]);
    expect(screen.getByLabelText('Core')).toBeTruthy();

    const silver = screen.getByLabelText('Silver');
    fireEvent.input(silver, { target: { value: '2' } });
    fireEvent.blur(silver);
    expect(onChange).toHaveBeenCalledWith({ stones: 1 }, { silver: 2, copper: 4 });
  });
});

describe('fields', () => {
  it('commits an integer on blur and rejects an empty field below min', () => {
    const onCommit = vi.fn();
    render(<IntField label="Version" value={1} min={1} onCommit={onCommit} />);
    const version = screen.getByLabelText('Version');

    fireEvent.input(version, { target: { value: '' } });
    fireEvent.blur(version);
    expect(onCommit).not.toHaveBeenCalled();
    expect(version.getAttribute('aria-invalid')).toBe('true');

    fireEvent.input(version, { target: { value: '2' } });
    fireEvent.blur(version);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(2);
  });

  it('selects, checks, and marks a mixed value', () => {
    const onSelect = vi.fn();
    const onCheck = vi.fn();
    render(
      <div>
        <Select
          label="Product"
          value="stones"
          options={[
            { value: 'stones', label: 'Stones' },
            { value: 'copper', label: 'Copper' }
          ]}
          onChange={onSelect}
        />
        <Checkbox label="Revealed" checked={false} onChange={onCheck} />
        <MixedHint />
      </div>
    );

    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'copper' } });
    expect(onSelect).toHaveBeenCalledWith('copper');
    fireEvent.click(screen.getByLabelText('Revealed'));
    expect(onCheck).toHaveBeenCalledWith(true);
    expect(screen.getByText('Mixed').className).toBe('mixed-hint');
  });
});

function deltaText(container: ParentNode, key: string): string | null {
  return container.querySelector(`[data-key="${key}"] .stack-delta`)?.textContent ?? null;
}
