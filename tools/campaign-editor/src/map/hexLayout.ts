import { HEX_RADIUS, onMap } from '@apiv2/domain/campaign/Hex.js';

const SQRT3 = Math.sqrt(3);

export interface HexLayoutCell {
  q: number;
  r: number;
  x: number;
  y: number;
}

export interface HexLayout {
  size: number;
  viewBox: string;
  cells: HexLayoutCell[];
}

/** Flat-top: a vertex sits on the right, so the top and bottom are edges. y grows downward. */
export function hexPoints(cx: number, cy: number, size: number): string {
  const coords: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i);
    coords.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return coords.join(' ');
}

/**
 * Centers for the radius-2 map.
 * `x = size * 3/2 * q`, `y = size * (√3/2 * q + √3 * r)`.
 * The viewBox contains every hex plus `padding` (default `0.35 * size`) so a stroke is not clipped.
 */
export function hexLayout(size: number, padding = size * 0.35): HexLayout {
  const cells: HexLayoutCell[] = [];
  for (let q = -HEX_RADIUS; q <= HEX_RADIUS; q += 1) {
    for (let r = -HEX_RADIUS; r <= HEX_RADIUS; r += 1) {
      if (!onMap(q, r)) continue;
      cells.push({
        q,
        r,
        x: size * (3 / 2) * q,
        y: size * ((SQRT3 / 2) * q + SQRT3 * r)
      });
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const halfHeight = (SQRT3 / 2) * size;
  for (const cell of cells) {
    minX = Math.min(minX, cell.x - size);
    maxX = Math.max(maxX, cell.x + size);
    minY = Math.min(minY, cell.y - halfHeight);
    maxY = Math.max(maxY, cell.y + halfHeight);
  }

  return {
    size,
    viewBox: `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`,
    cells
  };
}
