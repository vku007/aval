# NPC inventory on the advanced enemy panel

The advanced match (`BlitzGameScene`, extended best-of-5) should print the seated NPC's item stacks on the `enemy_data` panel. The stacks already live on `Game.inventories` and already drop when the NPC throws. The external payload throws that row away: both GET and the action response send `enemyContext: {}`.

## Payload

On an **extended** game whose other participant id starts with `NPC_`, `enemyContext` carries that row. Same object as `playerContext.inventory` (`GamePlayerInventory.toJSON()`):

```json
"enemyContext": {
  "inventory": {
    "userId": "NPC_1",
    "items": {
      "stones": 21,
      "scissors": 12,
      "papers": 12,
      "NA_effect_stone": 3,
      "NA_effect_scissors": 2,
      "NA_effect_papers": 5,
      "NT_effect": 3
    },
    "currencies": { "gold": 1000, "silver": 1000, "copper": 1000 },
    "time": 1697123456789
  }
}
```

`NPC_1` is the id a Blitz create seats. `NPC_greed_1` and a campaign garrison id use the same rule: one other id with the `NPC_` prefix, kind `extended`.

Stay `{}` when:

- kind is classic (those stacks are the 1000-count defaults and the classic scenes do not spend them)
- the other participant is a person
- there is not exactly one NPC id
- the no-repository placeholder in `getGame` (no game, no row)

A missing inventory row for that NPC id is `ValidationError`, same as a missing caller row. `ensureForUsers` always writes one, so this is a broken stored game, not an empty panel.

No new route, no create-body field, no change to spend rules. GET and PUT/PATCH already rebuild the payload after `doNpcAction`, so the counts in the response are the stacks left for the next throw.

Campaign battles are extended and have an NPC, so they receive the same field. `GamePlayScene` does not read it.

Admin `GameResponseDto` already returns every inventory. Leave it.

## Backend

`EnemyContext` takes an optional `GamePlayerInventory`. `toJSON()` is `{}` without one, and `{ inventory }` with one.

`GameProcessorService` builds it in one helper and uses that helper everywhere a real game currently does `new EnemyContext()` (`getGame` including the `testGame` branch, and `updateGame` including its `testGame` branch). The no-repository placeholder stays `new EnemyContext()`.

```ts
buildEnemyContext(callerId: string, game: Game): EnemyContext
```

Kind check is `game.createContext.kind === KindOfGame.Extended`. NPC id is the single `usersIds` entry that is not `callerId` and starts with `NPC_`. The row is `game.inventories.find(item => item.userId === npcId)`.

`ExternalController.getGame` and `updateGame` stop hardcoding `enemyContext: {}`. They send `response.payload.enemyContext.toJSON()`.

## Docs

When this lands, update:

- `apiv2/API_DOCUMENTATION.md` — the GET example, and the line that says the opponent's inventory is not returned. Say the NPC row is returned on extended games only, and a person's inventory is still withheld.
- `apiv2/src/domain/GAME_FLOW.md` — the poll step that says `enemyContext` is empty.

## UI

The three text lines below are what shipped. [enemy_inventory_ui.md](./enemy_inventory_ui.md) replaces them with the player storage tables.

`enemy_data` on the 390×844 advanced layout is the full width and about a quarter of the height. The move readout sits top-left (`you` / `enemy` / result, `UI.body`). The NPC throw composites are centered in that panel.

Add a second text object under that readout, depth 1100, `UI.small` (11px) monospace, `#00ff66`, left at `enemy.x + 8`, wrap width `enemy.width - 16`. Three lines, zeros included, display words from `CampaignLabels` (already loaded before `BlitzGameScene`):

```
Stone 21  Scissors 12  Paper 12
Stone NA 3  Scissors NA 2  Paper NA 5
Core 3
```

Coins stay in the payload and off the panel. They do not change a throw, and the advanced start is 1000 of each.

`CampaignLabels.npcStockLines(inventory)` returns those three strings from `inventory.items`, using `word()` and `0` for a missing count. `garrisonLines` is the wrong helper: it prints Gold, Silver, and Copper.

`refreshMatchReadout` sets the text from `payload.enemyContext.inventory`. No inventory (request still in flight, or an older payload) leaves the three lines blank. After create, the first GET shows the advanced start (21 / 12 / 12 / 3 / 2 / 5 / 3). After each sent move, the action payload replaces those numbers with what the NPC has left.

The player's own storage tables keep reading `playerContext.inventory`.

## Tests

Backend, in `GameProcessorService.test.ts`:

- Extended GET returns `NPC_1` items at the advanced start.
- Extended update: after the NPC throws, `enemyContext.inventory.items` is the stock minus that throw (size off the gesture, and an effect only if the actor ever sends one — `NPC_1` does not).
- Classic GET and classic update keep `enemyContext` with no inventory.
- Extended game whose other user is not `NPC_*` keeps it empty.
- Extended game with an NPC id and no inventory row throws `ValidationError`.

`ExternalController` GET and update responses include `enemyContext.inventory` for an extended NPC game and `{}` for classic.

Client: `CampaignLabels.npcStockLines` in `site/html5Simple/js/campaign/campaign.test.js` — advanced start, a zero gesture, and a missing `items` object.

Browser, on the advanced match: the three lines show the start counts before the first throw, and they drop after a throw. The move readout and the centered enemy composite still draw. Classic and campaign play screens are unchanged.
