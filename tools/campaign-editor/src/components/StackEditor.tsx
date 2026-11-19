import { positiveCurrencies, positiveItems, type CurrencyStack, type ItemStack } from '@apiv2/domain/campaign/CampaignInventory.js';
import {
  CURRENCY_KEYS,
  ITEM_KEYS,
  type InventoryCurrencyKey,
  type InventoryItemKey
} from '@apiv2/domain/value-object/GamePlayerInventory.js';
import { IntField } from './fields.js';

const WORDS = {
  stones: 'Stone',
  scissors: 'Scissors',
  papers: 'Paper',
  NA_effect_stone: 'Stone NA',
  NA_effect_scissors: 'Scissors NA',
  NA_effect_papers: 'Paper NA',
  NT_effect: 'Core',
  gold: 'Gold',
  silver: 'Silver',
  copper: 'Copper'
} as const;

export type StackKey = InventoryItemKey | InventoryCurrencyKey;

export function stackWord(key: StackKey): string {
  return WORDS[key];
}

export interface StackEditorProps {
  items: ItemStack;
  /** Omit the currency rows when this is left out. */
  currencies?: CurrencyStack;
  readOnly?: boolean;
  /** Item rows gain a delta column against this stack. */
  compareTo?: ItemStack;
  onChange: (items: ItemStack, currencies?: CurrencyStack) => void;
}

export function StackEditor({ items, currencies, readOnly = false, compareTo, onChange }: StackEditorProps) {
  function emit(nextItems: ItemStack, nextCurrencies: CurrencyStack | undefined) {
    if (nextCurrencies === undefined) onChange(positiveItems(nextItems));
    else onChange(positiveItems(nextItems), positiveCurrencies(nextCurrencies));
  }

  return (
    <div class="stack-editor">
      {ITEM_KEYS.map((key) => (
        <StackRow
          key={key}
          stackKey={key}
          amount={shownAmount(items[key])}
          readOnly={readOnly}
          delta={compareTo ? (items[key] ?? 0) - (compareTo[key] ?? 0) : undefined}
          onCommit={(amount) => emit({ ...items, [key]: amount }, currencies)}
        />
      ))}
      {currencies &&
        CURRENCY_KEYS.map((key) => (
          <StackRow
            key={key}
            stackKey={key}
            amount={shownAmount(currencies[key])}
            readOnly={readOnly}
            onCommit={(amount) => emit(items, { ...currencies, [key]: amount })}
          />
        ))}
    </div>
  );
}

function StackRow({
  stackKey,
  amount,
  readOnly,
  delta,
  onCommit
}: {
  stackKey: StackKey;
  amount: number | null;
  readOnly: boolean;
  delta?: number;
  onCommit: (amount: number) => void;
}) {
  return (
    <div class="stack-row" data-key={stackKey}>
      <IntField label={stackWord(stackKey)} value={amount} readOnly={readOnly} onCommit={onCommit} />
      {delta !== undefined && (
        <span class="stack-delta" data-sign={deltaSign(delta)}>
          {formatDelta(delta)}
        </span>
      )}
    </div>
  );
}

function shownAmount(amount: number | undefined): number | null {
  return amount !== undefined && amount > 0 ? amount : null;
}

function deltaSign(delta: number): 'plus' | 'minus' | 'zero' {
  if (delta > 0) return 'plus';
  if (delta < 0) return 'minus';
  return 'zero';
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `\u2212${Math.abs(delta)}`;
  return '0';
}
