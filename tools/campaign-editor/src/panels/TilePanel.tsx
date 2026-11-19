import type { ItemStack } from '@apiv2/domain/campaign/CampaignInventory.js';
import type { ChapterSettings, RewardSettings, TileSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { NPC_ALGORITHM_GREED_V1, NPC_ALGORITHM_V1 } from '@apiv2/domain/campaign/Garrison.js';
import { ITEM_KEYS } from '@apiv2/domain/value-object/GamePlayerInventory.js';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { StackEditor } from '../components/StackEditor.js';
import { Checkbox, IntField, MixedHint, Select, type FieldOption } from '../components/fields.js';
import type { Cell, DocAction } from '../model/document.js';
import { mixedValue, tileFacts, type TileFacts } from '../model/derive.js';
import { SimulationPanel } from './SimulationPanel.js';

export interface TilePanelProps {
  settings: ChapterSettings;
  selection: Cell[];
  onAction: (action: DocAction) => void;
}

type Mode = 'default' | 'custom' | 'mixed';
type Rank = 'easy' | 'normal' | 'hard';
type Product = TileSettings['product'];

const OWNERS: readonly FieldOption<'neutral' | 'player'>[] = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'player', label: 'Player' }
];

const PRODUCTS: readonly FieldOption<Product>[] = [
  { value: 'stones', label: 'Stone' },
  { value: 'scissors', label: 'Scissors' },
  { value: 'papers', label: 'Paper' },
  { value: 'copper', label: 'Copper' }
];

const RANKS: readonly FieldOption<Rank>[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' }
];

const ALGORITHMS: readonly FieldOption<string>[] = [
  { value: NPC_ALGORITHM_V1, label: NPC_ALGORITHM_V1 },
  { value: NPC_ALGORITHM_GREED_V1, label: NPC_ALGORITHM_GREED_V1 }
];

