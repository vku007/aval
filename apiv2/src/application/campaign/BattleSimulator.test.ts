import { describe, expect, it } from 'vitest';
import chapterI from '../../domain/campaign/chapter-i.json';
import { NPC_ALGORITHM_V1 } from '../../domain/campaign/Garrison.js';
import type { ItemStack } from '../../domain/campaign/CampaignInventory.js';
import { simulateBattles, type SimulationInput } from './BattleSimulator.js';

const startingItems = chapterI.startingInventory.items as ItemStack;
const normalKit = chapterI.defenderKits.normal as ItemStack;
const hardKit = chapterI.defenderKits.hard as ItemStack;

function gate(runs: number): SimulationInput {
  return {
    humanItems: startingItems,
    npcItems: normalKit,
    rounds: 'BO5',
    levelName: 'normal',
    npcAlgorithmId: NPC_ALGORITHM_V1,
    runs
  };
}

describe('simulateBattles', () => {
  it('returns the same result for the same input', () => {
    const input = gate(8);
    expect(simulateBattles(input)).toEqual(simulateBattles(input));
  });

  it('pins the bundled gate over 200 runs', () => {
    expect(simulateBattles(gate(200))).toMatchSnapshot();
  });

  it('pins the bundled citadel over 200 runs', () => {
    const started = Date.now();
    const result = simulateBattles({
      humanItems: startingItems,
      npcItems: hardKit,
      rounds: 'BO7',
      levelName: 'hard',
      npcAlgorithmId: NPC_ALGORITHM_V1,
      runs: 200
    });
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(result).toMatchSnapshot();
  });

  it('wins every run when the garrison has no gestures', () => {
    const result = simulateBattles({
      humanItems: startingItems,
      npcItems: {},
      rounds: 'BO5',
      levelName: 'easy',
      npcAlgorithmId: NPC_ALGORITHM_V1,
      runs: 5
    });
    expect(result.wins).toBe(5);
    expect(result.winRate).toBe(1);
    expect(result.losses).toBe(0);
    expect(result.capped).toBe(0);
    expect(result.secondAttack).toBeNull();
    expect(result.garrisonAfterLoss).toBeNull();
  });
});
