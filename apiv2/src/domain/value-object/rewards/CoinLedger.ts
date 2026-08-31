import { CoinDescription } from './CoinDescription.js';
import { Material } from './Medal.js';

/**
 * CoinLedger manages a map of coin descriptions.
 * now it could be array, but will see...
 */
export class CoinLedger {
  private static _map: Map<string, CoinDescription> = new Map([
    ['1', new CoinDescription('1', 1, Material.Silver, 1.2, '1')]
  ]);

  /**
   * Get a coin description by ID
   */
  static get(descriptionId: string): CoinDescription | undefined {
    return this._map.get(descriptionId);
  }

  /**
   * Check if a coin description exists
   */
  static has(descriptionId: string): boolean {
    return this._map.has(descriptionId);
  }

  /**
   * Get all coin descriptions
   */
  static getAll(): Map<string, CoinDescription> {
    return new Map(this._map);
  }
}
