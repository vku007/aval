import type { CurrencyStack, ItemStack } from '@apiv2/domain/campaign/CampaignInventory.js';
import type {
  ChapterSettings,
  RewardSettings,
  TileSettings
} from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import type { InventoryItemKey } from '@apiv2/domain/value-object/GamePlayerInventory.js';

export type Cell = { q: number; r: number };

export type TabId = 'tile' | 'chapter' | 'rules' | 'inventory' | 'rewards' | 'routes' | 'problems';

export type Brush =
  | { field: 'difficulty'; value: 'easy' | 'normal' | 'hard' }
  | { field: 'product'; value: 'stones' | 'scissors' | 'papers' | 'copper' }
  | { field: 'revealed'; value: boolean }
  | { field: 'kit'; value: 'default' }
  | { field: 'unavailable' };

export type StackPath =
  | ['startingInventory']
  | ['rules', 'battleKit']
  | ['defenderKits', 'easy' | 'normal' | 'hard']
  | ['easyRewards', 'stones' | 'scissors' | 'papers' | 'copper'];

/** Stored on the document. `walk.ts` re-exports these and runs the steps. */
export type RouteStep =
  | { type: 'attack'; q: number; r: number; result?: 'win' | 'loss' }
  | { type: 'search' | 'dig' | 'upgrade'; q: number; r: number }
  | { type: 'buy'; item: InventoryItemKey; amount: number }
  | { type: 'end_turn' };

export interface Route {
  name: string;
  steps: RouteStep[];
}

type OwnerSnapshot = Pick<TileSettings, 'difficulty' | 'npcAlgorithmId' | 'reward' | 'defenderKit'>;

export interface EditorState {
  doc: ChapterSettings;
  baseline: ChapterSettings;
  sourceName: string;
  selection: Cell[];
  tab: TabId;
  brush: Brush | null;
  overlay: 'design' | 'start';
  routes: Route[];
  ownerMemory: Record<string, OwnerSnapshot>;
}

type TilePatch = Partial<
  Pick<
    TileSettings,
    'label' | 'product' | 'mines' | 'maxMines' | 'difficulty' | 'revealed' | 'objective' | 'npcAlgorithmId'
  >
>;

export type DocAction =
  | { type: 'setChapter'; patch: Partial<Pick<ChapterSettings, 'title' | 'goal' | 'rulesetVersion'>> }
  | {
      type: 'setRules';
      patch: Partial<
        Omit<ChapterSettings['rules'], 'marketplace' | 'battleKit' | 'attackFee' | 'battleEntry'>
      >;
    }
  | { type: 'setBattleEntry'; entry: 'fee' | 'wager' }
  | { type: 'setAttackFee'; fee: number }
  | { type: 'setMarketplaceItem'; item: InventoryItemKey; price: number | null }
  | { type: 'setStack'; path: StackPath; items: ItemStack; currencies?: CurrencyStack }
  | { type: 'setRounds'; difficulty: 'easy' | 'normal' | 'hard'; rounds: 'BO5' | 'BO7' }
  | { type: 'setTiles'; cells: Cell[]; patch: TilePatch }
  | { type: 'setOwner'; cells: Cell[]; owner: 'player' | 'neutral' }
  | { type: 'setUnavailable'; cells: Cell[]; unavailable: boolean }
  | { type: 'setReward'; cells: Cell[]; reward: RewardSettings | null }
  | { type: 'setKit'; cells: Cell[]; kit: ItemStack | 'copy-difficulty' | null }
  | { type: 'setStash'; cells: Cell[]; stash: RewardSettings | null };

export type UiAction =
  | { type: 'load'; doc: ChapterSettings; sourceName: string }
  | { type: 'select'; cells: Cell[]; additive?: boolean }
  | { type: 'setTab'; tab: TabId }
  | { type: 'setBrush'; brush: Brush | null }
  | { type: 'setOverlay'; overlay: 'design' | 'start' }
  | { type: 'setRoutes'; routes: Route[] };

export function cellKey(cell: Cell): string {
  return `${cell.q},${cell.r}`;
}

export function createEditorState(doc: ChapterSettings, sourceName: string): EditorState {
  const copy = structuredClone(doc);
  return {
    doc: copy,
    baseline: structuredClone(copy),
    sourceName,
    selection: [],
    tab: 'tile',
    brush: null,
    overlay: 'design',
    routes: [],
    ownerMemory: {}
  };
}

