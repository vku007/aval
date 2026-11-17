# Chapter I attack fee

Chapter I has no battle kit. An attack moves the player's whole campaign item stack into the match, and the NPC's whole tile garrison into the match. The price of the attack is 10 copper.

The wager stays in the code. A later chapter sets `battleEntry` to `wager` and names a `battleKit`. That chapter debits only the kit from the player. Chapter I never reads a kit.

The easy, normal, and hard stacks in Chapter I stay. They are the starting contents of each tile's garrison, which is the inventory the NPC brings. They are not a battle kit.

This plan is the change. `campaigns.md`, `campaigns_api.md`, and `campaigns_ui.md` are updated to match when the change lands. A run already started keeps the rules copied at its start, so an open Chapter I that still has a wager finishes on that wager.

## Entry

`StoredRules` gains `battleEntry` and `attackFee`. `battleKit` stays optional.

| Field | Chapter I | A later wager chapter |
|---|---|---|
| `battleEntry` | `fee` | `wager` |
| `attackFee` | `10` copper | `0` |
| `battleKit` | absent | the stack that leaves the campaign |

A stored rules object with no `battleEntry` is `wager`. That is how a run started before this change keeps today's kit debit. New starts of Chapter I copy `fee` and `10`, and they copy no `battleKit`.

The client reads `rules.battleEntry`. A fee chapter's view has `attackFee` and no `battleKit`. A wager chapter's view has `battleKit`.

```json
"rules": {
  "battleEntry": "fee",
  "attackFee": { "copper": 10 },
  "digCost": { "copper": 4 },
  "searchCost": { "copper": 6 },
  "increaseMinesCost": { "copper": 6 }
}
```

## What an attack checks

Same map checks as today: started, no open battle, target enabled and seen, neutral, next to an owned tile, optional `from` is an owned neighbor.

Then both of these:

- `actionPoints >= 1`
- the wallet can pay the entry

Fee entry: `copper >= attackFee` (10). Chapter I has no kit to consult.

Wager entry: the campaign inventory can pay every amount in `battleKit`. Copper is not consulted. This is today's check, kept for the next chapter.

`cannot_afford_battle` means the entry cannot be paid and a legal target exists. The stall line for a fee chapter is `You need 10 copper to attack.` The wager chapter keeps `You need the battle kit before you can attack.`

## What each side brings

Fee entry, in this order, one write:

1. Debit 10 copper. Gold and silver stay on the campaign.
2. Take every item the player has: stones, scissors, papers, the three `NA_effect_*` keys, and `NT_effect`, whatever the counts are. The campaign item counts become 0. Coins do not move.
3. Spend one action point.
4. Store `activeBattle` with `committedItems` equal to the stacks that moved, and `feeCopper` 10. `wager` is absent.
5. Create the extended PvE game.
   - The human row is `committedItems` and 0 coins.
   - The NPC row is that tile's garrison, every item and every coin on it. Nothing is trimmed to a kit.
   - The campaign link is unchanged.

Wager entry stays for the next chapter: debit only `battleKit`, store it on `wager`, seat that kit as the human row, and leave every other player item in the campaign. The NPC row is still the tile garrison. `committedItems` is empty and `feeCopper` is 0.

If the game is not stored, undo that entry. Fee mode returns `committedItems`, returns the 10 copper, and restores the action point. Wager mode returns the kit and the action point, as it does today. The same undo runs on the next read when `gameId` is still empty.

While the battle is open the campaign wallet shows 0 items and the copper left after the fee. The match shows the items. Dig, Search, Buy, End Turn, and Leave stay rejected until the battle closes.

## How the stacks come back

A finished match already adds the human game inventory back, then adds a victory reward on a win. That return is the whole remainder, because the whole stack went in. Items thrown during the match are already gone from that row, so they stay spent. Human coins on the game row are 0, so the return does not add copper.