export function TilePanel({ settings, selection, onAction }: TilePanelProps) {
  const tiles = tilesFor(settings, selection);
  if (tiles.length === 0) {
    return <p class="tile-empty">Select a tile on the map</p>;
  }

  const cells = tiles.map((tile) => ({ q: tile.q, r: tile.r }));
  const allOwned = tiles.every((tile) => tile.owner === 'player');
  const owner = ownerChoice(tiles);
  const product = mixedValue(tiles, 'product');
  const mines = mixedValue(tiles, 'mines');
  const maxMines = mixedValue(tiles, 'maxMines');
  const difficulty = rankChoice(tiles);
  const revealed = mixedValue(tiles, 'revealed');
  const objective = shared(tiles.map((tile) => tile.objective === true));
  const algorithm = shared(tiles.map((tile) => tile.npcAlgorithmId ?? NPC_ALGORITHM_V1));
  const label = shared(tiles.map((tile) => tile.label ?? ''));
  const rewardMode = presenceMode(tiles.map((tile) => tile.reward !== undefined));
  const kitMode = presenceMode(tiles.map((tile) => tile.defenderKit !== undefined));
  const stashMode = presenceMode(tiles.map((tile) => tile.stash !== undefined));
  const reward = shownReward(settings, tiles, rewardMode);
  const kit = shownKit(settings, tiles, kitMode);
  const stash = stashMode === 'custom' ? shownStash(tiles) : 'mixed';
  const rank = difficulty === 'mixed' ? null : difficulty;
  const facts = tiles.map((tile) => tileFacts(settings, tile));
  const algorithmOptions =
    algorithm === 'mixed' || ALGORITHMS.some((option) => option.value === algorithm)
      ? ALGORITHMS
      : [...ALGORITHMS, { value: algorithm, label: algorithm }];

  return (
    <div class="tile-panel">
      <ReadOnlyRow label="Coordinate" value={tiles.map((tile) => `(${tile.q},${tile.r})`).join(', ')} />
      <LabelField
        value={label}
        onCommit={(next) => onAction({ type: 'setTiles', cells, patch: { label: next } })}
      />
      <Choice
        label="Owner"
        value={owner}
        options={OWNERS}
        onChange={(next) => onAction({ type: 'setOwner', cells, owner: next })}
      />
      <Choice
        label="Product"
        value={product}
        options={PRODUCTS}
        onChange={(next) => onAction({ type: 'setTiles', cells, patch: { product: next } })}
      />
      <NumberField
        label="Mines"
        value={mines}
        onCommit={(next) => onAction({ type: 'setTiles', cells, patch: { mines: next } })}
      />
      <NumberField
        label="Max mines"
        value={maxMines}
        onCommit={(next) => onAction({ type: 'setTiles', cells, patch: { maxMines: next } })}
      />
      {!allOwned && (
        <Choice
          label="Difficulty"
          value={difficulty}
          options={RANKS}
          onChange={(next) => onAction({ type: 'setTiles', cells, patch: { difficulty: next } })}
        />
      )}
      <BoolField
        label="Revealed"
        value={revealed}
        onChange={(next) => onAction({ type: 'setTiles', cells, patch: { revealed: next } })}
      />
      <BoolField
        label="Objective"
        value={objective}
        disabled={allOwned}
        onChange={(next) => onAction({ type: 'setTiles', cells, patch: { objective: next } })}
      />
      {!allOwned && (
        <Choice
          label="NPC algorithm"
          value={algorithm}
          options={algorithmOptions}
          onChange={(next) => onAction({ type: 'setTiles', cells, patch: { npcAlgorithmId: next } })}
        />
      )}
      <ModeField
        legend="Reward"
        value={rewardMode}
        choices={[
          { value: 'default', label: 'Default' },
          { value: 'custom', label: 'Custom' }
        ]}
        onChoose={(next) => chooseReward(settings, tiles, cells, rewardMode, next, onAction)}
      >
        <RewardBody
          mode={rewardMode}
          reward={reward}
          onChange={(next) => onAction({ type: 'setReward', cells, reward: next })}
        />
      </ModeField>
      {!allOwned && (
        <ModeField
          legend="Defender kit"
          value={kitMode}
          choices={[
            { value: 'default', label: 'Default' },
            { value: 'custom', label: 'Custom' }
          ]}
          onChoose={(next) => chooseKit(cells, kitMode, next, onAction)}
        >
          <KitBody
            mode={kitMode}
            kit={kit}
            compareTo={rank ? settings.defenderKits[rank] : undefined}
            onChange={(next) => onAction({ type: 'setKit', cells, kit: next })}
          />
          {tiles.some((tile) => tile.defenderKit !== undefined) && (
            <p class="kit-diff">
              {kitMode === 'custom' ? <DiffText text={shared(tiles.map((tile) => kitLine(settings, tile)))} /> : <MixedHint />}
              <button type="button" onClick={() => onAction({ type: 'setKit', cells, kit: null })}>
                Reset to difficulty kit
              </button>
            </p>
          )}
        </ModeField>
      )}
      <ModeField
        legend="Stash"
        value={stashMode}
        choices={[
          { value: 'default', label: 'None' },
          { value: 'custom', label: 'One pile' }
        ]}
        onChoose={(next) => chooseStash(tiles, cells, stashMode, next, onAction)}
      >
        <StashBody
          mode={stashMode}
          stash={stash}
          onChange={(next) => onAction({ type: 'setStash', cells, stash: next })}
        />
      </ModeField>
      <section class="tile-facts" aria-label="Derived">
        <Fact label="Income per turn" value={shared(facts.map(incomeText))} />
        <Fact label="Dig yield" value={shared(facts.map((fact) => String(fact.digYield)))} />
        {facts.some((fact) => fact.digNet !== null) && (
          <Fact label="Dig net" value={shared(facts.map((fact) => (fact.digNet === null ? '—' : String(fact.digNet))))} />
        )}
        <Fact label="Rounds" value={shared(facts.map((fact) => fact.rounds ?? 'none'))} />
        <Fact label="Garrison" value={shared(facts.map((fact) => formatStack(fact.kit)))} />
      </section>
      <section data-slot="simulation">
        {!allOwned && <SimulationPanel settings={settings} tiles={tiles} />}
      </section>
    </div>
  );
}

function tilesFor(settings: ChapterSettings, selection: Cell[]): TileSettings[] {
  const tiles: TileSettings[] = [];
  for (const cell of selection) {
    const tile = settings.tiles.find((item) => item.q === cell.q && item.r === cell.r);
    if (tile) tiles.push(tile);
  }
  return tiles;
}

function chooseReward(
  settings: ChapterSettings,
  tiles: TileSettings[],
  cells: Cell[],
  mode: Mode,
  next: string,
  onAction: (action: DocAction) => void
) {
  if (next === 'default') {
    if (mode === 'default') return;
    onAction({ type: 'setReward', cells, reward: null });
    return;
  }
  if (mode === 'custom') return;
  onAction({ type: 'setReward', cells, reward: tileFacts(settings, tiles[0]).reward });
}

function chooseKit(cells: Cell[], mode: Mode, next: string, onAction: (action: DocAction) => void) {
  if (next === 'default') {
    if (mode === 'default') return;
    onAction({ type: 'setKit', cells, kit: null });
    return;
  }
  if (mode === 'custom') return;
  onAction({ type: 'setKit', cells, kit: 'copy-difficulty' });
}

