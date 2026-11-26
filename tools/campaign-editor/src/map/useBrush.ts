import type { ItemStack } from '@apiv2/domain/campaign/CampaignInventory.js';
import { effectiveDefenderKit } from '@apiv2/domain/campaign/ChapterDefinitionBuilder.js';
import type { ChapterSettings, TileSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { useEffect, useRef } from 'preact/hooks';
import { cellKey, type Brush, type Cell, type DocAction, type UiAction } from '../model/document.js';

export type BrushDispatch = (action: DocAction, groupId?: string) => void;

interface Stroke {
  groupId: string;
  painted: Set<string>;
}

let strokeSerial = 0;

function nextStrokeId(): string {
  strokeSerial += 1;
  return `brush-${strokeSerial}`;
}

/** Click replaces the selection. Shift-click toggles one cell. `select` additive only unions, so the caller passes the next list. */
export function selectionAfterClick(selection: readonly Cell[], cell: Cell, shift: boolean): Cell[] {
  if (!shift) return [{ q: cell.q, r: cell.r }];
  const key = cellKey(cell);
  const without = selection.filter((item) => cellKey(item) !== key);
  if (without.length !== selection.length) return without.map(copyCell);
  return [...selection.map(copyCell), copyCell(cell)];
}

/**
 * One cell of a brush stroke, or null when the cell is left as it is.
 * Difficulty and kit do not paint an owned tile or a wall.
 * The unavailable brush does paint the camp: a wall cannot be owned.
 */
export function brushAction(brush: Brush, cell: Cell, tile: TileSettings | undefined): DocAction | null {
  if (!tile) return null;
  const target = copyCell(cell);
  if (brush.field === 'unavailable') {
    if (tile.unavailable === true) return null;
    return { type: 'setUnavailable', cells: [target], unavailable: true };
  }
  if (brush.field === 'difficulty') {
    if (tile.owner === 'player' || tile.unavailable === true || tile.difficulty === brush.value) return null;
    return { type: 'setTiles', cells: [target], patch: { difficulty: brush.value } };
  }
  if (brush.field === 'product') {
    if (tile.product === brush.value) return null;
    return { type: 'setTiles', cells: [target], patch: { product: brush.value } };
  }
  if (brush.field === 'revealed') {
    if (tile.revealed === brush.value) return null;
    return { type: 'setTiles', cells: [target], patch: { revealed: brush.value } };
  }
  if (tile.owner === 'player' || tile.unavailable === true || tile.defenderKit === undefined) return null;
  return { type: 'setKit', cells: [target], kit: null };
}

/**
 * Neutral cells in a multi-selection, and the effective kit of the first of them.
 * Owned cells are omitted: a kit on an owned tile is an error.
 */
export function kitForSelection(
  settings: ChapterSettings,
  selection: readonly Cell[]
): { cells: Cell[]; kit: ItemStack } | null {
  if (selection.length < 2) return null;
  const seen = new Set<string>();
  const neutral: TileSettings[] = [];
  for (const cell of selection) {
    const key = cellKey(cell);
    if (seen.has(key)) continue;
    seen.add(key);
    const tile = settings.tiles.find((item) => item.q === cell.q && item.r === cell.r);
    if (tile && tile.owner !== 'player') neutral.push(tile);
  }
  const source = neutral[0];
  if (!source) return null;
  return {
    cells: neutral.map(copyCell),
    kit: { ...effectiveDefenderKit(settings, source) }
  };
}

/**
 * Paints `brush` across a pointer drag. Pointer down opens one history group;
 * pointer up, including a release outside the map, drops it so the next edit is its own undo step.
 */
export function useBrush(
  brush: Brush | null,
  tiles: readonly TileSettings[],
  dispatch: BrushDispatch
): (cell: Cell, phase: 'down' | 'enter' | 'up') => void {
  const brushRef = useRef(brush);
  const tilesRef = useRef(tiles);
  const dispatchRef = useRef(dispatch);
  const stroke = useRef<Stroke | null>(null);
  brushRef.current = brush;
  tilesRef.current = tiles;
  dispatchRef.current = dispatch;

  useEffect(() => {
    const end = () => {
      stroke.current = null;
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  return (cell, phase) => {
    if (phase === 'up') {
      stroke.current = null;
      return;
    }
    if (phase === 'down') {
      if (!brushRef.current) {
        stroke.current = null;
        return;
      }
      stroke.current = { groupId: nextStrokeId(), painted: new Set() };
    }
    const active = stroke.current;
    const current = brushRef.current;
    if (!active || !current) return;
    const key = cellKey(cell);
    if (active.painted.has(key)) return;
    active.painted.add(key);
    const tile = tilesRef.current.find((item) => item.q === cell.q && item.r === cell.r);
    const action = brushAction(current, cell, tile);
    if (!action) return;
    dispatchRef.current(action, active.groupId);
  };
}

/** Escape clears the selection. A field keeps the key so it can cancel its own edit. */
export function useClearSelectionOnEscape(dispatch: (action: UiAction) => void): void {
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isFieldTarget(event.target)) return;
      dispatchRef.current({ type: 'select', cells: [] });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function isFieldTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function copyCell(cell: Cell): Cell {
  return { q: cell.q, r: cell.r };
}
