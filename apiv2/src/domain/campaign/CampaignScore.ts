export interface ScoreWeights {
  base: number;
  perTurn: number;
  perVictory: number;
  perSilver: number;
  perCopper: number;
}

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
 * Frozen at victory. `perTurn` is subtracted. The other weights are added.
 * Inputs are the amounts used, not the points.
 */
export function campaignScore(input: ScoreInputs): CampaignScoreRecord {
  const { weights } = input;
  const raw = weights.base
    - input.turns * weights.perTurn
    + input.victories * weights.perVictory
    + input.silver * weights.perSilver
    + input.copper * weights.perCopper;
  return {
    total: Math.max(0, raw),
    turns: input.turns,
    victories: input.victories,
    silver: input.silver,
    copper: input.copper
  };
}
