import type { ItemStack } from '@apiv2/domain/campaign/CampaignInventory.js';
import { effectiveDefenderKit } from '@apiv2/domain/campaign/ChapterDefinitionBuilder.js';
import type { ChapterSettings, TileSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { NPC_ALGORITHM_V1 } from '@apiv2/domain/campaign/Garrison.js';
import type { SimulationInput, SimulationResult } from '@apiv2/application/campaign/BattleSimulator.js';
import { ITEM_KEYS } from '@apiv2/domain/value-object/GamePlayerInventory.js';
import { useState } from 'preact/hooks';
import { StackEditor } from '../components/StackEditor.js';
import { IntField } from '../components/fields.js';
import { useSimulation, type SimPort } from '../sim/useSimulation.js';

export const SIM_DEFAULT_RUNS = 200;
export const SIM_MAX_RUNS = 2000;

const HEADER = 'Autobattle — a floor for a careful player';

type PlayerMode = 'starting' | 'battleKit' | 'custom';

export interface SimulationPanelProps {
  settings: ChapterSettings;
  tiles: TileSettings[];
  port?: SimPort;
}

export function SimulationPanel({ settings, tiles, port }: SimulationPanelProps) {
  if (tiles.length > 0 && tiles.every((tile) => tile.owner === 'player')) return null;
  const tile = singleBattleTile(tiles);
  if (!tile) return <p class="sim-status">Select one tile to simulate.</p>;
  return <SimulationRun key={settings.rules.battleEntry} settings={settings} tile={tile} port={port} />;
}

function SimulationRun({
  settings,
  tile,
  port
}: {
  settings: ChapterSettings;
  tile: TileSettings;
  port?: SimPort;
}) {
  const [runs, setRuns] = useState(SIM_DEFAULT_RUNS);
  const [mode, setMode] = useState<PlayerMode>(() => defaultMode(settings));
  const [custom, setCustom] = useState<ItemStack>(() => ({ ...playerItems(settings, defaultMode(settings), {}) }));
  const humanItems = playerItems(settings, mode, custom);
  const input = simulationInput(settings, tile, humanItems, runs);
  const view = useSimulation(input, port);

  return (
    <section class="simulation" aria-label="Simulation">
      <h2>{HEADER}</h2>
      {input && (
        <>
          <div class="readout">
            <span>Kit</span>
            <span>{formatStack(input.npcItems)}</span>
          </div>
          <div class="readout">
            <span>Rounds</span>
            <span>{input.rounds}</span>
          </div>
          <div class="readout">
            <span>Algorithm</span>
            <span>{input.npcAlgorithmId}</span>
          </div>
        </>
      )}
      <IntField label="Runs" value={runs} min={1} max={SIM_MAX_RUNS} onCommit={setRuns} />
      <fieldset class="mode-field">
        <legend>Player stack</legend>
        <div class="mode-choices">
          <ModeRadio mode="starting" current={mode} label="Starting items (fee)" onChoose={setMode} />
          <ModeRadio mode="battleKit" current={mode} label="Battle kit (wager)" onChoose={setMode} />
          <ModeRadio mode="custom" current={mode} label="Custom" onChoose={setMode} />
        </div>
        <StackEditor items={humanItems} readOnly={mode !== 'custom'} onChange={setCustom} />
      </fieldset>
      {view.error && (
        <p class="sim-error" role="alert">
          {view.error}
        </p>
      )}
      {view.pending && <p class="sim-status">Running…</p>}
      {view.result && !view.pending && <SimulationOutput result={view.result} />}
    </section>
  );
}

function ModeRadio({
  mode,
  current,
  label,
  onChoose
}: {
  mode: PlayerMode;
  current: PlayerMode;
  label: string;
  onChoose: (mode: PlayerMode) => void;
}) {
  return (
    <label>
      <input
        type="radio"
        name="sim-player-stack"
        checked={current === mode}
        onChange={() => onChoose(mode)}
      />
      {label}
    </label>
  );
}

function SimulationOutput({ result }: { result: SimulationResult }) {
  const second = result.secondAttack;
  return (
    <div class="sim-output">
      <p>Win rate: {result.winRate}</p>
      <p>Wins: {result.wins}</p>
      <p>Losses: {result.losses}</p>
      <p>Capped: {result.capped}</p>
      <p>Capped rate: {result.cappedRate}</p>
      <p>
        Average round wins: player {result.averageRoundWins.player}, npc {result.averageRoundWins.npc}
      </p>
      <p>Items spent, average: {formatStack(result.itemsSpent.average)}</p>
      <p>Items spent, worst: {formatStack(result.itemsSpent.worst)}</p>
      <p>Garrison after a loss: {result.garrisonAfterLoss ? formatStack(result.garrisonAfterLoss) : 'none'}</p>
      <p>Second attack: {second ? `${second.winRate} over ${second.runs} runs` : 'none'}</p>
    </div>
  );
}

function singleBattleTile(tiles: TileSettings[]): TileSettings | null {
  const open = tiles.filter((tile) => tile.owner !== 'player' && tile.difficulty !== null);
  return open.length === 1 ? open[0] : null;
}

function defaultMode(settings: ChapterSettings): PlayerMode {
  return settings.rules.battleEntry === 'wager' ? 'battleKit' : 'starting';
}

function playerItems(settings: ChapterSettings, mode: PlayerMode, custom: ItemStack): ItemStack {
  if (mode === 'custom') return custom;
  if (mode === 'battleKit') return settings.rules.battleKit ?? {};
  return settings.startingInventory.items;
}

function simulationInput(
  settings: ChapterSettings,
  tile: TileSettings,
  humanItems: ItemStack,
  runs: number
): SimulationInput | null {
  if (tile.owner === 'player' || tile.difficulty === null) return null;
  return {
    humanItems: { ...humanItems },
    npcItems: { ...effectiveDefenderKit(settings, tile) },
    rounds: settings.rounds[tile.difficulty],
    levelName: tile.difficulty,
    npcAlgorithmId: tile.npcAlgorithmId ?? NPC_ALGORITHM_V1,
    runs
  };
}

function formatStack(stack: ItemStack): string {
  const parts: string[] = [];
  for (const key of ITEM_KEYS) {
    const amount = stack[key];
    if (amount === undefined || amount === 0) continue;
    parts.push(`${amount} ${key}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'none';
}
