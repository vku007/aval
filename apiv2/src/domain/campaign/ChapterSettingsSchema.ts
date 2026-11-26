import { z } from 'zod';
import { CURRENCY_KEYS, ITEM_KEYS } from '../value-object/GamePlayerInventory.js';
import { DIG_TURNS, unitFor, type CurrencyStack, type ItemStack } from './CampaignInventory.js';
import { assertSupportedNpcAlgorithm } from './Garrison.js';
import { neighborsOnMap, onMap } from './Hex.js';

const count = z.number().int().nonnegative();

function stackSchema<K extends string>(keys: readonly K[]) {
  const shape = {} as { [P in K]: z.ZodOptional<z.ZodNumber> };
  for (const key of keys) {
    shape[key] = count.optional();
  }
  return z.object(shape).strict();
}

const itemStackSchema = stackSchema(ITEM_KEYS);
const currencyStackSchema = stackSchema(CURRENCY_KEYS);

export type RewardSettings = { items: ItemStack; currencies: CurrencyStack };

const rewardSchema = z.object({
  items: itemStackSchema,
  currencies: currencyStackSchema
}).strict();

const scoreWeightsSchema = z.object({
  perVictory: count,
  turnsPerVictory: count,
  perExtraTurn: count,
  perSilver: count,
  perCopper: count
}).strict();

const linearScoreWeightsSchema = z.object({
  base: count,
  perTurn: count,
  perVictory: count,
  perSilver: count,
  perCopper: count
}).strict();

const rulesSchema = z.object({
  digCost: count,
  searchCost: count,
  increaseMinesCost: count,
  battleEntry: z.enum(['fee', 'wager']),
  attackFee: count.optional(),
  battleKit: itemStackSchema.optional(),
  marketplace: itemStackSchema,
  scoreWeights: scoreWeightsSchema,
  economyConsumesActionPoint: z.boolean(),
  actionPointsPerTurn: count
}).strict();

const inventorySchema = z.object({
  items: itemStackSchema,
  currencies: currencyStackSchema
}).strict();

const defenderKitsSchema = z.object({
  easy: itemStackSchema,
  normal: itemStackSchema,
  hard: itemStackSchema
}).strict();

const roundsSchema = z.object({
  easy: z.enum(['BO5', 'BO7']),
  normal: z.enum(['BO5', 'BO7']),
  hard: z.enum(['BO5', 'BO7'])
}).strict();

const easyRewardsSchema = z.object({
  stones: rewardSchema,
  scissors: rewardSchema,
  papers: rewardSchema,
  copper: rewardSchema
}).strict();

const tileSchema = z.object({
  q: z.number().int(),
  r: z.number().int(),
  product: z.enum(['stones', 'scissors', 'papers', 'copper']),
  mines: count,
  maxMines: count,
  difficulty: z.enum(['easy', 'normal', 'hard']).nullable(),
  revealed: z.boolean(),
  owner: z.literal('player').optional(),
  objective: z.boolean().optional(),
  /** A wall. The player can see it and cannot attack it. Omitted on a fight or the camp. */
  unavailable: z.literal(true).optional(),
  label: z.string().optional(),
  npcAlgorithmId: z.string().min(1).optional(),
  reward: rewardSchema.optional(),
  stash: rewardSchema.optional(),
  defenderKit: itemStackSchema.optional()
}).strict();

export const ChapterSettingsSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  goal: z.string().min(1),
  rulesetVersion: z.number().int().min(1),
  tileCount: count,
  rules: rulesSchema,
  startingInventory: inventorySchema,
  defenderKits: defenderKitsSchema,
  rounds: roundsSchema,
  easyRewards: easyRewardsSchema,
  tiles: z.array(tileSchema)
}).strict();

/** The deployed editor still writes `base` and `perTurn`. A file start keeps that linear score. */
export const ChapterFileSchema = ChapterSettingsSchema.extend({
  rules: rulesSchema.extend({
    scoreWeights: z.union([scoreWeightsSchema, linearScoreWeightsSchema])
  }).strict()
}).strict();

