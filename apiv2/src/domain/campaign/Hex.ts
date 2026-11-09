export interface Axial {
  q: number;
  r: number;
}

/** Chapter I hex radius. A cell is on the map when max(|q|, |r|, |q+r|) <= 2. */
export const HEX_RADIUS = 2;

/** Flat-top neighbor steps. One of them is due north. */
export const NEIGHBOR_DELTAS: readonly Axial[] = [
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
  { q: 1, r: 0 }
];

export function onMap(q: number, r: number, radius = HEX_RADIUS): boolean {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= radius;
}

export function sameAxial(a: Axial, b: Axial): boolean {
  return a.q === b.q && a.r === b.r;
}

/** Aligned means sharing a side. A square diagonal is not a neighbor. */
export function aligned(a: Axial, b: Axial): boolean {
  return NEIGHBOR_DELTAS.some(step => a.q + step.q === b.q && a.r + step.r === b.r);
}

export function neighborsOnMap(q: number, r: number, radius = HEX_RADIUS): Axial[] {
  return NEIGHBOR_DELTAS
    .map(step => ({ q: q + step.q, r: r + step.r }))
    .filter(cell => onMap(cell.q, cell.r, radius));
}
