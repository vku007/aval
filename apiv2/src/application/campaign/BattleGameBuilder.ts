import { GameCreateContext } from '../dto/processor/GameCreateContext.js';
import { Game } from '../../domain/entity/Game.js';
import { GameStatus } from '../../domain/value-object/GameStatus.js';
import { KindOfGame } from '../../domain/value-object/KindOfGame.js';
import {
  CURRENCY_KEYS,
  GamePlayerInventory,
  ITEM_KEYS,
  type InventoryItems
} from '../../domain/value-object/GamePlayerInventory.js';
import { GameType } from '../../domain/value-object/GameType.js';
import { GameLevel } from '../../domain/value-object/GameLevel.js';
import { CampaignContext } from '../../domain/value-object/CampaignContext.js';
import type { CurrencyStack, ItemStack } from '../../domain/campaign/CampaignInventory.js';
import { assertSupportedNpcAlgorithm } from '../../domain/campaign/Garrison.js';
import type { BattleGameSpec } from '../services/CampaignGamePort.js';

export function buildBattleGame(spec: BattleGameSpec, gameId: string, now: number): Game {
  assertSupportedNpcAlgorithm(spec.npcAlgorithmId);
  const game = new Game(
    gameId,
    [spec.userId, 'NPC_1'],
    GameStatus.Created,
    new GameCreateContext(
      GameType.PVE,
      spec.rounds,
      KindOfGame.Extended,
      new GameLevel(spec.levelName),
      new CampaignContext(spec.title)
    )
  );
  game.inventories = [
    zeroCoinInventory(spec.userId, spec.humanItems, now),
    stackedInventory('NPC_1', spec.npcItems, spec.npcCurrencies, now)
  ];
  game.assignCampaignLink({
    campaignId: spec.campaignId,
    campaignTile: { ...spec.tile },
    campaignAttackId: spec.attackId,
    campaignBattleSeed: spec.seed,
    campaignNpcAlgorithmId: spec.npcAlgorithmId
  });
  return game;
}

function stackedInventory(
  userId: string,
  items: ItemStack,
  currencies: CurrencyStack,
  time: number
): GamePlayerInventory {
  const full = {} as InventoryItems;
  for (const key of ITEM_KEYS) {
    full[key] = items[key] ?? 0;
  }
  return new GamePlayerInventory(userId, full, {
    gold: currencies.gold ?? 0,
    silver: currencies.silver ?? 0,
    copper: currencies.copper ?? 0
  }, time);
}

function zeroCoinInventory(userId: string, items: ItemStack, time: number): GamePlayerInventory {
  const full = {} as InventoryItems;
  for (const key of ITEM_KEYS) {
    full[key] = items[key] ?? 0;
  }
  const currencies = { gold: 0, silver: 0, copper: 0 };
  for (const key of CURRENCY_KEYS) {
    currencies[key] = 0;
  }
  return new GamePlayerInventory(userId, full, currencies, time);
}
