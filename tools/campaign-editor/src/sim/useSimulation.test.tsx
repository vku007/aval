import type { SimulationInput, SimulationResult } from '@apiv2/application/campaign/BattleSimulator.js';
import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIM_DEBOUNCE_MS, useSimulation, type SimPort, type SimulationView } from './useSimulation.js';
import type { SimRequest, SimResponse } from './simWorker.js';

function input(runs: number): SimulationInput {
  return {
    humanItems: { stones: 1 },
    npcItems: { stones: 1 },
    rounds: 'BO5',
    levelName: 'easy',
    npcAlgorithmId: 'npc-v1',
    runs
  };
}

function fakeResult(wins: number): SimulationResult {
  return {
    runs: 1,
    wins,
    losses: 0,
    capped: 0,
    winRate: wins,
    cappedRate: 0,
    averageRoundWins: { player: 0, npc: 0 },
    itemsSpent: { average: {}, worst: {} },
    garrisonAfterLoss: null,
    secondAttack: null
  };
}

function Probe({ input: next, port }: { input: SimulationInput; port: SimPort }) {
  const view = useSimulation(next, port);
  return <output data-testid="sim">{JSON.stringify(shown(view))}</output>;
}

function shown(view: SimulationView): { wins: number | null } {
  return { wins: view.result ? view.result.wins : null };
}

function Harness({ port }: { port: SimPort }) {
  const [runs, setRuns] = useState(1);
  return (
    <div>
      <button type="button" onClick={() => setRuns((current) => current + 1)}>
        Change
      </button>
      <span data-testid="runs">{runs}</span>
      <Probe input={input(runs)} port={port} />
    </div>
  );
}

function recordingPort() {
  const posted: SimRequest[] = [];
  let listener: (response: SimResponse) => void = () => {};
  const port: SimPort = {
    post(request) {
      posted.push(request);
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
    deliver(response: SimResponse) {
      listener(response);
    }
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useSimulation', () => {
  it('posts once per debounce window', () => {
    const { port, posted } = recordingPort();
    const view = render(<Harness port={port} />);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(view.getByRole('button', { name: 'Change' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(view.getByRole('button', { name: 'Change' }));
    act(() => {
      vi.advanceTimersByTime(SIM_DEBOUNCE_MS - 1);
    });
    expect(posted).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(posted.map((request) => request.input.runs)).toEqual([3]);

    act(() => {
      vi.advanceTimersByTime(SIM_DEBOUNCE_MS);
    });
    expect(posted).toHaveLength(1);

    fireEvent.click(view.getByRole('button', { name: 'Change' }));
    act(() => {
      vi.advanceTimersByTime(SIM_DEBOUNCE_MS);
    });
    expect(posted.map((request) => request.input.runs)).toEqual([3, 4]);
  });

  it('drops a result whose id is no longer the latest request', () => {
    const { port, posted, deliver } = recordingPort();
    const view = render(<Probe input={input(1)} port={port} />);

    act(() => {
      vi.advanceTimersByTime(SIM_DEBOUNCE_MS);
    });
    const first = posted[0].id;
    act(() => {
      deliver({ id: first, result: fakeResult(1) });
    });
    expect(view.getByTestId('sim').textContent).toBe('{"wins":1}');

    view.rerender(<Probe input={input(2)} port={port} />);
    act(() => {
      vi.advanceTimersByTime(SIM_DEBOUNCE_MS);
    });
    const second = posted[1].id;
    act(() => {
      deliver({ id: first, result: fakeResult(9) });
    });
    expect(view.getByTestId('sim').textContent).toBe('{"wins":1}');

    act(() => {
      deliver({ id: second, result: fakeResult(2) });
    });
    expect(view.getByTestId('sim').textContent).toBe('{"wins":2}');

    act(() => {
      deliver({ id: first, result: fakeResult(9) });
    });
    expect(view.getByTestId('sim').textContent).toBe('{"wins":2}');
  });
});