export type ChapterSettings = z.infer<typeof ChapterSettingsSchema>;
export type TileSettings = ChapterSettings['tiles'][number];

interface SettingsIssue {
  path: (string | number)[];
  message: string;
}

/**
 * `.strict()` reports the object that holds the key. The editor needs the path to end in the key.
 */
function issuesFrom(error: z.ZodError): SettingsIssue[] {
  const issues: SettingsIssue[] = [];
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        issues.push({
          path: [...issue.path, key],
          message: `Unrecognized key: ${key}`
        });
      }
      continue;
    }
    issues.push({ path: [...issue.path], message: issue.message });
  }
  return issues;
}

function dotted(path: (string | number)[]): string {
  return path.map(part => String(part)).join('.');
}

export function parseChapterSettings(value: unknown): ChapterSettings {
  const parsed = safeParseChapterSettings(value);
  if (parsed.ok) {
    return parsed.settings;
  }
  const issue = parsed.issues[0];
  const path = issue ? dotted(issue.path) : '';
  const message = issue?.message ?? 'Invalid chapter settings';
  throw new Error(`Chapter settings ${path}: ${message}`);
}

export function safeParseChapterSettings(value: unknown):
  | { ok: true; settings: ChapterSettings }
  | { ok: false; issues: SettingsIssue[] } {
  return parsedSettings(ChapterSettingsSchema.safeParse(value));
}

export function safeParseChapterFile(value: unknown):
  | { ok: true; settings: ChapterSettings }
  | { ok: false; issues: SettingsIssue[] } {
  const current = safeParseChapterSettings(value);
  if (current.ok) return current;
  const legacy = ChapterFileSchema.safeParse(value);
  if (legacy.success) {
    return { ok: true, settings: legacy.data as ChapterSettings };
  }
  return { ok: false, issues: issuesFrom(legacy.error) };
}

function parsedSettings(parsed: z.SafeParseReturnType<unknown, ChapterSettings>):
  | { ok: true; settings: ChapterSettings }
  | { ok: false; issues: SettingsIssue[] } {
  if (parsed.success) {
    return { ok: true, settings: parsed.data };
  }
  return { ok: false, issues: issuesFrom(parsed.error) };
}

export type ProblemCode =
  | 'tile-count'
  | 'tile-off-map'
  | 'tile-duplicate'
  | 'mines-range'
  | 'no-owned-tile'
  | 'no-objective'
  | 'objective-owned'
  | 'difficulty-missing'
  | 'owned-field'
  | 'npc-unknown'
  | 'entry-field'
  | 'price-zero'
  | 'action-points-zero'
  | 'version-unchanged'
  | 'objective-many'
  | 'action-points-many'
  | 'economy-point'
  | 'neighbor-hidden'
  | 'objective-adjacent'
  | 'label-duplicate'
  | 'fee-unaffordable'
  | 'objective-stash'
  | 'reward-empty'
  | 'mines-zero'
  | 'dig-net'
  | 'kit-size'
  | 'kit-no-gestures'
  | 'unavailable-owned'
  | 'unavailable-objective'
  | 'unavailable-field'
  | 'unavailable-mines'
  | 'objective-sealed'
  | 'tile-sealed';

export interface Problem {
  level: 'error' | 'warning';
  code: ProblemCode;
  path: (string | number)[];
  tile?: { q: number; r: number };
  message: string;
}

const MAP_TILES = 19;

const DIFFICULTY_LADDER = ['easy', 'normal', 'hard'] as const;
type LadderDifficulty = (typeof DIFFICULTY_LADDER)[number];

function problem(
  level: Problem['level'],
  code: ProblemCode,
  path: (string | number)[],
  message: string,
  tile?: { q: number; r: number }
): Problem {
  const reported: Problem = { level, code, path: [...path], message };
  if (tile) {
    reported.tile = { q: tile.q, r: tile.r };
  }
  return reported;
}

