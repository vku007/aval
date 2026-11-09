/**
 * Flat-top axial hex for a radius-2 map. Classic global: CampaignHex.
 * y grows downward. North is q = 0, r = -1.
 */
const CampaignHex = {
  RADIUS: 2,

  NEIGHBORS: [
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
    { q: 1, r: 0 }
  ],

  onMap(q, r) {
    return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= this.RADIUS;
  },

  center(q, r, size) {
    return {
      x: size * 3 / 2 * q,
      y: size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r)
    };
  },

  isNeighbor(a, b) {
    if (!a || !b) return false;
    const dq = b.q - a.q;
    const dr = b.r - a.r;
    return this.NEIGHBORS.some((step) => step.q === dq && step.r === dr);
  },

  adjacentToOwned(tile, tiles) {
    if (!tile || tile.visibility !== 'seen') return false;
    return (tiles || []).some((other) => other && other.visibility === 'owned' && this.isNeighbor(tile, other));
  },

  mark(tile) {
    if (!tile || tile.visibility === 'hidden' || tile.visibility === 'blocked') return '';
    if (tile.visibility === 'seen') {
      const letter = tile.difficulty === 'easy'
        ? 'E'
        : tile.difficulty === 'normal'
          ? 'N'
          : tile.difficulty === 'hard'
            ? 'H'
            : '';
      return tile.objective ? `${letter}*` : letter;
    }
    if (tile.visibility === 'owned') {
      const product = tile.income && tile.income.product;
      const abbr = product === 'stones'
        ? 'St'
        : product === 'scissors'
          ? 'Sc'
          : product === 'papers'
            ? 'Pa'
            : product === 'copper'
              ? 'C'
              : '';
      return `${abbr} ${tile.mines}/${tile.maxMines}`.trim();
    }
    return '';
  },

  localPoints(size) {
    const points = [];
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 180) * (60 * i);
      points.push(size * Math.cos(angle), size * Math.sin(angle));
    }
    return points;
  },

  layout(tiles, maxWidth, maxHeight) {
    const list = tiles || [];
    if (!list.length || maxWidth <= 0 || maxHeight <= 0) {
      return { size: 0, minX: 0, minY: 0, width: 0, height: 0 };
    }
    const unit = list.map((tile) => this.center(tile.q, tile.r, 1));
    const minX = Math.min(...unit.map((point) => point.x)) - 1;
    const maxX = Math.max(...unit.map((point) => point.x)) + 1;
    const minY = Math.min(...unit.map((point) => point.y)) - 1;
    const maxY = Math.max(...unit.map((point) => point.y)) + 1;
    const size = Math.min(maxWidth / (maxX - minX), maxHeight / (maxY - minY));
    return {
      size,
      minX: minX * size,
      minY: minY * size,
      width: (maxX - minX) * size,
      height: (maxY - minY) * size
    };
  }
};

this.CampaignHex = CampaignHex;
