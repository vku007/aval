import type { ChapterSettings, TileSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { StackEditor } from '../components/StackEditor.js';
import { Select, type FieldOption } from '../components/fields.js';
import type { Cell, DocAction } from '../model/document.js';
import { kitUsage } from '../model/derive.js';

export interface InventoryPanelProps {
  settings: ChapterSettings;
  onAction: (action: DocAction) => void;
  onSelect: (cell: Cell) => void;
}

const RANKS = [
  { id: 'easy', label: 'Easy' },
  { id: 'normal', label: 'Normal' },
  { id: 'hard', label: 'Hard' }
] as const;

const ROUNDS: readonly FieldOption<'BO5' | 'BO7'>[] = [
  { value: 'BO5', label: 'BO5' },
  { value: 'BO7', label: 'BO7' }
];

export function InventoryPanel({ settings, onAction, onSelect }: InventoryPanelProps) {
  const usage = kitUsage(settings);
  return (
    <div class="form-panel">
      <fieldset class="form-section">
        <legend>Starting inventory</legend>
        <StackEditor
          items={settings.startingInventory.items}
          currencies={settings.startingInventory.currencies}
          onChange={(items, currencies) =>
            onAction({
              type: 'setStack',
              path: ['startingInventory'],
              items,
              currencies: currencies ?? {}
            })
          }
        />
      </fieldset>
      {RANKS.map((rank) => (
        <fieldset class="form-section" key={rank.id}>
          <legend>{rank.label}</legend>
          <StackEditor
            items={settings.defenderKits[rank.id]}
            onChange={(items) => onAction({ type: 'setStack', path: ['defenderKits', rank.id], items })}
          />
          <Select
            label={`${rank.label} rounds`}
            value={settings.rounds[rank.id]}
            options={ROUNDS}
            onChange={(rounds) => onAction({ type: 'setRounds', difficulty: rank.id, rounds })}
          />
          <p class="kit-usage">{usageLine(usage[rank.id].defaultCount)}</p>
          <div class="kit-tiles">
            <span>Custom kits</span>
            {usage[rank.id].customCells.length === 0 ? (
              <span>none</span>
            ) : (
              usage[rank.id].customCells.map((cell) => {
                const tile = settings.tiles.find((item) => item.q === cell.q && item.r === cell.r);
                return (
                  <button type="button" key={`${cell.q},${cell.r}`} onClick={() => onSelect(cell)}>
                    {tileName(tile, cell)}
                  </button>
                );
              })
            )}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function usageLine(count: number): string {
  return `used by ${count} ${count === 1 ? 'tile' : 'tiles'} by default`;
}

function tileName(tile: TileSettings | undefined, cell: Cell): string {
  const coord = `(${cell.q},${cell.r})`;
  if (!tile?.label || tile.label === coord) return coord;
  return `${tile.label} ${coord}`;
}
