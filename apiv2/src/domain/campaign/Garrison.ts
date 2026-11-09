import { ValidationError } from '../../shared/errors/index.js';
import {
  CampaignInventory,
  type CurrencyStack,
  type ItemStack
} from './CampaignInventory.js';

export const NPC_ALGORITHM_V1 = 'npc-v1';

export function assertSupportedNpcAlgorithm(id: string): void {
  if (id !== NPC_ALGORITHM_V1) {
    throw new ValidationError(`Unknown NPC algorithm '${id}'`);
  }
}

/**
 * The AI player of one tile: which actor it uses, and the inventory the next battle spends.
 * `known` is true after a resolved loss on this tile. The client sees the inventory only then.
 */
export class Garrison {
  readonly npcAlgorithmId: string;
  readonly inventory: CampaignInventory;
  readonly known: boolean;

  constructor(npcAlgorithmId: string, inventory: CampaignInventory, known: boolean) {
    if (typeof npcAlgorithmId !== 'string' || npcAlgorithmId.length === 0) {
      throw new ValidationError('garrison npcAlgorithmId is required');
    }
    if (!(inventory instanceof CampaignInventory)) {
      throw new ValidationError('garrison inventory is required');
    }
    this.npcAlgorithmId = npcAlgorithmId;
    this.inventory = inventory;
    this.known = known === true;
  }

  static hidden(npcAlgorithmId: string, items: ItemStack, currencies: CurrencyStack = {}): Garrison {
    return new Garrison(npcAlgorithmId, CampaignInventory.fromPartial(items, currencies), false);
  }

  /** Remainder after a lost battle. The player may see this stock. */
  withInventory(items: ItemStack, currencies: CurrencyStack): Garrison {
    return new Garrison(this.npcAlgorithmId, CampaignInventory.fromPartial(items, currencies), true);
  }

  /** What a seen tile or a defeat outcome may include. `known` stays on the server. */
  reveal(): { npcAlgorithmId: string; inventory: ReturnType<CampaignInventory['toJSON']> } {
    return {
      npcAlgorithmId: this.npcAlgorithmId,
      inventory: this.inventory.toJSON()
    };
  }

  toJSON(): {
    npcAlgorithmId: string;
    inventory: ReturnType<CampaignInventory['toJSON']>;
    known: boolean;
  } {
    return {
      npcAlgorithmId: this.npcAlgorithmId,
      inventory: this.inventory.toJSON(),
      known: this.known
    };
  }

  static fromJSON(data: any): Garrison {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid garrison');
    }
    if (typeof data.npcAlgorithmId !== 'string' || data.npcAlgorithmId.length === 0) {
      throw new ValidationError('garrison npcAlgorithmId is required');
    }
    return new Garrison(
      data.npcAlgorithmId,
      CampaignInventory.fromJSON(data.inventory),
      data.known === true
    );
  }
}
