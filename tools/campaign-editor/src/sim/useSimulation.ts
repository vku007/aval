import type { ItemStack } from '@apiv2/domain/campaign/CampaignInventory.js';
import type { SimulationInput, SimulationResult } from '@apiv2/application/campaign/BattleSimulator.js';
import { ITEM_KEYS } from '@apiv2/domain/value-object/GamePlayerInventory.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { SimRequest, SimResponse } from './simWorker.js';

export const SIM_DEBOUNCE_MS = 300;

export interface SimPort {
  post(request: SimRequest): void;
  subscribe(listener: (response: SimResponse) => void): () => void;
}

export interface SimulationView {
  result: SimulationResult | null;
  error: string | null;
  pending: boolean;
}

const IDLE: SimulationView = { result: null, error: null, pending: false };

/** One worker for every panel. Created on the first run. */
let sharedPort: SimPort | null = null;

let nextRequestId = 0;

export function useSimulation(input: SimulationInput | null, port?: SimPort): SimulationView {
  const [view, setView] = useState<SimulationView>(IDLE);
  const acceptedId = useRef(0);
  // Content, not object identity: the panel builds a new input object on each render.
  const key = simulationKey(input);

  useEffect(() => {
    if (input === null) {
      acceptedId.current = 0;
      setView(IDLE);
      return;
    }

    const postedInput = input;
    let unsubscribe = () => {};
    const accept = (message: SimResponse) => {
      if (message.id !== acceptedId.current) return;
      if (message.error !== undefined) {
        setView({ result: null, error: message.error, pending: false });
        return;
      }
      setView({ result: message.result ?? null, error: null, pending: false });
    };

    if (port) unsubscribe = port.subscribe(accept);
    setView((current) => ({ result: current.result, error: null, pending: true }));

    const timer = setTimeout(() => {
      let target: SimPort;
      try {
        target = port ?? sharedSimPort();
      } catch (caught) {
        setView({ result: null, error: errorMessage(caught), pending: false });
        return;
      }
      if (!port) unsubscribe = target.subscribe(accept);
      const id = ++nextRequestId;
      acceptedId.current = id;
      try {
        target.post({ id, input: postedInput });
      } catch (caught) {
        setView({ result: null, error: errorMessage(caught), pending: false });
      }
    }, SIM_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      unsubscribe();
      // Drop a response that belongs to the input we just left.
      acceptedId.current = 0;
    };
  }, [key, port]);

  return view;
}

function sharedSimPort(): SimPort {
  if (sharedPort) return sharedPort;
  const worker = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' });
  const listeners = new Set<(response: SimResponse) => void>();
  let lastId = 0;
  worker.onmessage = (event: MessageEvent<SimResponse>) => {
    for (const listener of listeners) listener(event.data);
  };
  worker.onerror = (event) => {
    const message = event.message || 'Simulation worker failed';
    for (const listener of listeners) listener({ id: lastId, error: message });
  };
  sharedPort = {
    post(request) {
      lastId = request.id;
      worker.postMessage(request);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
  return sharedPort;
}

function simulationKey(input: SimulationInput | null): string | null {
  if (input === null) return null;
  return JSON.stringify({
    humanItems: orderedStack(input.humanItems),
    npcItems: orderedStack(input.npcItems),
    rounds: input.rounds,
    levelName: input.levelName,
    npcAlgorithmId: input.npcAlgorithmId,
    runs: input.runs
  });
}

function orderedStack(stack: ItemStack): ItemStack {
  const ordered: ItemStack = {};
  for (const key of ITEM_KEYS) {
    const amount = stack[key];
    if (amount !== undefined && amount !== 0) ordered[key] = amount;
  }
  return ordered;
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}
