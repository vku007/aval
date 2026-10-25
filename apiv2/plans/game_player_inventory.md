# GamePlayerInventory

One inventory per participant, stored on `Game` as `inventories`. Moves stay `userId`, `context`, and `time`. Classic play and surrender do not change inventories. An extended move spends the thrower's row.

## Shape

```json
{
  "userId": "user-001",
  "items": {
    "stones": 1000,
    "scissors": 1000,
    "papers": 1000,
    "NA_effect_stone": 1000,
    "NA_effect_scissors": 1000,
    "NA_effect_papers": 1000,
    "NT_effect": 1000
  },
  "currencies": { "gold": 1000, "silver": 1000, "copper": 1000 },
  "time": 1697123456789
}
```

Every count and `time` is a non-negative integer. A provided row includes every item and currency key. `userId` must be one of the game's `usersIds`. Duplicates and unknown ids are `400`.

`GamePlayerInventory.defaultFor` sets every amount to 1000. `advancedFor` is the extended-game start: 20 stones, 12 scissors, 10 papers, 2 `NA_effect_stone`, 5 `NA_effect_scissors`, 3 `NA_effect_papers`, 3 `NT_effect`, and 1000 of each coin. `ensureForUsers` keeps provided rows and fills anyone missing. Create uses `Date.now()` for those new rows. A classic create fills with `defaultFor`. An extended create fills with `advancedFor`. A stored game with no `inventories` field loads as defaults with `time: 0`, and the next save persists that fill.

## HTTP

- `POST /apiv2/external/games` — optional `inventories`. Participants are the caller and `NPC_1`. Omit the field and both get `defaultFor` on a classic game, or `advancedFor` on an extended game. A player missing from a provided array is filled the same way. Response stays `{ status, gameId }`.
- `GET /apiv2/external/games/{gameId}` — `payload.playerContext.inventory` is only the caller. The action response uses the same payload. The body still does not send an inventory.
- Extended `Move`: remove `size` of the thrown type (`stones`, `scissors`, or `papers`). A size effect (`NegateSize`, `Overpower`) also removes one NA effect of the thrown type (`NA_effect_stone`, `NA_effect_scissors`, or `NA_effect_papers`). A type effect (`Protection`, `SizeOnly`) removes one `NT_effect`. `time` is the spend time. A short count is `400` and the game is not saved. `NPC_1` sends no effects. Its extended size is `1` through `min(turn cap, stock)` of a type that still has items. An empty gesture inventory, or a type whose turn cap cannot be paid, is a surrender. Turn caps are `max_stone_per_turn` 9, `max_scissors_per_turn` 4, and `max_paper_per_turn` 7 unless create sets them.
- `POST/PUT/PATCH /apiv2/internal/games` — the full array is accepted and returned. Omit on create to default every user. Omit on replace or merge to keep stored rows, drop users no longer in `usersIds`, and default new users.
