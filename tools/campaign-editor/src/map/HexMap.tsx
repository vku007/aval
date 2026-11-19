import { useMemo, useState } from 'preact/hooks';
import type { ChapterSettings, Problem, TileSettings } from '@apiv2/domain/campaign/ChapterSettingsSchema.js';
import { revealedBy, startView, type StartVisibility } from '../model/derive.js';
import { cellKey, type Cell } from '../model/document.js';
import { hexLayout, hexPoints } from './hexLayout.js';

const HEX_DRAW_SIZE = 32;

const GLYPH: Record<TileSettings['product'], string> = {
  stones: 'St',
  scissors: 'Sc',
  papers: 'Pa',
  copper: 'C'
};

export interface HexMapProps {
  settings: ChapterSettings;
  selection: Cell[];
  problems: Problem[];
  overlay: 'design' | 'start';
  hoverReveal: boolean;
  onCellClick: (cell: Cell, meta: { shift: boolean }) => void;
  onCellPointer: (cell: Cell, phase: 'down' | 'enter' | 'up') => void;
}

export function HexMap({
  settings,
  selection,
  problems,
  overlay,
  hoverReveal,
  onCellClick,
  onCellPointer
}: HexMapProps) {
  const layout = hexLayout(HEX_DRAW_SIZE);
  const tiles = indexTiles(settings);
  const visibility = overlay === 'start' ? startView(settings) : null;
  const [hovered, setHovered] = useState<string | null>(null);
  const reveal = useMemo(() => {
    if (!hoverReveal || hovered === null) return new Set<string>();
    const [q, r] = hovered.split(',').map(Number);
    return new Set(revealedBy(settings, { q: q!, r: r! }).map(cellKey));
  }, [hoverReveal, hovered, settings]);

  return (
    <svg class="hex-map" viewBox={layout.viewBox} role="group" aria-label="Map">
      <defs>
        <pattern id="hex-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#57534e" stroke-width="1.5" />
        </pattern>
      </defs>
      {layout.cells.map(cell => {
        const key = cellKey(cell);
        const at = { q: cell.q, r: cell.r };
        const tile = tiles.get(key);
        const points = hexPoints(cell.x, cell.y, layout.size);
        const outline = outlineClass(problems, at);
        const classes = ['hex-cell'];
        if (outline) classes.push(outline);
        if (selection.some(item => item.q === cell.q && item.r === cell.r)) classes.push('hex-selected');
        const marks = tile ? markers(tile) : '';
        return (
          <g
            key={key}
            data-cell={key}
            class={classes.join(' ')}
            role="button"
            tabIndex={0}
            aria-label={tile ? cellLabel(tile) : `(${cell.q},${cell.r})`}
            onClick={event => onCellClick(at, { shift: event.shiftKey })}
            onKeyDown={event => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              onCellClick(at, { shift: event.shiftKey });
            }}
            onPointerDown={() => onCellPointer(at, 'down')}
            onPointerEnter={() => {
              setHovered(key);
              onCellPointer(at, 'enter');
            }}
            onPointerUp={() => onCellPointer(at, 'up')}
            onPointerLeave={() => setHovered(current => (current === key ? null : current))}
          >
            <polygon class={`hex-shape ${fillClass(tile, overlay, visibility?.[key])}`} points={points} />
            {tile && tile.revealed === false ? <polygon class="hex-hatch" points={points} /> : null}
            {reveal.has(key) ? <polygon class="hex-reveal-ring" points={points} /> : null}
            {classes.includes('hex-selected') ? <polygon class="hex-select" points={points} /> : null}
            {tile?.objective === true ? (
              <text class="hex-star" x={cell.x} y={cell.y - layout.size * 0.38} font-size={layout.size * 0.34}>
                ★
              </text>
            ) : null}
            {tile ? (
              <text class="hex-glyph" x={cell.x} y={cell.y + layout.size * 0.02} font-size={layout.size * 0.3}>
                {`${GLYPH[tile.product]} ${tile.mines}/${tile.maxMines}`}
              </text>
            ) : null}
            {marks ? (
              <text class="hex-markers" x={cell.x} y={cell.y + layout.size * 0.4} font-size={layout.size * 0.24}>
                {marks}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function indexTiles(settings: ChapterSettings): Map<string, TileSettings> {
  const tiles = new Map<string, TileSettings>();
  for (const tile of settings.tiles) {
    const key = cellKey(tile);
    if (!tiles.has(key)) tiles.set(key, tile);
  }
  return tiles;
}

function cellLabel(tile: TileSettings): string {
  const name = tile.label ? tile.label : `(${tile.q},${tile.r})`;
  const rank = tile.owner === 'player' ? 'player' : tile.difficulty ?? 'unset';
  return `(${tile.q},${tile.r}) ${name}, ${rank}, ${tile.product} ${tile.mines}/${tile.maxMines}`;
}

function markers(tile: TileSettings): string {
  const marks: string[] = [];
  if (tile.stash) marks.push('s');
  if (tile.reward) marks.push('r');
  if (tile.defenderKit) marks.push('k');
  return marks.join(' ');
}

function fillClass(
  tile: TileSettings | undefined,
  overlay: 'design' | 'start',
  visibility: StartVisibility | undefined
): string {
  if (overlay === 'start') {
    if (visibility === 'owned') return 'hex-fill-player';
    if (visibility === 'seen') return 'hex-fill-seen';
    return 'hex-fill-hidden';
  }
  if (tile?.owner === 'player') return 'hex-fill-player';
  if (tile?.difficulty === 'easy') return 'hex-fill-easy';
  if (tile?.difficulty === 'normal') return 'hex-fill-normal';
  if (tile?.difficulty === 'hard') return 'hex-fill-hard';
  return 'hex-fill-empty';
}

function outlineClass(problems: readonly Problem[], cell: Cell): 'hex-error' | 'hex-warning' | null {
  let warning = false;
  for (const problem of problems) {
    if (problem.tile?.q !== cell.q || problem.tile?.r !== cell.r) continue;
    if (problem.level === 'error') return 'hex-error';
    warning = true;
  }
  return warning ? 'hex-warning' : null;
}
