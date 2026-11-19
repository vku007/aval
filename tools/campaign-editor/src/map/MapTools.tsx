import type { ChapterSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { Checkbox } from '../components/fields.js';
import type { Brush, Cell, DocAction } from '../model/document.js';
import { kitForSelection } from './useBrush.js';

const DIFFICULTIES: readonly { value: 'easy' | 'normal' | 'hard'; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' }
];

const PRODUCTS: readonly { value: 'stones' | 'scissors' | 'papers' | 'copper'; label: string }[] = [
  { value: 'stones', label: 'Stone' },
  { value: 'scissors', label: 'Scissors' },
  { value: 'papers', label: 'Paper' },
  { value: 'copper', label: 'Copper' }
];

export interface MapToolsProps {
  brush: Brush | null;
  overlay: 'design' | 'start';
  hoverReveal: boolean;
  onBrush: (brush: Brush | null) => void;
  onOverlay: (overlay: 'design' | 'start') => void;
  onHoverReveal: (hoverReveal: boolean) => void;
}

export function MapTools({ brush, overlay, hoverReveal, onBrush, onOverlay, onHoverReveal }: MapToolsProps) {
  return (
    <div class="map-tools">
      <div class="map-tool-row" role="group" aria-label="Brush">
        <span class="map-tool-label">Brush</span>
        <BrushButton pressed={brush === null} label="None" onClick={() => onBrush(null)} />
        <span class="map-tool-label">Difficulty</span>
        {DIFFICULTIES.map((item) => (
          <BrushButton
            key={item.value}
            pressed={brush?.field === 'difficulty' && brush.value === item.value}
            label={item.label}
            onClick={() => onBrush({ field: 'difficulty', value: item.value })}
          />
        ))}
        <span class="map-tool-label">Product</span>
        {PRODUCTS.map((item) => (
          <BrushButton
            key={item.value}
            pressed={brush?.field === 'product' && brush.value === item.value}
            label={item.label}
            onClick={() => onBrush({ field: 'product', value: item.value })}
          />
        ))}
        <span class="map-tool-label">Revealed</span>
        <BrushButton
          pressed={brush?.field === 'revealed' && brush.value === true}
          label="Revealed"
          onClick={() => onBrush({ field: 'revealed', value: true })}
        />
        <BrushButton
          pressed={brush?.field === 'revealed' && brush.value === false}
          label="Hidden"
          onClick={() => onBrush({ field: 'revealed', value: false })}
        />
        <span class="map-tool-label">Kit</span>
        <BrushButton
          pressed={brush?.field === 'kit'}
          label="Kit: Default"
          onClick={() => onBrush({ field: 'kit', value: 'default' })}
        />
      </div>
      <div class="map-tool-row">
        <span class="map-tool-label">Overlay</span>
        <div role="radiogroup" aria-label="Overlay">
          <label>
            <input
              type="radio"
              name="map-overlay"
              checked={overlay === 'design'}
              onChange={() => onOverlay('design')}
            />
            Design
          </label>
          <label>
            <input
              type="radio"
              name="map-overlay"
              checked={overlay === 'start'}
              onChange={() => onOverlay('start')}
            />
            Start view
          </label>
        </div>
        <Checkbox label="Hover reveal" checked={hoverReveal} onChange={onHoverReveal} />
      </div>
    </div>
  );
}

export function SelectionKitActions({
  settings,
  selection,
  onAction
}: {
  settings: ChapterSettings;
  selection: Cell[];
  onAction: (action: DocAction) => void;
}) {
  const plan = kitForSelection(settings, selection);
  if (!plan) return null;
  return (
    <div class="tile-actions" role="group" aria-label="Selection">
      <button type="button" onClick={() => onAction({ type: 'setKit', cells: plan.cells, kit: plan.kit })}>
        Apply this kit to selection
      </button>
      <button type="button" onClick={() => onAction({ type: 'setKit', cells: plan.cells, kit: null })}>
        Reset kits to Default
      </button>
    </div>
  );
}

function BrushButton({ pressed, label, onClick }: { pressed: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={pressed ? 'true' : 'false'} onClick={onClick}>
      {label}
    </button>
  );
}