function tileProblem(
  level: Problem['level'],
  code: ProblemCode,
  index: number,
  field: string,
  message: string,
  tile: { q: number; r: number }
): Problem {
  return problem(level, code, ['tiles', index, field], message, tile);
}

function itemTotal(stack: ItemStack): number {
  let total = 0;
  for (const key of ITEM_KEYS) {
    total += stack[key] ?? 0;
  }
  return total;
}

function hasGestures(stack: ItemStack): boolean {
  return (stack.stones ?? 0) + (stack.scissors ?? 0) + (stack.papers ?? 0) > 0;
}

function affordableCopper(settings: ChapterSettings): number {
  let income = 0;
  for (const tile of settings.tiles) {
    if (tile.owner === 'player') {
      income += tile.mines * unitFor(tile.product);
    }
  }
  return (settings.startingInventory.currencies.copper ?? 0) + income;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    const source = value as Record<string, unknown>;
    for (const key of Object.keys(source).sort()) {
      sorted[key] = canonicalize(source[key]);
    }
    return sorted;
  }
  return value;
}

function comparable(settings: ChapterSettings): string {
  const copy = structuredClone(settings);
  const tiles = copy.tiles.map(tile => {
    const { label: _label, ...rest } = tile;
    return rest;
  });
  const { title: _title, goal: _goal, tiles: _tiles, ...rest } = copy;
  return JSON.stringify(canonicalize({ ...rest, tiles }));
}

function tileCountProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  if (settings.tileCount !== MAP_TILES) {
    problems.push(problem('error', 'tile-count', ['tileCount'], `tileCount must be ${MAP_TILES}`));
  }
  if (settings.tiles.length !== MAP_TILES) {
    problems.push(problem('error', 'tile-count', ['tiles'], `tiles must contain ${MAP_TILES} cells`));
  }
  return problems;
}

function tileOffMapProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (!onMap(tile.q, tile.r)) {
      problems.push(problem(
        'error',
        'tile-off-map',
        ['tiles', index],
        `(${tile.q},${tile.r}) is off the map`,
        tile
      ));
    }
  });
  return problems;
}

function tileDuplicateProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  const seen = new Set<string>();
  settings.tiles.forEach((tile, index) => {
    const key = `${tile.q},${tile.r}`;
    if (seen.has(key)) {
      problems.push(problem(
        'error',
        'tile-duplicate',
        ['tiles', index],
        `(${tile.q},${tile.r}) is used by another tile`,
        tile
      ));
    } else {
      seen.add(key);
    }
  });
  return problems;
}

function minesRangeProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (tile.unavailable === true) {
      return;
    }
    if (tile.mines > tile.maxMines) {
      problems.push(tileProblem('error', 'mines-range', index, 'mines', 'mines is above maxMines', tile));
    }
    if (tile.maxMines < 1) {
      problems.push(tileProblem('error', 'mines-range', index, 'maxMines', 'maxMines must be at least 1', tile));
    }
  });
  return problems;
}

function noOwnedTileProblems(settings: ChapterSettings): Problem[] {
  if (settings.tiles.some(tile => tile.owner === 'player')) {
    return [];
  }
  return [problem('error', 'no-owned-tile', ['tiles'], 'No tile has owner "player"')];
}

function noObjectiveProblems(settings: ChapterSettings): Problem[] {
  if (settings.tiles.some(tile => tile.objective === true)) {
    return [];
  }
  return [problem('error', 'no-objective', ['tiles'], 'No tile is an objective')];
}

function objectiveOwnedProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (tile.owner === 'player' && tile.objective === true) {
      problems.push(tileProblem(
        'error',
        'objective-owned',
        index,
        'objective',
        'An owned tile cannot be an objective',
        tile
      ));
    }
  });
  return problems;
}

function difficultyMissingProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (tile.unavailable === true) {
      return;
    }
    if (tile.owner !== 'player' && tile.difficulty === null) {
      problems.push(tileProblem(
        'error',
        'difficulty-missing',
        index,
        'difficulty',
        'A tile that is not owned needs a difficulty',
        tile
      ));
    }
  });
  return problems;
}

function ownedFieldProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (tile.owner !== 'player') {
      return;
    }
    if (tile.difficulty !== null) {
      problems.push(tileProblem('error', 'owned-field', index, 'difficulty', 'An owned tile cannot have a difficulty', tile));
    }
    if (tile.reward !== undefined) {
      problems.push(tileProblem('error', 'owned-field', index, 'reward', 'An owned tile cannot have a reward', tile));
    }
    if (tile.npcAlgorithmId !== undefined) {
      problems.push(tileProblem('error', 'owned-field', index, 'npcAlgorithmId', 'An owned tile cannot have an npcAlgorithmId', tile));
    }
    if (tile.defenderKit !== undefined) {
      problems.push(tileProblem('error', 'owned-field', index, 'defenderKit', 'An owned tile cannot have a defenderKit', tile));
    }
  });
  return problems;
}

function npcUnknownProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (tile.npcAlgorithmId === undefined) {
      return;
    }
    try {
      assertSupportedNpcAlgorithm(tile.npcAlgorithmId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown NPC algorithm';
      problems.push(tileProblem('error', 'npc-unknown', index, 'npcAlgorithmId', message, tile));
    }
  });
  return problems;
}

function entryFieldProblems(settings: ChapterSettings): Problem[] {
  const rules = settings.rules;
  const problems: Problem[] = [];
  if (rules.battleEntry === 'fee') {
    if (rules.attackFee === undefined) {
      problems.push(problem('error', 'entry-field', ['rules', 'attackFee'], 'Fee entry needs attackFee'));
    }
    if (rules.battleKit !== undefined) {
      problems.push(problem('error', 'entry-field', ['rules', 'battleKit'], 'Fee entry cannot include battleKit'));
    }
  } else {
    if (rules.battleKit === undefined) {
      problems.push(problem('error', 'entry-field', ['rules', 'battleKit'], 'Wager entry needs battleKit'));
    }
    if (rules.attackFee !== undefined) {
      problems.push(problem('error', 'entry-field', ['rules', 'attackFee'], 'Wager entry cannot include attackFee'));
    }
  }
  return problems;
}

function priceZeroProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  for (const key of ITEM_KEYS) {
    const price = settings.rules.marketplace[key];
    if (price !== undefined && price < 1) {
      problems.push(problem(
        'error',
        'price-zero',
        ['rules', 'marketplace', key],
        'Marketplace price must be at least 1'
      ));
    }
  }
  return problems;
}

function actionPointsZeroProblems(settings: ChapterSettings): Problem[] {
  if (settings.rules.actionPointsPerTurn >= 1) {
    return [];
  }
  return [problem(
    'error',
    'action-points-zero',
    ['rules', 'actionPointsPerTurn'],
    'actionPointsPerTurn must be at least 1'
  )];
}

function versionUnchangedProblems(settings: ChapterSettings, baseline: ChapterSettings | undefined): Problem[] {
  if (!baseline || baseline.rulesetVersion !== settings.rulesetVersion) {
    return [];
  }
  if (comparable(settings) === comparable(baseline)) {
    return [];
  }
  return [problem(
    'warning',
    'version-unchanged',
    ['rulesetVersion'],
    'Rules changed and rulesetVersion did not. Best score keeps the highest total over all versions.'
  )];
}

function objectiveManyProblems(settings: ChapterSettings): Problem[] {
  const indexes = settings.tiles.flatMap((tile, index) => tile.objective === true ? [index] : []);
  return indexes.slice(1).map(index => tileProblem(
    'warning',
    'objective-many',
    index,
    'objective',
    'More than one tile is an objective',
    settings.tiles[index]
  ));
}

