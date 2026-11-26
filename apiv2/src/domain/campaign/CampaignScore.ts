export interface LinearScoreWeights {
  base: number;
  perTurn: number;
  perVictory: number;
  perSilver: number;
  perCopper: number;
}

export interface PaceScoreWeights {
  perVictory: number;
  turnsPerVictory: number;
  perExtraTurn: number;
  perSilver: number;
  perCopper: number;
}

export type ScoreWeights = LinearScoreWeights | PaceScoreWeights;

export interface CampaignScoreRecord {
  total: number;
  turns: number;
  victories: number;
  silver: number;
  copper: number;
}

export interface ScoreInputs {
  turns: number;
  victories: number;
  silver: number;
  copper: number;
  weights: ScoreWeights;
}

/**
 * Pace weights name `perExtraTurn` and `turnsPerVictory`.
 * A run stored with `base` and `perTurn` keeps the linear formula.
 */
export function isPaceScoreWeights(weights: ScoreWeights): weights is PaceScoreWeights {
  const pace = weights as PaceScoreWeights;
  return typeof pace.perExtraTurn === 'number' && typeof pace.turnsPerVictory === 'number';
}

/**
 * Frozen at victory. Inputs are the amounts used, not the points.
 * Pace: victories add, turns past `victories × turnsPerVictory` subtract, coins add.
 * Linear: `perTurn` subtracts. The other linear weights add.
 */
export function campaignScore(input: ScoreInputs): CampaignScoreRecord {
  const raw = isPaceScoreWeights(input.weights) ? paceRaw(input) : linearRaw(input);
  return {
    total: Math.max(0, raw),
    turns: input.turns,
    victories: input.victories,
    silver: input.silver,
    copper: input.copper
  };
}

function paceRaw(input: ScoreInputs): number {
  const weights = input.weights as PaceScoreWeights;
  const pace = input.victories * weights.turnsPerVictory;
  const extra = Math.max(0, input.turns - pace);
  return input.victories * weights.perVictory
    - extra * weights.perExtraTurn
    + input.silver * weights.perSilver
    + input.copper * weights.perCopper;
}

function linearRaw(input: ScoreInputs): number {
  const weights = input.weights as LinearScoreWeights;
  return weights.base
    - input.turns * weights.perTurn
    + input.victories * weights.perVictory
    + input.silver * weights.perSilver
    + input.copper * weights.perCopper;
}