function chooseStash(
  tiles: TileSettings[],
  cells: Cell[],
  mode: Mode,
  next: string,
  onAction: (action: DocAction) => void
) {
  if (next === 'default') {
    if (mode === 'default') return;
    onAction({ type: 'setStash', cells, stash: null });
    return;
  }
  if (mode === 'custom') return;
  const existing = tiles.find((tile) => tile.stash)?.stash ?? { items: {}, currencies: {} };
  onAction({
    type: 'setStash',
    cells,
    stash: { items: { ...existing.items }, currencies: { ...existing.currencies } }
  });
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div class="select-field">
      <span class="field-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function LabelField({ value, onCommit }: { value: string | 'mixed'; onCommit: (label: string) => void }) {
  const mixed = value === 'mixed';
  const shown = mixed ? '' : value;
  const [text, setText] = useState(shown);
  const committed = useRef<string | null>(null);

  useEffect(() => {
    setText(shown);
    committed.current = null;
  }, [shown, mixed]);

  function commit(raw: string) {
    if (mixed && raw === '') return;
    if ((!mixed && raw === value) || committed.current === raw) {
      setText(shown);
      return;
    }
    committed.current = raw;
    onCommit(raw);
  }

  return (
    <div class="tile-mixed">
      <label class="text-field">
        <span class="field-label">Label</span>
        <input
          type="text"
          value={text}
          onInput={(event) => setText((event.currentTarget as HTMLInputElement).value)}
          onBlur={(event) => commit((event.currentTarget as HTMLInputElement).value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const input = event.currentTarget as HTMLInputElement;
            commit(input.value);
            input.blur();
          }}
        />
      </label>
      {mixed && <MixedHint />}
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T | 'mixed';
  options: readonly FieldOption<T>[];
  onChange: (value: T) => void;
}) {
  if (value === 'mixed') {
    const id = fieldId(label);
    return (
      <div class="select-field">
        <span class="field-label" id={id}>
          {label}
        </span>
        <span class="choice-control">
          <select
            aria-labelledby={id}
            value=""
            onChange={(event) => onChange((event.currentTarget as HTMLSelectElement).value as T)}
          >
            <option value="" disabled>
              Mixed
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <MixedHint />
        </span>
      </div>
    );
  }
  return <Select label={label} value={value} options={options} onChange={onChange} />;
}

function NumberField({
  label,
  value,
  onCommit
}: {
  label: string;
  value: number | 'mixed';
  onCommit: (value: number) => void;
}) {
  return (
    <div class="tile-mixed">
      <IntField label={label} value={value === 'mixed' ? null : value} onCommit={onCommit} />
      {value === 'mixed' && <MixedHint />}
    </div>
  );
}

function BoolField({
  label,
  value,
  disabled = false,
  onChange
}: {
  label: string;
  value: boolean | 'mixed';
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  if (value === 'mixed') {
    return (
      <div class="bool-field">
        <IndeterminateCheck label={label} disabled={disabled} onChange={onChange} />
        <MixedHint />
      </div>
    );
  }
  return <Checkbox label={label} checked={value} disabled={disabled} onChange={onChange} />;
}

function IndeterminateCheck({
  label,
  disabled,
  onChange
}: {
  label: string;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = true;
  }, []);
  return (
    <label class="check-field">
      <input
        ref={ref}
        type="checkbox"
        disabled={disabled}
        onChange={(event) => onChange((event.currentTarget as HTMLInputElement).checked)}
      />
      <span class="field-label">{label}</span>
    </label>
  );
}

