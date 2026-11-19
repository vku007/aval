import { simulateBattles, type SimulationInput, type SimulationResult } from '@apiv2/application/campaign/BattleSimulator.js';

export interface SimRequest {
  id: number;
  input: SimulationInput;
}

export interface SimResponse {
  id: number;
  result?: SimulationResult;
  error?: string;
}

export function runSimRequest(request: SimRequest): SimResponse {
  try {
    return { id: request.id, result: simulateBattles(request.input) };
  } catch (caught) {
    return { id: request.id, error: caught instanceof Error ? caught.message : String(caught) };
  }
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<SimRequest>) => void) | null;
  postMessage(message: SimResponse): void;
};

scope.onmessage = (event) => {
  scope.postMessage(runSimRequest(event.data));
};