export function reduce(state: EditorState, action: DocAction | UiAction): EditorState {
  switch (action.type) {
    case 'setChapter':
      return { ...state, doc: assignDefined(state.doc, action.patch) };
    case 'setRules':
      return { ...state, doc: { ...state.doc, rules: applyRulesPatch(state.doc.rules, action.patch) } };
    case 'setBattleEntry':
      return { ...state, doc: { ...state.doc, rules: applyBattleEntry(state.doc.rules, action.entry) } };
    case 'setAttackFee':
      return { ...state, doc: { ...state.doc, rules: { ...state.doc.rules, attackFee: action.fee } } };
    case 'setMarketplaceItem':
      return { ...state, doc: setMarketplaceItem(state.doc, action.item, action.price) };
    case 'setStack':
      return { ...state, doc: applyStack(state.doc, action.path, action.items, action.currencies) };
    case 'setRounds':
      return {
        ...state,
        doc: {
          ...state.doc,
          rounds: { ...state.doc.rounds, [action.difficulty]: action.rounds }
        }
      };
    case 'setTiles':
      return { ...state, doc: editTiles(state.doc, action.cells, tile => applyTilePatch(tile, action.patch)) };
    case 'setOwner':
      return setOwner(state, action.cells, action.owner);
    case 'setUnavailable':
      return {
        ...state,
        doc: editTiles(state.doc, action.cells, tile =>
          action.unavailable ? asUnavailable(tile) : asAvailable(tile)
        )
      };
    case 'setReward':
      return {
        ...state,
        doc: editTiles(state.doc, action.cells, tile =>
          action.reward === null ? omit(tile, 'reward') : { ...tile, reward: cloneReward(action.reward) }
        )
      };
    case 'setKit':
      return { ...state, doc: editTiles(state.doc, action.cells, tile => applyKit(state.doc, tile, action.kit)) };
    case 'setStash':
      return {
        ...state,
        doc: editTiles(state.doc, action.cells, tile =>
          action.stash === null ? omit(tile, 'stash') : { ...tile, stash: cloneReward(action.stash) }
        )
      };
    case 'load': {
      const doc = structuredClone(action.doc);
      return {
        ...state,
        doc,
        baseline: structuredClone(doc),
        sourceName: action.sourceName,
        ownerMemory: {}
      };
    }
    case 'select':
      return { ...state, selection: selectCells(state.selection, action.cells, action.additive === true) };
    case 'setTab':
      return { ...state, tab: action.tab };
    case 'setBrush':
      return { ...state, brush: action.brush };
    case 'setOverlay':
      return { ...state, overlay: action.overlay };
    case 'setRoutes':
      return { ...state, routes: cloneRoutes(action.routes) };
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

function assignDefined<T extends object>(target: T, patch: Partial<NoInfer<T>>): T {
  const next = { ...target };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (value !== undefined) next[key] = value;
  }
  return next;
}

function applyRulesPatch(
  rules: ChapterSettings['rules'],
  patch: Partial<Omit<ChapterSettings['rules'], 'marketplace' | 'battleKit' | 'attackFee' | 'battleEntry'>>
): ChapterSettings['rules'] {
  const next = assignDefined(rules, patch);
  if (patch.scoreWeights) next.scoreWeights = { ...patch.scoreWeights };
  return next;
}

function applyBattleEntry(rules: ChapterSettings['rules'], entry: 'fee' | 'wager'): ChapterSettings['rules'] {
  if (entry === 'fee') {
    const attackFee = rules.battleEntry === 'fee' ? rules.attackFee ?? 10 : 10;
    const next = { ...rules, battleEntry: 'fee' as const, attackFee };
    delete next.battleKit;
    return next;
  }
  const battleKit = rules.battleEntry === 'wager' ? { ...rules.battleKit } : {};
  const next = { ...rules, battleEntry: 'wager' as const, battleKit };
  delete next.attackFee;
  return next;
}

function setMarketplaceItem(
  doc: ChapterSettings,
  item: InventoryItemKey,
  price: number | null
): ChapterSettings {
  const marketplace = { ...doc.rules.marketplace };
  if (price === null) delete marketplace[item];
  else marketplace[item] = price;
  return { ...doc, rules: { ...doc.rules, marketplace } };
}

function applyStack(
  doc: ChapterSettings,
  path: StackPath,
  items: ItemStack,
  currencies?: CurrencyStack
): ChapterSettings {
  const copiedItems = { ...items };
  if (path[0] === 'startingInventory') {
    return {
      ...doc,
      startingInventory: {
        items: copiedItems,
        currencies: { ...(currencies ?? doc.startingInventory.currencies) }
      }
    };
  }
  if (path[0] === 'rules') {
    return { ...doc, rules: { ...doc.rules, battleKit: copiedItems } };
  }
  if (path[0] === 'defenderKits') {
    return { ...doc, defenderKits: { ...doc.defenderKits, [path[1]]: copiedItems } };
  }
  const product = path[1];
  return {
    ...doc,
    easyRewards: {
      ...doc.easyRewards,
      [product]: {
        items: copiedItems,
        currencies: { ...(currencies ?? doc.easyRewards[product].currencies) }
      }
    }
  };
}

function editTiles(
  doc: ChapterSettings,
  cells: Cell[],
  edit: (tile: TileSettings) => TileSettings
): ChapterSettings {
  const wanted = new Set(cells.map(cellKey));
  return {
    ...doc,
    tiles: doc.tiles.map(tile => (wanted.has(cellKey(tile)) ? edit(tile) : tile))
  };
}

function applyTilePatch(tile: TileSettings, patch: TilePatch): TileSettings {
  const next: TileSettings = { ...tile };
  if (patch.label !== undefined) next.label = patch.label;
  if (patch.product !== undefined) next.product = patch.product;
  if (patch.mines !== undefined) next.mines = patch.mines;
  if (patch.maxMines !== undefined) next.maxMines = patch.maxMines;
  if (patch.difficulty !== undefined) next.difficulty = patch.difficulty;
  if (patch.revealed !== undefined) next.revealed = patch.revealed;
  if (patch.objective !== undefined) next.objective = patch.objective;
  if (patch.npcAlgorithmId !== undefined) next.npcAlgorithmId = patch.npcAlgorithmId;
  return next;
}

function setOwner(state: EditorState, cells: Cell[], owner: 'player' | 'neutral'): EditorState {
  const wanted = new Set(cells.map(cellKey));
  let ownerMemory = state.ownerMemory;
  const tiles = state.doc.tiles.map(tile => {
    if (!wanted.has(cellKey(tile))) return tile;
    if (owner === 'player') {
      if (tile.owner === 'player') return tile;
      if (ownerMemory === state.ownerMemory) ownerMemory = { ...ownerMemory };
      ownerMemory[cellKey(tile)] = snapshot(tile);
      return asPlayer(tile);
    }
    if (tile.owner !== 'player') return tile;
    return asNeutral(tile, ownerMemory[cellKey(tile)]);
  });
  return { ...state, ownerMemory, doc: { ...state.doc, tiles } };
}

function snapshot(tile: TileSettings): OwnerSnapshot {
  const saved: OwnerSnapshot = { difficulty: tile.difficulty };
  if (tile.npcAlgorithmId !== undefined) saved.npcAlgorithmId = tile.npcAlgorithmId;
  if (tile.reward) saved.reward = cloneReward(tile.reward);
  if (tile.defenderKit) saved.defenderKit = { ...tile.defenderKit };
  return saved;
}

function asUnavailable(tile: TileSettings): TileSettings {
  const next: TileSettings = {
    q: tile.q,
    r: tile.r,
    product: tile.product,
    mines: 0,
    maxMines: 0,
    difficulty: null,
    revealed: tile.revealed,
    unavailable: true
  };
  if (tile.label !== undefined) next.label = tile.label;
  return next;
}

function asAvailable(tile: TileSettings): TileSettings {
  const next: TileSettings = {
    q: tile.q,
    r: tile.r,
    product: tile.product,
    mines: 1,
    maxMines: 1,
    difficulty: 'easy',
    revealed: tile.revealed
  };
  if (tile.label !== undefined) next.label = tile.label;
  return next;
}

function asPlayer(tile: TileSettings): TileSettings {
  const next: TileSettings = {
    q: tile.q,
    r: tile.r,
    product: tile.product,
    mines: tile.mines,
    maxMines: tile.maxMines,
    difficulty: null,
    revealed: tile.revealed,
    owner: 'player'
  };
  if (tile.label !== undefined) next.label = tile.label;
  if (tile.stash) next.stash = cloneReward(tile.stash);
  return next;
}

function asNeutral(tile: TileSettings, saved: OwnerSnapshot | undefined): TileSettings {
  const next: TileSettings = {
    q: tile.q,
    r: tile.r,
    product: tile.product,
    mines: tile.mines,
    maxMines: tile.maxMines,
    difficulty: saved ? saved.difficulty : 'easy',
    revealed: tile.revealed
  };
  if (tile.label !== undefined) next.label = tile.label;
  if (tile.objective !== undefined) next.objective = tile.objective;
  if (tile.stash) next.stash = cloneReward(tile.stash);
  if (!saved) return next;
  if (saved.npcAlgorithmId !== undefined) next.npcAlgorithmId = saved.npcAlgorithmId;
  if (saved.reward) next.reward = cloneReward(saved.reward);
  if (saved.defenderKit) next.defenderKit = { ...saved.defenderKit };
  return next;
}

function applyKit(doc: ChapterSettings, tile: TileSettings, kit: ItemStack | 'copy-difficulty' | null): TileSettings {
  if (kit === null) return omit(tile, 'defenderKit');
  if (kit === 'copy-difficulty') {
    if (tile.difficulty === null) return tile;
    return { ...tile, defenderKit: { ...doc.defenderKits[tile.difficulty] } };
  }
  return { ...tile, defenderKit: { ...kit } };
}

function omit(tile: TileSettings, key: 'reward' | 'defenderKit' | 'stash'): TileSettings {
  if (tile[key] === undefined) return tile;
  const next = { ...tile };
  delete next[key];
  return next;
}

function cloneReward(reward: RewardSettings): RewardSettings {
  return { items: { ...reward.items }, currencies: { ...reward.currencies } };
}

function selectCells(selection: Cell[], cells: Cell[], additive: boolean): Cell[] {
  const next = additive ? selection.map(cell => ({ ...cell })) : [];
  const seen = new Set(next.map(cellKey));
  for (const cell of cells) {
    const key = cellKey(cell);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push({ q: cell.q, r: cell.r });
  }
  return next;
}

function cloneRoutes(routes: Route[]): Route[] {
  return routes.map(route => ({
    name: route.name,
    steps: route.steps.map(step => ({ ...step }))
  }));
}