function ModeField({
  legend,
  value,
  choices,
  onChoose,
  children
}: {
  legend: string;
  value: Mode;
  choices: readonly { value: string; label: string }[];
  onChoose: (value: string) => void;
  children?: ComponentChildren;
}) {
  return (
    <fieldset class="mode-field">
      <legend>{legend}</legend>
      <div class="mode-choices">
        {value === 'mixed' && <MixedHint />}
        {choices.map((choice) => (
          <label key={choice.value}>
            <input
              type="radio"
              name={legend}
              aria-label={`${legend} ${choice.label}`}
              checked={value === choice.value}
              onChange={() => onChoose(choice.value)}
            />
            {choice.label}
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}

function RewardBody({
  mode,
  reward,
  onChange
}: {
  mode: Mode;
  reward: RewardSettings | 'mixed';
  onChange: (reward: RewardSettings) => void;
}) {
  if (mode === 'mixed') return null;
  if (reward === 'mixed') return <MixedHint />;
  return (
    <StackEditor
      items={reward.items}
      currencies={reward.currencies}
      readOnly={mode === 'default'}
      onChange={(items, currencies) => onChange({ items, currencies: currencies ?? {} })}
    />
  );
}

function KitBody({
  mode,
  kit,
  compareTo,
  onChange
}: {
  mode: Mode;
  kit: ItemStack | 'mixed';
  compareTo?: ItemStack;
  onChange: (kit: ItemStack) => void;
}) {
  if (mode === 'mixed') return null;
  if (kit === 'mixed') return <MixedHint />;
  return (
    <StackEditor
      items={kit}
      readOnly={mode === 'default'}
      compareTo={mode === 'custom' ? compareTo : undefined}
      onChange={(items) => onChange(items)}
    />
  );
}

function StashBody({
  mode,
  stash,
  onChange
}: {
  mode: Mode;
  stash: RewardSettings | 'mixed';
  onChange: (stash: RewardSettings) => void;
}) {
  if (mode !== 'custom') return null;
  if (stash === 'mixed') return <MixedHint />;
  return (
    <StackEditor
      items={stash.items}
      currencies={stash.currencies}
      onChange={(items, currencies) => onChange({ items, currencies: currencies ?? {} })}
    />
  );
}

function DiffText({ text }: { text: string | 'mixed' }) {
  if (text === 'mixed') return <MixedHint />;
  return <span>{text}</span>;
}

function Fact({ label, value }: { label: string; value: string | 'mixed' }) {
  return (
    <p>
      {label}: {value === 'mixed' ? <MixedHint /> : value}
    </p>
  );
}

function ownerChoice(tiles: TileSettings[]): 'neutral' | 'player' | 'mixed' {
  const owner = mixedValue(tiles, 'owner');
  if (owner === 'mixed') return 'mixed';
  return owner === 'player' ? 'player' : 'neutral';
}

function rankChoice(tiles: TileSettings[]): Rank | 'mixed' {
  const rank = mixedValue(tiles, 'difficulty');
  if (rank === 'easy' || rank === 'normal' || rank === 'hard') return rank;
  return 'mixed';
}

function presenceMode(flags: boolean[]): Mode {
  const value = shared(flags);
  if (value === 'mixed') return 'mixed';
  return value ? 'custom' : 'default';
}

function shownReward(settings: ChapterSettings, tiles: TileSettings[], mode: Mode): RewardSettings | 'mixed' {
  if (mode === 'mixed') return 'mixed';
  const rewards = tiles.map((tile) =>
    mode === 'custom' ? tile.reward ?? emptyReward() : tileFacts(settings, tile).reward
  );
  return shared(rewards, sameReward);
}

function shownKit(settings: ChapterSettings, tiles: TileSettings[], mode: Mode): ItemStack | 'mixed' {
  if (mode === 'mixed') return 'mixed';
  const kits = tiles.map((tile) => (mode === 'custom' ? tile.defenderKit ?? {} : tileFacts(settings, tile).kit));
  return shared(kits, sameStack);
}

function shownStash(tiles: TileSettings[]): RewardSettings | 'mixed' {
  return shared(
    tiles.map((tile) => tile.stash ?? emptyReward()),
    sameReward
  );
}

function kitLine(settings: ChapterSettings, tile: TileSettings): string {
  const facts = tileFacts(settings, tile);
  if (facts.kitDiff.length === 0) return `same as the ${tile.difficulty ?? 'difficulty'} kit`;
  return facts.kitDiff.map(formatDelta).join(', ');
}

function formatDelta(delta: TileFacts['kitDiff'][number]): string {
  const amount = Math.abs(delta.delta);
  return delta.delta > 0 ? `+${amount} ${delta.key}` : `\u2212${amount} ${delta.key}`;
}

function incomeText(facts: TileFacts): string {
  if (facts.incomePerTurn === 'never-pays') return 'never pays: taking it ends the chapter';
  return String(facts.incomePerTurn);
}

function formatStack(stack: ItemStack): string {
  const parts: string[] = [];
  for (const key of ITEM_KEYS) {
    const amount = stack[key] ?? 0;
    if (amount > 0) parts.push(`${amount} ${key}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'none';
}

function sameReward(a: RewardSettings, b: RewardSettings): boolean {
  return sameStack(a.items, b.items) && sameStack(a.currencies, b.currencies);
}

function sameStack(a: object, b: object): boolean {
  const left = a as Record<string, number | undefined>;
  const right = b as Record<string, number | undefined>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key] ?? 0) !== (right[key] ?? 0)) return false;
  }
  return true;
}

function emptyReward(): RewardSettings {
  return { items: {}, currencies: {} };
}

function shared<T>(values: readonly T[], equals: (a: T, b: T) => boolean = Object.is): T | 'mixed' {
  const first = values[0];
  for (let index = 1; index < values.length; index += 1) {
    if (!equals(values[index] as T, first as T)) return 'mixed';
  }
  return first as T;
}

function fieldId(label: string): string {
  return `tile-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}
