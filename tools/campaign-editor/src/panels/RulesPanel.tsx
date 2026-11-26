import { DIG_TURNS, unitFor, type MineProduct } from '@apiv2/domain/campaign/CampaignInventory.js';
import type { ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { ITEM_KEYS, type InventoryItemKey } from '@apiv2/domain/value-object/GamePlayerInventory.js';
import { StackEditor, stackWord } from '../components/StackEditor.js';
import { Checkbox, IntField } from '../components/fields.js';
import type { DocAction } from '../model/document.js';

export interface RulesPanelProps {
  settings: ChapterSettings;
  onAction: (action: DocAction) => void;
}

const INCOME: readonly { product: MineProduct; word: string }[] = [
  { product: 'stones', word: 'Stone' },
  { product: 'scissors', word: 'Scissors' },
  { product: 'papers', word: 'Paper' },
  { product: 'copper', word: 'Copper' }
];

const WEIGHTS = [
  { key: 'perVictory', label: 'Per victory' },
  { key: 'turnsPerVictory', label: 'Turns per victory' },
  { key: 'perExtraTurn', label: 'Per extra turn' },
  { key: 'perSilver', label: 'Per silver' },
  { key: 'perCopper', label: 'Per copper' }
] as const;

export function RulesPanel({ settings, onAction }: RulesPanelProps) {
  const rules = settings.rules;
  const entry = rules.battleEntry;

  function setCost(key: 'digCost' | 'searchCost' | 'increaseMinesCost', value: number) {
    onAction({ type: 'setRules', patch: { [key]: value } });
  }

  return (
    <div class="form-panel">
      <IntField label="Dig cost" value={rules.digCost} onCommit={(value) => setCost('digCost', value)} />
      <IntField label="Search cost" value={rules.searchCost} onCommit={(value) => setCost('searchCost', value)} />
      <IntField
        label="Upgrade cost"
        value={rules.increaseMinesCost}
        onCommit={(value) => setCost('increaseMinesCost', value)}
      />
      <fieldset class="form-section">
        <legend>Battle entry</legend>
        <div class="mode-choices">
          <label>
            <input
              type="radio"
              name="battle-entry"
              checked={entry === 'fee'}
              onChange={() => {
                if (entry !== 'fee') onAction({ type: 'setBattleEntry', entry: 'fee' });
              }}
            />
            Fee
          </label>
          <label>
            <input
              type="radio"
              name="battle-entry"
              checked={entry === 'wager'}
              onChange={() => {
                if (entry !== 'wager') onAction({ type: 'setBattleEntry', entry: 'wager' });
              }}
            />
            Wager
          </label>
        </div>
        {entry === 'fee' ? (
          <IntField
            label="Attack fee"
            value={rules.attackFee ?? null}
            onCommit={(fee) => onAction({ type: 'setAttackFee', fee })}
          />
        ) : (
          <StackEditor
            items={rules.battleKit ?? {}}
            onChange={(items) => onAction({ type: 'setStack', path: ['rules', 'battleKit'], items })}
          />
        )}
      </fieldset>
      <IntField
        label="Action points per turn"
        value={rules.actionPointsPerTurn}
        onCommit={(actionPointsPerTurn) => onAction({ type: 'setRules', patch: { actionPointsPerTurn } })}
      />
      <Checkbox
        label="Economy consumes an action point"
        checked={rules.economyConsumesActionPoint}
        onChange={(economyConsumesActionPoint) => onAction({ type: 'setRules', patch: { economyConsumesActionPoint } })}
      />
      <fieldset class="form-section">
        <legend>Score weights</legend>
        {WEIGHTS.map((weight) => (
          <IntField
            key={weight.key}
            label={weight.label}
            value={rules.scoreWeights[weight.key]}
            onCommit={(value) =>
              onAction({
                type: 'setRules',
                patch: { scoreWeights: { ...rules.scoreWeights, [weight.key]: value } }
              })
            }
          />
        ))}
      </fieldset>
      <fieldset class="form-section">
        <legend>Marketplace</legend>
        {ITEM_KEYS.map((item) => (
          <MarketRow
            key={item}
            item={item}
            price={rules.marketplace[item]}
            onAction={onAction}
          />
        ))}
      </fieldset>
      <section class="fixed-by-code" aria-label="Fixed by code">
        <p>Dig turns: {DIG_TURNS}, fixed by code.</p>
        <p>
          Income per mine: {INCOME.map((row) => `${row.word} ${unitFor(row.product)}`).join(', ')}, fixed by code.
        </p>
      </section>
    </div>
  );
}

function MarketRow({
  item,
  price,
  onAction
}: {
  item: InventoryItemKey;
  price: number | undefined;
  onAction: (action: DocAction) => void;
}) {
  const word = stackWord(item);
  const forSale = price !== undefined;
  return (
    <div class="market-row" data-item={item}>
      <span class="market-name">{word}</span>
      <label class="market-sale">
        <input
          type="checkbox"
          checked={forSale}
          aria-label={`${word} for sale`}
          onChange={(event) => {
            const checked = (event.currentTarget as HTMLInputElement).checked;
            onAction({ type: 'setMarketplaceItem', item, price: checked ? 1 : null });
          }}
        />
        {forSale ? 'For sale' : 'Not for sale'}
      </label>
      {forSale && (
        <IntField
          label={`${word} price`}
          value={price}
          min={1}
          onCommit={(next) => onAction({ type: 'setMarketplaceItem', item, price: next })}
        />
      )}
    </div>
  );
}
