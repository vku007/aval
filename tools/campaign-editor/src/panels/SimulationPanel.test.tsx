import { simulateBattles, type SimulationInput, type SimulationResult } from '@apiv2/application/campaign/BattleSimulator.js';
import chapterRaw from '@apiv2/domain/campaign/chapter-i.json?raw';
import { parseChapterSettings, type ChapterSettings, type TileSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { NPC_ALGORITHM_V1 } from '@apiv2/domain/campaign/Garrison.js';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIM_DEBOUNCE_MS, type SimPort } from '../sim/useSimulation.js';
import type { SimResponse } from '../sim/simWorker.js';
import { SimulationPanel } from './SimulationPanel.js';

function bundled(): ChapterSettings {
  return parseChapterSettings(JSON.parse(chapterRaw));
}

function tileAt(settings: ChapterSettings, q: number, r: number): TileSettings {
  const tile = settings.tiles.find((item) => item.q === q && item.r === r);
  if (!tile) throw new Error(`missing tile ${q},${r}`);
  return tile;
}

function directPort() {
  const posted: { id: number; input: SimulationInput }[] = [];
  let listener: (response: SimResponse) => void = () => {};
  let result: SimulationResult | null = null;
  let elapsed = 0;
  const port: SimPort = {
    post(request) {
      const started = Date.now();
      result = simulateBattles(request.input);
      elapsed = Date.now() - started;
      posted.push(request);
      listener({ id: request.id, result });
    },
    subscribe(next) {
      listener = next;
      return () => {
        if (listener === next) listener = () => {};
      };
    }
  };
  return {
    port,
    posted,
    elapsed: () => elapsed,
    result: () => result
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SimulationPanel', () => {
  it('hides the simulation for an owned tile and asks for one tile when several are selected', () => {
    const settings = bundled();
    const { rerender } = render(
      <SimulationPanel settings={settings} tiles={[tileAt(settings, 0, 0)]} port={directPort().port} />
    );
    expect(screen.queryByRole('heading', { name: 'Autobattle — a floor for a careful player' })).toBeNull();

    rerender(
      <SimulationPanel
        settings={settings}
        tiles={[tileAt(settings, 0, -1), tileAt(settings, 1, 0)]}
        port={directPort().port}
      />
    );
    expect(screen.getByText('Select one tile to simulate.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Autobattle — a floor for a careful player' })).toBeNull();
  });

  it('uses starting items on a fee chapter and the battle kit on a wager chapter', () => {
    const settings = bundled();
    const gate = tileAt(settings, 0, -1);
    const view = render(<SimulationPanel settings={settings} tiles={[gate]} port={directPort().port} />);
    const stack = () => screen.getByRole('group', { name: 'Player stack' });
    expect((within(stack()).getByRole('radio', { name: 'Starting items (fee)' }) as HTMLInputElement).checked).toBe(true);
    expect(stack().querySelector('.stack-editor input')).toBeNull();
    expect((screen.getByLabelText('Runs') as HTMLInputElement).value).toBe('200');

    fireEvent.click(within(stack()).getByRole('radio', { name: 'Custom' }));
    expect((within(stack()).getByLabelText('Stone') as HTMLInputElement).value).toBe('14');

    const wager = bundled();
    wager.rules.battleEntry = 'wager';
    delete wager.rules.attackFee;
    wager.rules.battleKit = { stones: 3, scissors: 1 };
    view.rerender(<SimulationPanel settings={wager} tiles={[tileAt(wager, 0, -1)]} port={directPort().port} />);
    expect((within(stack()).getByRole('radio', { name: 'Battle kit (wager)' }) as HTMLInputElement).checked).toBe(true);
    expect(within(stack()).getByText('3')).toBeTruthy();
    expect(within(stack()).getByText('1')).toBeTruthy();
    expect(stack().querySelector('.stack-editor input')).toBeNull();
  });

  it('matches the pinned apiv2 numbers for the bundled gate', () => {
    const settings = bundled();
    const gate = tileAt(settings, 0, -1);
    const sim = directPort();
    render(<SimulationPanel settings={settings} tiles={[gate]} port={sim.port} />);

    act(() => {
      vi.advanceTimersByTime(SIM_DEBOUNCE_MS);
    });

    expect(sim.posted).toHaveLength(1);
    expect(sim.posted[0].input).toEqual({
      humanItems: settings.startingInventory.items,
      npcItems: settings.defenderKits.normal,
      rounds: 'BO5',
      levelName: 'normal',
      npcAlgorithmId: NPC_ALGORITHM_V1,
      runs: 200
    });
    expect(sim.elapsed()).toBeLessThan(10_000);
    expect(sim.result()).toEqual({
      averageRoundWins: { npc: 1.52, player: 2.57 },
      capped: 0,
      cappedRate: 0,
      garrisonAfterLoss: {
        NA_effect_stone: 1,
        papers: 1.65,
        scissors: 0.69,
        stones: 1.72
      },
      itemsSpent: {
        average: {
          NA_effect_stone: 1,
          NT_effect: 1,
          papers: 4.8,
          scissors: 2.37,
          stones: 5.6
        },
        worst: {
          NA_effect_stone: 1,
          NT_effect: 1,
          papers: 9,
          scissors: 4,
          stones: 9
        }
      },
      losses: 54,
      runs: 200,
      secondAttack: { runs: 54, winRate: 1 },
      winRate: 0.73,
      wins: 146
    });
    expect(screen.getByRole('heading', { name: 'Autobattle — a floor for a careful player' })).toBeTruthy();
    expect(screen.getByText('Win rate: 0.73')).toBeTruthy();
    expect(screen.getByText('Wins: 146')).toBeTruthy();
    expect(screen.getByText('Losses: 54')).toBeTruthy();
    expect(screen.getByText('Capped: 0')).toBeTruthy();
    expect(screen.getByText('Capped rate: 0')).toBeTruthy();
    expect(screen.getByText('Average round wins: player 2.57, npc 1.52')).toBeTruthy();
    expect(screen.getByText('Items spent, average: 5.6 stones, 2.37 scissors, 4.8 papers, 1 NA_effect_stone, 1 NT_effect')).toBeTruthy();
    expect(screen.getByText('Items spent, worst: 9 stones, 4 scissors, 9 papers, 1 NA_effect_stone, 1 NT_effect')).toBeTruthy();
    expect(screen.getByText('Garrison after a loss: 1.72 stones, 0.69 scissors, 1.65 papers, 1 NA_effect_stone')).toBeTruthy();
    expect(screen.getByText('Second attack: 1 over 54 runs')).toBeTruthy();
  });
});