`battleOutcome.spent.items` is `committedItems` minus the items that came back. On a wager chapter it stays `wager` minus the items that came back. The 10 copper is not part of `spent`. It is already out of the wallet.

| End | Fee chapter | Wager chapter |
|---|---|---|
| Win | Remainder returns, then the tile reward. Action point stays spent. The 10 copper stays spent. Garrison is discarded. | Today's leftover-kit return. |
| Loss, including surrender | Remainder returns. No reward. Action point stays spent. The 10 copper stays spent. NPC remainder is written back onto the garrison. | Today's leftover-kit return. |
| Broken, or cancel before any throw | `committedItems` return, the 10 copper returns, the action point returns. The game leftover is not what comes back. | The kit and the action point return. |
| Create failed, or a read with an empty `gameId` | Same as broken. | Same as today. |

A broken match still means the match did not count. Pressing BACK inside the match is a loss, not a broken match.

## BACK inside the match

Campaign PLAY opens `BlitzGameScene` with `campaignId`. When `campaignId` is set, BACK sends `Surrender` on that game, then opens the map. Surrender finishes the match for the NPC and does not spend inventory. The campaign resolve that already runs after a saved `finished` game treats it as a loss: the items still in the game inventory return to the campaign, the garrison takes the NPC remainder, the action point stays spent, and the 10 copper stays spent. Nothing is charged for the return.

BACK with no `campaignId` on Blitz still leaves for `GameSelectScene` and does not surrender. BACK with no `campaignId` on the Tests play scene still leaves for `TestsScene`.

The map sheet BACK stays `{ type: 'cancel_attack' }`. It is still only offered before a throw, and it still marks the game `broken`. On a fee chapter that returns the items, the 10 copper, and the action point. A throw already played still rejects it. The forfeit is the BACK on the play scene, which works after throws as well.

## Economy note

Chapter I starts with 16 copper. The first attack costs 10 and leaves 6. Dig is 4, so one dig still fits. Search and IncreaseMines are 6, so they fit only while the fee is still in the wallet. The camp pays 2 copper at End Turn. The score's copper term counts copper above the starting 16, so each paid attack lowers that term by 10. Weights stay as they are. The worked score examples in `campaigns.md` are recalculated when that doc is edited.

Autobattle is unchanged as a policy. It now throws from the whole stack, at the same sizes (stone 3, paper 3, scissors 2), and the unthrown part returns. The fee stays spent.

## Client

Attack on a fee chapter: **Attack · Best of 5 · 10 copper** (Best of 7 on the citadel). The kit phrase stays on a wager chapter.

The button is offered when the cell is attackable, `actionPoints >= 1`, and `cannot_afford_battle` is absent.

Play-scene BACK with a `campaignId` surrenders, then the map GET shows the resolved loss. The outcome notice for a played loss is still the log line and the wallet. Autobattle still opens the outcome sheet.

## Tests

- Fee attack with 10 copper and an action point moves all seven item keys onto the human game row, zeroes them on the campaign, leaves gold and silver, and leaves `copper - 10`.
- 9 copper rejects, writes nothing, and sets `cannot_afford_battle`.
- 0 action points rejects even when the copper is there.
- A failed game create, and a read with an empty `gameId`, restore items, copper, and the action point.
- A win returns the unthrown items, then the reward. A loss returns the unthrown items and writes the garrison. The fee and the action point stay spent in both.
- Surrender from the game API does the same as that loss.
- `cancel_attack` before a throw returns items, copper, and the action point. After a throw it is still a conflict.
- Chapter I's definition has `battleEntry: 'fee'`, `attackFee` 10, and no `battleKit`. Its view omits `battleKit`.
- The NPC game row equals that tile's garrison items and currencies.
- A rules object with no `battleEntry` still debits `battleKit`.
- A definition with `battleEntry: 'wager'` and a `battleKit` still seats only that kit for the player, and still seats the garrison for the NPC.
- The offer label for a fee view is the copper price, and the stall line names 10 copper.
