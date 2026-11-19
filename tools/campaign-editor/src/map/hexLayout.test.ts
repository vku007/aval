import { describe, expect, it } from 'vitest';
import { hexLayout, hexPoints } from './hexLayout.js';

describe('hexLayout', () => {
  it('places (0,-2) above (0,0)', () => {
    const layout = hexLayout(30);
    const top = layout.cells.find(cell => cell.q === 0 && cell.r === -2);
    const origin = layout.cells.find(cell => cell.q === 0 && cell.r === 0);
    expect(top).toBeDefined();
    expect(origin).toBeDefined();
    expect(top!.x).toBe(0);
    expect(origin!.x).toBe(0);
    expect(origin!.y).toBe(0);
    expect(top!.y).toBeCloseTo(30 * Math.sqrt(3) * -2);
    expect(top!.y).toBeLessThan(origin!.y);
  });

  it('covers the radius-2 map and pads the viewBox past every vertex', () => {
    const size = 20;
    const layout = hexLayout(size);
    expect(layout.cells).toHaveLength(19);
    expect(new Set(layout.cells.map(cell => `${cell.q},${cell.r}`)).size).toBe(19);
    expect(layout.cells.some(cell => cell.q === 3)).toBe(false);

    const [minX, minY, width, height] = layout.viewBox.split(' ').map(Number);
    const maxX = minX + width;
    const maxY = minY + height;
    const halfHeight = (Math.sqrt(3) / 2) * size;
    for (const cell of layout.cells) {
      expect(cell.x - size).toBeGreaterThan(minX);
      expect(cell.x + size).toBeLessThan(maxX);
      expect(cell.y - halfHeight).toBeGreaterThan(minY);
      expect(cell.y + halfHeight).toBeLessThan(maxY);
    }
  });
});

describe('hexPoints', () => {
  it('draws a flat-top hexagon', () => {
    const pairs = hexPoints(0, 0, 10)
      .split(' ')
      .map(pair => pair.split(',').map(Number));
    expect(pairs).toHaveLength(6);
    const minY = Math.min(...pairs.map(pair => pair[1]!));
    const top = pairs.filter(pair => Math.abs(pair[1]! - minY) < 1e-9);
    expect(top).toHaveLength(2);
    expect(top[0]![0]).not.toBe(top[1]![0]);
    expect(pairs[0]![0]).toBeCloseTo(10);
    expect(pairs[0]![1]).toBeCloseTo(0);
  });
});
