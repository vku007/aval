import type { ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { StackEditor } from '../components/StackEditor.js';
import type { DocAction, StackPath } from '../model/document.js';

export interface RewardsPanelProps {
  settings: ChapterSettings;
  onAction: (action: DocAction) => void;
}

const PRODUCTS = [
  { product: 'stones', label: 'Stone' },
  { product: 'scissors', label: 'Scissors' },
  { product: 'papers', label: 'Paper' },
  { product: 'copper', label: 'Copper' }
] as const;

export function RewardsPanel({ settings, onAction }: RewardsPanelProps) {
  return (
    <div class="form-panel">
      {PRODUCTS.map((row) => {
        const reward = settings.easyRewards[row.product];
        const path: StackPath = ['easyRewards', row.product];
        return (
          <fieldset class="form-section" key={row.product}>
            <legend>{row.label}</legend>
            <StackEditor
              items={reward.items}
              currencies={reward.currencies}
              onChange={(items, currencies) =>
                onAction({ type: 'setStack', path, items, currencies: currencies ?? {} })
              }
            />
          </fieldset>
        );
      })}
    </div>
  );
}