function actionPointsManyProblems(settings: ChapterSettings): Problem[] {
  if (settings.rules.actionPointsPerTurn <= 1) {
    return [];
  }
  return [problem(
    'warning',
    'action-points-many',
    ['rules', 'actionPointsPerTurn'],
    'More than one action point a turn is outside this release'
  )];
}

function economyPointProblems(settings: ChapterSettings): Problem[] {
  if (!settings.rules.economyConsumesActionPoint) {
    return [];
  }
  return [problem(
    'warning',
    'economy-point',
    ['rules', 'economyConsumesActionPoint'],
    'Economy actions spend the action point'
  )];
}

function neighborHiddenProblems(settings: ChapterSettings): Problem[] {
  const hidden = new Set<number>();
  for (const tile of settings.tiles) {
    if (tile.owner !== 'player') {
      continue;
    }
    for (const neighbor of neighborsOnMap(tile.q, tile.r)) {
      settings.tiles.forEach((other, index) => {
        if (other.q === neighbor.q && other.r === neighbor.r && !other.revealed) {
          hidden.add(index);
        }
      });
    }
  }
  return [...hidden].sort((left, right) => left - right).map(index => tileProblem(
    'warning',
    'neighbor-hidden',
    index,
    'revealed',
    'A neighbor of an owned tile is hidden',
    settings.tiles[index]
  ));
}

function ownsCell(settings: ChapterSettings, q: number, r: number): boolean {
  return settings.tiles.some(tile => tile.owner === 'player' && tile.q === q && tile.r === r);
}

function objectiveAdjacentProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (tile.objective !== true) {
      return;
    }
    const adjacent = neighborsOnMap(tile.q, tile.r).some(neighbor => ownsCell(settings, neighbor.q, neighbor.r));
    if (adjacent) {
      problems.push(tileProblem(
        'warning',
        'objective-adjacent',
        index,
        'objective',
        'An objective is next to an owned tile',
        tile
      ));
    }
  });
  return problems;
}

function labelDuplicateProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  const seen = new Set<string>();
  settings.tiles.forEach((tile, index) => {
    const label = tile.label ?? '';
    if (label.length === 0) {
      return;
    }
    if (seen.has(label)) {
      problems.push(tileProblem('warning', 'label-duplicate', index, 'label', `Label "${label}" is already used`, tile));
    } else {
      seen.add(label);
    }
  });
  return problems;
}

function feeUnaffordableProblems(settings: ChapterSettings): Problem[] {
  const fee = settings.rules.attackFee;
  if (settings.rules.battleEntry !== 'fee' || fee === undefined || fee <= affordableCopper(settings)) {
    return [];
  }
  return [problem(
    'warning',
    'fee-unaffordable',
    ['rules', 'attackFee'],
    'attackFee is above starting copper plus one turn of income'
  )];
}

function objectiveStashProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (tile.objective === true && tile.stash !== undefined) {
      problems.push(tileProblem(
        'warning',
        'objective-stash',
        index,
        'stash',
        'A stash on an objective is never searched',
        tile
      ));
    }
  });
  return problems;
}

function rewardEmptyProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (tile.owner === 'player' || tile.reward !== undefined) {
      return;
    }
    if (tile.difficulty === 'normal' || tile.difficulty === 'hard') {
      problems.push(tileProblem(
        'warning',
        'reward-empty',
        index,
        'reward',
        'A normal or hard tile has no reward',
        tile
      ));
    }
  });
  return problems;
}

function minesZeroProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (tile.unavailable === true || tile.mines !== 0) {
      return;
    }
    const message = tile.owner === 'player' ? 'This owned tile has no mines' : 'This tile has no mines';
    problems.push(tileProblem('warning', 'mines-zero', index, 'mines', message, tile));
  });
  return problems;
}

function digNetProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (tile.product !== 'copper' || tile.mines < 1) {
      return;
    }
    const net = DIG_TURNS * tile.mines * unitFor('copper') - settings.rules.digCost;
    if (net <= 0) {
      problems.push(tileProblem(
        'warning',
        'dig-net',
        index,
        'mines',
        'Digging this copper tile nets no copper',
        tile
      ));
    }
  });
  return problems;
}

function kitSizeProblemsFor(
  stack: ItemStack,
  difficulty: LadderDifficulty,
  kits: ChapterSettings['defenderKits'],
  path: (string | number)[],
  tile: { q: number; r: number }
): Problem[] {
  const problems: Problem[] = [];
  const total = itemTotal(stack);
  const rung = DIFFICULTY_LADDER.indexOf(difficulty);
  const next = rung < DIFFICULTY_LADDER.length - 1 ? kits[DIFFICULTY_LADDER[rung + 1]] : undefined;
  const previous = rung > 0 ? kits[DIFFICULTY_LADDER[rung - 1]] : undefined;
  if (next && total > itemTotal(next)) {
    problems.push(problem('warning', 'kit-size', path, 'Kit total is above the next difficulty', tile));
  }
  if (previous && total < itemTotal(previous)) {
    problems.push(problem('warning', 'kit-size', path, 'Kit total is below the previous difficulty', tile));
  }
  return problems;
}

function kitSizeProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (!tile.defenderKit || tile.difficulty === null) {
      return;
    }
    problems.push(...kitSizeProblemsFor(
      tile.defenderKit,
      tile.difficulty,
      settings.defenderKits,
      ['tiles', index, 'defenderKit'],
      tile
    ));
  });
  return problems;
}

function unavailableProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (tile.unavailable !== true) {
      return;
    }
    if (tile.owner === 'player') {
      problems.push(tileProblem(
        'error',
        'unavailable-owned',
        index,
        'owner',
        'An unavailable tile cannot be owned',
        tile
      ));
    }
    if (tile.objective === true) {
      problems.push(tileProblem(
        'error',
        'unavailable-objective',
        index,
        'objective',
        'An unavailable tile cannot be an objective',
        tile
      ));
    }
    if (tile.difficulty !== null) {
      problems.push(tileProblem(
        'error',
        'unavailable-field',
        index,
        'difficulty',
        'An unavailable tile cannot have a difficulty',
        tile
      ));
    }
    if (tile.reward !== undefined) {
      problems.push(tileProblem(
        'error',
        'unavailable-field',
        index,
        'reward',
        'An unavailable tile cannot have a reward',
        tile
      ));
    }
    if (tile.stash !== undefined) {
      problems.push(tileProblem(
        'error',
        'unavailable-field',
        index,
        'stash',
        'An unavailable tile cannot have a stash',
        tile
      ));
    }
    if (tile.defenderKit !== undefined) {
      problems.push(tileProblem(
        'error',
        'unavailable-field',
        index,
        'defenderKit',
        'An unavailable tile cannot have a defenderKit',
        tile
      ));
    }
    if (tile.npcAlgorithmId !== undefined) {
      problems.push(tileProblem(
        'error',
        'unavailable-field',
        index,
        'npcAlgorithmId',
        'An unavailable tile cannot have an npcAlgorithmId',
        tile
      ));
    }
    if (tile.mines !== 0) {
      problems.push(tileProblem(
        'error',
        'unavailable-mines',
        index,
        'mines',
        'An unavailable tile has no mines',
        tile
      ));
    }
    if (tile.maxMines !== 0) {
      problems.push(tileProblem(
        'error',
        'unavailable-mines',
        index,
        'maxMines',
        'An unavailable tile has no mines',
        tile
      ));
    }
  });
  return problems;
}

