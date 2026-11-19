import chapterI from '../chapter-i.json';
import {
  parseChapterSettings,
  type ChapterSettings,
  type TileSettings
} from '../ChapterSettingsSchema.js';

export function bundled(): ChapterSettings {
  return parseChapterSettings(structuredClone(chapterI));
}

export function tileIndex(settings: ChapterSettings, q: number, r: number): number {
  const index = settings.tiles.findIndex(tile => tile.q === q && tile.r === r);
  if (index < 0) {
    throw new Error(`No tile at (${q},${r})`);
  }
  return index;
}

export function tileAt(settings: ChapterSettings, q: number, r: number): TileSettings {
  return settings.tiles[tileIndex(settings, q, r)];
}

export function patchTile(
  settings: ChapterSettings,
  q: number,
  r: number,
  patch: Partial<TileSettings>
): TileSettings {
  const tile = tileAt(settings, q, r);
  Object.assign(tile, patch);
  return tile;
}