/** Owned tiles, then every capturable neighbor. An unavailable hex is not entered. */
function capturableReach(settings: ChapterSettings): Set<string> {
  const byKey = new Map<string, TileSettings>();
  for (const tile of settings.tiles) {
    const key = `${tile.q},${tile.r}`;
    if (!byKey.has(key)) byKey.set(key, tile);
  }
  const reached = new Set<string>();
  const queue: string[] = [];
  for (const tile of settings.tiles) {
    if (tile.owner !== 'player' || tile.unavailable === true) continue;
    const key = `${tile.q},${tile.r}`;
    if (reached.has(key)) continue;
    reached.add(key);
    queue.push(key);
  }
  let cursor = 0;
  while (cursor < queue.length) {
    const key = queue[cursor];
    cursor += 1;
    if (key === undefined) continue;
    const tile = byKey.get(key);
    if (!tile) continue;
    for (const neighbor of neighborsOnMap(tile.q, tile.r)) {
      const next = `${neighbor.q},${neighbor.r}`;
      if (reached.has(next)) continue;
      const other = byKey.get(next);
      if (!other || other.unavailable === true) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

function objectiveSealedProblems(settings: ChapterSettings): Problem[] {
  const reached = capturableReach(settings);
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (!onMap(tile.q, tile.r) || tile.objective !== true || reached.has(`${tile.q},${tile.r}`)) {
      return;
    }
    problems.push(tileProblem(
      'warning',
      'objective-sealed',
      index,
      'objective',
      'No capturable path reaches this objective',
      tile
    ));
  });
  return problems;
}

function tileSealedProblems(settings: ChapterSettings): Problem[] {
  const reached = capturableReach(settings);
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (!onMap(tile.q, tile.r) || tile.unavailable === true || tile.owner === 'player' || reached.has(`${tile.q},${tile.r}`)) {
      return;
    }
    problems.push(tileProblem(
      'warning',
      'tile-sealed',
      index,
      'difficulty',
      'No capturable path reaches this tile',
      tile
    ));
  });
  return problems;
}

function kitNoGesturesProblems(settings: ChapterSettings): Problem[] {
  const problems: Problem[] = [];
  settings.tiles.forEach((tile, index) => {
    if (!tile.defenderKit || hasGestures(tile.defenderKit)) {
      return;
    }
    problems.push(tileProblem(
      'warning',
      'kit-no-gestures',
      index,
      'defenderKit',
      'Kit has no stones, scissors, or papers',
      tile
    ));
  });
  return problems;
}

export function checkChapterSettings(
  settings: ChapterSettings,
  options?: { baseline?: ChapterSettings }
): Problem[] {
  return [
    ...tileCountProblems(settings),
    ...tileOffMapProblems(settings),
    ...tileDuplicateProblems(settings),
    ...minesRangeProblems(settings),
    ...noOwnedTileProblems(settings),
    ...noObjectiveProblems(settings),
    ...objectiveOwnedProblems(settings),
    ...difficultyMissingProblems(settings),
    ...ownedFieldProblems(settings),
    ...unavailableProblems(settings),
    ...npcUnknownProblems(settings),
    ...entryFieldProblems(settings),
    ...priceZeroProblems(settings),
    ...actionPointsZeroProblems(settings),
    ...versionUnchangedProblems(settings, options?.baseline),
    ...objectiveManyProblems(settings),
    ...actionPointsManyProblems(settings),
    ...economyPointProblems(settings),
    ...neighborHiddenProblems(settings),
    ...objectiveAdjacentProblems(settings),
    ...objectiveSealedProblems(settings),
    ...tileSealedProblems(settings),
    ...labelDuplicateProblems(settings),
    ...feeUnaffordableProblems(settings),
    ...objectiveStashProblems(settings),
    ...rewardEmptyProblems(settings),
    ...minesZeroProblems(settings),
    ...digNetProblems(settings),
    ...kitSizeProblems(settings),
    ...kitNoGesturesProblems(settings)
  ];
}

export function chapterErrors(problems: Problem[]): Problem[] {
  return problems.filter(item => item.level === 'error');
}
