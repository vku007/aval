# Campaigns API — implementation plan

Status: plan only. Not implemented.

Rules live in [campaigns.md](./campaigns.md). This file is the build order for the API. When the two disagree, the design wins and this plan is updated.

Out of this plan: the Chapter I screens (catalog, map, battle, score). Those are [campaigns_ui.md](./campaigns_ui.md). The only client edits here are the two lobby scenes that still send `episode`, so game create keeps working after the rename. No new AWS resources, no `campaigns/` prefix, no Terraform.

## Decisions locked here

These are the code choices the design left open.

1. **Campaigns live in the user JSON, beside the profile.** The stored object becomes `{ name, externalId, campaigns }`. A missing `campaigns` reads as `[]`. `GET /apiv2/external/me` and the internal user DTO stay `{ id, name, externalId }`. The map is not a profile field.

2. **There is no campaign repository.** `CampaignService` loads and saves through the existing `IUserRepository`. The ETag is the user object's ETag. `S3UserRepository.checkPreconditions` already returns 412 when `If-Match` differs.

3. **Profile writes must keep the array.** `User.updateName`, `User.merge`, and `UserService.updateUser` rebuild a `User` from name and external id today. After this change they copy `campaigns` onto the new entity. A rename that drops the array is a data-loss bug, and slice 1 has a test for it.

4. **The chapter name and the battle link are different fields.** `campaign` on the create context stays `{ name }`, the same shape `episode` has now. `campaignId`, `campaignTile`, `campaignAttackId`, `campaignBattleSeed`, and `campaignNpcAlgorithmId` sit on the game document, next to `createContext`. The public create body is rejected when any of those is present. Only Attack writes them. A battle saved before the algorithm field loads as `npc-v1`.

5. **Attack persists the debit before it creates the game.** The design's crash rule needs that. Resolution stays two writes: save the game, then save the user. See [Writes](#writes).

6. **`GameProcessorService.createGame` is not the battle factory.** That method swallows a failed save and fills inventories with `advancedFor` (coins at 1000). Attack calls a new method that throws when the game does not persist and that stores the exact inventories it is given.

7. **NPC dice for a linked game come from `campaignBattleSeed`.** Lobby games keep `Math.random`. The seed is copied onto the game so a throw does not read the user file. The draw is `mulberry32(mix(seed, npcMovesAlreadyPlayed))`, so a new Lambda invocation continues the same sequence.

8. **A resolved attack id is kept after `activeBattle` is cleared.** The instance stores `resolvedAttacks: { attackId, gameId }[]`. It is not part of the view. A second delivery of the same pair changes nothing. Victory on an already finished instance is accepted only when this same `attackId` is the one being applied.

9. **Repair runs before the view and before every command.** One user write at the end covers the repair and the command. Attack is the exception, because the game create sits between two user writes.

10. **Clock values are epoch milliseconds**, same as `Game.endTime` and inventory `time`. The log field `turn` is the displayed turns after the command (`turnNumber + 1`).

## What the code does today

| Fact | Where |
|---|---|
| User file is `{ name, externalId }` only. Both repositories rebuild the entity from those two fields. | `User.ts`, `S3UserRepository`, `FileUserRepository` |
| External routes are wired in `createRouter`. Auth is `authMiddleware()`. Admin is `requireRole('admin')`. | `app.ts` |
| `POST /apiv2/external/games` parses `GameCreateContext`, which requires `episode`. It always seats `NPC_1`. | `ExternalController`, `GameProcessorService.createGame` |
| A throw is `GameProcessor.processAction`, then `doNpcAction`, then one game save. Nothing reads the user file. | `GameProcessorService.updateGame` |
| `GameProcessor` already accepts an optional `NpcActor`. `NpcActor` calls `Math.random`. | `GameProcessor`, `NpcActor` |
| `whoIsWinner` is `trunc(n / 2) + 1` round wins. Surrender gives the match to the other id. | `GameProcessor` |
| Errors are RFC 7807 via `ApplicationError`. 400 `ValidationError`, 404 `NotFoundError`, 409 `ConflictError`, 412 `PreconditionFailedError`, 428 `PreconditionRequiredError`. | `shared/errors` |
| Headers are lower-cased. `If-Match` is `request.headers['if-match']`. ETag is quoted by `HttpResponse.withETag`. | `ApiGatewayAdapter`, `UserController` |
| Item and currency keys already exist. `ITEM_KEYS` and `CURRENCY_KEYS` are private to `GamePlayerInventory`. | `GamePlayerInventory.ts` |
| The html5 lobby sends `episode`. | `BlitzGameScene.js`, `TestsScene.js` |

## Modules

```
apiv2/src/domain/campaign/
  CampaignDefinition.ts      registry interface + Chapter I constant
  ChapterI.ts                template, kits, prices, weights, rewards
  Campaign.ts                instance. commands return a new instance or throw
  CampaignInventory.ts       items + currencies, no userId
  Tile.ts                    server tile, stashes, per-turn flags
  ActiveBattle.ts
  Hex.ts                     radius test, six neighbors, aligned
  CampaignView.ts            tile views, blockedReasons, log slice, rules
  CampaignScore.ts           frozen total
  CampaignLog.ts

apiv2/src/application/services/
  CampaignService.ts         load, repair, command, save, catalog
  CampaignGamePort.ts        createBattle, loadGame, saveGame

apiv2/src/application/campaign/
  Autobattle.ts              player policy + seeded NPC loop
  Repair.ts                  empty gameId refund, finished/broken resolve

apiv2/src/application/dto/campaign/
  campaignSchemas.ts         Zod bodies
  CampaignResponse.ts

apiv2/src/presentation/controllers/
  CampaignController.ts
```

`Campaign` does not import the game processor. `CampaignService` is the only place that sequences the user document and the game document.

`UserEntity` gains `campaigns: Campaign[]` and `withCampaigns(next)`. `UserProfile` stays name and external id. `fromUserProfile` copies the current campaigns.

Export `ITEM_KEYS` and `CURRENCY_KEYS` from `GamePlayerInventory` and build `CampaignInventory` from those lists. A definition that names any other key fails at load.

## Stored shapes

User file, `users/{id}.json`:

```json
{
  "name": "Ada",
  "externalId": 17,
  "campaigns": []
}
```

Instance fields that are stored and are not all visible:

| Stored | In the view |
|---|---|
| `id`, `definitionId`, `title`, `rulesetVersion`, `status` | yes |
| `finishReason`, `finishedAt` | when finished |
| `createdAt`, `updatedAt` | yes |
| `turnNumber`, `actionPoints` | yes, plus computed `turns` |
| `inventory` | yes |
| `rules` (costs, entry, marketplace, score weights, `economyConsumesActionPoint`, `actionPointsPerTurn`) | yes, without the flag names the client does not need. Send `digCost`, `searchCost`, `increaseMinesCost`, `battleEntry`, `attackFee` on a fee chapter, `battleKit` on a wager chapter, `marketplace`, `scoreWeights`. Keep the two flags on the stored rules for the server. |
| `tiles` including stashes and garrisons | no. 19 views only. A seen tile includes `garrison` after a loss on that tile |
| `activeBattle` | `{ gameId, q, r }` or null. `gameId` is null only while the crash window is open; the view then still reports `battle_in_progress` |
| `resolvedAttacks` | no |
| `log` | last 20, newest first |
| `score` | only after `victory` |
| `startingInventory` | no. The score reads it. The view does not. |

`rules` and the map are copied at start. Later edits to `ChapterI.ts` do not reshape a stored run.

Game file gains, all optional, all absent on lobby games:

```json
{
  "campaignId": "campaign-1730000000000-ab12cd",
  "campaignTile": { "q": 0, "r": -1 },
  "campaignAttackId": "attack-1730000000000-ef34gh",
  "campaignBattleSeed": 1847293311,
  "campaignNpcAlgorithmId": "npc-v1"
}
```

`createContext.campaign` is `{ "name": "Chapter I" }`. `level.name` is `easy`, `normal`, or `hard`. `rounds` is `BO5` or `BO7`.

Old games: `createContext.episode` loads as `campaign`. A stored object with both keys uses `campaign`. Responses write `campaign` only.

## Writes

Catalog and instance GET do not write, except when repair changes the instance. Repair saves with the ETag just read. A lost race returns 412, and the client re-reads.

Start, Leave, End Turn, Dig, Search, IncreaseMines, Buy, and internal finish are one user save with the caller's `If-Match`.

Attack, in order:

1. Repair in memory. Reject when the checks in the design fail. Change nothing yet.
2. Debit 10 copper, move every campaign item, spend one action point, set `activeBattle` with a new `attackId`, a `battleSeed`, the tile, `committedItems`, `feeCopper` 10, `gameId` empty, `resolved: false`. Save the user. A wager chapter debits only `battleKit` onto `wager`.
3. Create the game with `committedItems` as the human inventory and the tile garrison as `NPC_1`. Human coins are 0. The NPC row copies the garrison items and currencies. Chapter I garrisons have no coins. Pass both rows so `ensureForUsers` does not fill defaults. Copy `npcAlgorithmId` to `campaignNpcAlgorithmId`. Persist the game or throw. An id other than `npc-v1` or `npc-greed-v1` is rejected before the user save. `npc-greed-v1` throws size 1. A wager chapter seats the kit as the human row.
4. Store `gameId` on `activeBattle`. Save the user with the ETag from step 2.

If step 3 throws, return the items and the 10 copper, restore the action point, clear `activeBattle`, save, and return the create error. A wager chapter returns the kit. If step 4 throws, leave the step-2 document in place (empty `gameId`) and return 500. The next read refunds. The orphan game is inert: resolve applies only when `activeBattle.gameId` equals that game's id.

Autobattle and a human finish:

1. Save the game once (the simulation, or the throw the processor already saved).
2. Resolve into the user document and save it.
3. If step 2 throws, the game response still returns. The next campaign read resolves. It does not simulate again.

`updateGame` calls the sink only when the saved game is `finished` or `broken` and `campaignId` is set. Status `created` is still an open battle.

## Game port

```ts
interface CampaignGamePort {
  createBattle(spec: BattleGameSpec): Promise<{ gameId: string }>;
  load(gameId: string): Promise<LinkedGame | null>;
  save(game: Game, ifMatch: string | undefined): Promise<void>;
}

interface CampaignBattleSink {
  resolveFromGame(game: Game): Promise<void>;
}
```

`BattleGameSpec` is the user id, instance id, attack id, seed, tile, rounds length, level name, both inventories, and the title `Chapter I`.

Wire-up in `createRouter`, after both services exist:

```ts
const games = new GameProcessorService(gameRepository);
const campaigns = new CampaignService(userRepository, games, logger);
games.setBattleSink(campaigns);
```

`createBattle` throws when the repository save throws. It does not return `created` for a game that was not stored.

Public `POST /apiv2/external/games` stays on `createGame`. Before `GameCreateContext.fromJSON`:

- Body has `campaignId`, `campaignTile`, `campaignAttackId`, `campaignBattleSeed`, or `campaignNpcAlgorithmId` → 400.
- Body has `episode` and no `campaign` → 400.
- Body has both → read `campaign`, ignore `episode` for the name.

Stored `GameCreateContext.fromJSON` still accepts `episode` alone, because old files use that key. The HTTP check is the stricter one, and it sees the raw body.

## NPC seed

`NpcActor` takes an optional `random(): number`, default `Math.random`.

For a linked game, `GameProcessorService.updateGame` builds the actor with one draw function:

```
mix = campaignBattleSeed XOR (npcMoveCount * 0x9E3779B1)
random = mulberry32(mix)
```

`npcMoveCount` is the NPC moves already stored on the game. One decision uses that function. The next throw sees a higher count, so it draws the next value. Autobattle uses the same function inside its loop, so a simulated match and a throw-by-throw match with the same seed are the same moves. A test asserts that.

Lobby games pass no seed. Their actor stays `Math.random`.

## Autobattle policy

Allowed only when this instance has an open battle and the linked game has no moves. A game that already has a throw is 409. No open battle is 409. Lobby games have no route for this.

Player throws, in order, repeating: stone 3, paper 3, scissors 2, stone 3, paper 3, scissors 2.

- The first stone throw also spends `Overpower` when `NA_effect_stone` can be paid. Later stones do not.
- The first throw in the battle that can pay `NT_effect` also spends `Protection`. One effect, once.
- Size drops to the stock when the stock is at least 1 and below the planned size. A gesture at 0 is skipped.
- No legal gesture is Surrender, which the existing processor scores as a loss.
- Each throw goes through `GameProcessor.processAction`, then `doNpcAction`.
- Stop on `finished` or `broken`. At 48 player throws, set `status` to `broken` without `endingGame`. The broken path returns `committedItems` and the fee. A wager chapter returns the kit.

The response adds `battleOutcome` from the resolved instance. Throws stay on the game.

## Repair

Run on instance GET and at the start of every command, including Start's sibling commands. Start itself has no instance yet.

| State | Action |
|---|---|
| No `activeBattle` | none |
| `gameId` empty | Return `committedItems` and `feeCopper`, restore one action point (not above the maximum), clear `activeBattle`, append `battle_refunded`. A stored `wager` with no fee is returned instead. Do not load a game. |
| `gameId` set, game `created` or `started` | leave it open |
| `gameId` set, game `finished` or `broken`, pair already in `resolvedAttacks` | clear a stale `activeBattle` if it is still that pair. Grant nothing. |
| `gameId` set, game `finished`, player won | leftovers + tile reward, capture, reveal neighbors, maybe victory and score, clear battle, record the pair, store `lastBattleOutcome` |
| `gameId` set, game `finished`, player lost or surrendered | human leftovers only, write the NPC row onto the garrison and mark it known, clear battle, record the pair |
| `gameId` set, game `broken` | return `committedItems` and the fee, or the stored wager, restore the action point, clear battle, record the pair |
| `gameId` set, game document missing | leave the battle open and log it. Do not refund. |

Winner is `whoIsWinner(game) === humanUserId`. The human is `usersIds[0]`, which is how `createGame` already orders the seats.

Human leftovers are the human `GamePlayerInventory` items and currencies. The NPC row is not added to the player. On a loss it replaces that tile's garrison inventory. On a win the garrison is removed. A broken game does not change the garrison. A stored battle with no `campaignNpcAlgorithmId` plays as `npc-v1`. Chapter I grants victory coins on the campaign, so they are not also copied from `GameOutcome`.

An old campaign tile with `defenderKit` and no `garrison` loads as a hidden garrison. The algorithm is the campaign's old `npcAlgorithmId` when that field is still on the file, otherwise `npc-v1`. Owned tiles stay without a garrison. New saves omit `npcAlgorithmId` and `defenderKit`.

## HTTP

Caller is `request.user.userId`. An instance id is looked up only inside that user file. Anything else is 404, including another player's id.

| Method | Path | Auth | If-Match |
|---|---|---|---|
| GET | `/apiv2/external/campaigns` | any authenticated | no |
| POST | `/apiv2/external/campaigns` | any authenticated | required |
| GET | `/apiv2/external/campaigns/:id` | any authenticated | no |
| POST | `/apiv2/external/campaigns/:id/actions` | any authenticated | required |
| POST | `/apiv2/internal/users/:userId/campaigns/:id/finish` | admin | required |

Missing `If-Match` on a required route is 428. A mismatch is 412. Success responses send the user ETag with `withETag`.

Catalog GET ensures the user row exists, the same way `GET /apiv2/external/me` auto-creates, then returns the summary and that new ETag. Start can then send it.

Bodies, Zod:

```ts
// POST /campaigns
{ definitionId: z.string().min(1) }

// POST /campaigns/:id/actions
z.discriminatedUnion('type', [
  z.object({ type: z.literal('end_turn') }),
  z.object({ type: z.literal('attack'), q: z.number().int(), r: z.number().int(), from: coord.optional() }),
  z.object({ type: z.literal('autobattle') }),
  z.object({ type: z.literal('dig'), q: z.number().int(), r: z.number().int() }),
  z.object({ type: z.literal('search'), q: z.number().int(), r: z.number().int() }),
  z.object({ type: z.literal('increase_mines'), q: z.number().int(), r: z.number().int() }),
  z.object({ type: z.literal('buy'), item: z.string(), amount: z.number().int().positive() }),
  z.object({ type: z.literal('leave') })
])

// internal finish
{ reason: z.literal('external') }
```

`sell` and any other `type` fail the union and return 400. A priced-key check for `buy` is domain validation after Zod, so silver, gold, and unknown keys are 400 as well.

Success body:

```ts
{
  campaign: CampaignView,
  gameId?: string,          // attack
  battleOutcome?: {         // autobattle
    result: 'victory' | 'defeat',
    playerRoundWins: number,
    npcRoundWins: number,
    q: number,
    r: number,
    captured: boolean,
    reward: { items, currencies } | null,
    spent: { items }
  },
  found?: { items, currencies }  // search, this response only
}
```

Catalog body is the summary in the design's Reads section, not this object. Its ETag is still the user document's.

`ConflictError` gains an optional `gameId`. When a map command, Buy, or Leave hits an open battle, the problem body includes that `gameId`. Other conflicts omit it.

| Situation | Status |
|---|---|
| Unknown definition, unknown instance, id not on this user | 404 |
| Start while this definition is already `started` | 409 |
| Command on a finished instance | 409 |
| Stale ETag | 412 |
| Missing If-Match | 428 |
| Bad coordinates, not a neighbor, own tile, disabled, unowned dig, kit or cost short, no action point, second use this turn, mines at max, no stash, amount < 1, unpriced buy, `sell` | 400, no write |
| Map command, Buy, or Leave during `activeBattle` | 409 + `gameId` |
| Autobattle with no open battle, or after a throw exists | 409 |
| Internal finish while `activeBattle` is set | 409 |
| Internal finish with a reason other than `external` | 400 |

A 400 or 409 leaves the document as it was, apart from a repair that was already required. Repair and the rejected command are not one success. If repair changes state, save it, then throw the command error, and return the new ETag on the error only when the body can carry it. Simpler rule, locked: if the command is rejected, do not apply repair in that request. Return the error. The client re-reads, and the GET repairs. Commands stay all-or-nothing. GET remains the repair path. This matches "a rejected command writes nothing."

## View rules that are easy to get wrong

- All 19 views are always present. A coordinate outside `max(|q|, |r|, |q + r|) <= 2` is 400, not a hidden tile.
- Hidden: `q`, `r`, `visibility: hidden`.
- Blocked: revealed and disabled. Chapter I authors none. The branch still exists.
- Seen: `difficulty`, `rounds` (`BO5` or `BO7`), `objective`. No income, no mines, no stash.
- Owned: `income` is `{ product, perTurn }` with `perTurn = mines × unit`. Unit is 1 for a gesture and 2 for copper. Flags and `searchAvailable` are on this view only.
- `blockedReasons` is computed, not stored. Codes: `cannot_afford_battle`, `no_attack_target`, `battle_in_progress`. An action point of 0 is not a code.
- `searchAvailable` can be true while `searchedThisTurn` is true.
- The client flag on a request is ignored. Every check is server-side.

## Score

Pure function, tested with the design's inputs, not by replaying a whole map:

```
total = max(0, 200 - turns * 50 + victories * 20 + silver * 20 + copper * 1)
```

`turns` is `turnNumber + 1` at the moment the citadel is captured. `victories` is owned tiles minus the camp. Silver and copper are `max(0, current − starting)`. Stored object is `{ total, turns, victories, silver, copper }`. `abandoned` and `external` store no score. A second resolve of the same `attackId` does not recompute it.

## Slices

Each slice ships with its tests and the doc paragraphs it makes true. A later slice does not reach back to reinterpret a stored field.

### Slice 0 — Rename `episode` to `campaign`

Lobby create keeps working. No campaign routes yet.

- Rename `EpisodeContext` to `CampaignContext`. `GameCreateContext.campaign` replaces `episode`. Response DTOs (`InitGameContext`, `GameContext`) emit `campaign`.
- Stored load accepts `episode` or `campaign`, and `campaign` wins.
- Public create rejects an `episode`-only body and rejects the campaign link keys, including `campaignNpcAlgorithmId`.
- `BlitzGameScene.js` and `TestsScene.js` send `campaign: { name: 'Episode1' }` (the same string they send now).
- Docs: `CLASS_DIAGRAM.md`, `GAME_FLOW.md`, the create-game section of `API_DOCUMENTATION.md`.

Done when existing game tests pass with the new key, an old JSON fixture with `episode` still loads, and a create body with `campaignId` returns 400.

### Slice 1 — Instance, catalog, start, read, leave

Persistence and the read path. Map is stored and returned as views. Attack, Dig, Search, IncreaseMines, Buy, End Turn, and Autobattle return 400 `not available` from the action endpoint, so the route exists once.

- Extend `UserData` and both user repositories. Old files without `campaigns` load as `[]`.
- `withCampaigns`. Profile update copies the array. Regression: `updateName` then `findById` returns the same instances.
- `ChapterI` constant and a registry of one id.
- `Campaign.start(definition, now, id)` copies template, rules, and starting inventory. Id shape `campaign-${Date.now()}-${suffix}`, same generator style as game ids.
- Routes above except internal finish. Catalog computes `not_started` / `started`, `bestScore`, and history newest first.
- Leave finishes `abandoned`, no score, no income.
- One `started` instance per definition. A second start is 409. After finish, start allocates a new id. Start is not idempotent.
- Finished instance rejects every command with 409 and remains readable.
- ETag required on start and actions. Two End Turn stubs are not in this slice; the conflict test uses Leave against a stale ETag, and a parallel start.

Tests: UC-1, UC-2, UC-3, UC-4 (view of the fresh map), UC-12, UC-13, UC-16, UC-17. Also the profile-preserve test and a "definition edited after start" test that mutates a copy of the definition object and shows the stored rules unchanged.

### Slice 2 — End Turn, income, flags

- End Turn order is the design's list: reject when finished or a battle is open, pay income, clear the three flags, set action points to the maximum, increment `turnNumber`, append `income`.
- Income is `mines × unit` per owned tile. A tile captured this turn is not owned until resolution, so it is not in this loop. Disabled and neutral pay nothing.
- `economyConsumesActionPoint` is stored and unread until slice 4.
- Log entry `income` with a short summary such as `2 copper`.

Tests: UC-9. First payday on turn 0 pays 2 copper from the camp. End Turn with the point unspent works. End Turn while a battle is open is 409 and pays nothing. A second End Turn with the same ETag is 412 and pays once.

### Slice 3 — Attack, resolution, autobattle, victory

The game link and the sink.

- Domain attack checks from the design. Failure spends nothing.
- Write sequence from [Writes](#writes).
- `createBattle` on the port. Inventories are the kit and the garrison. Human coins are 0. The link stores `campaignNpcAlgorithmId`.
- Human finish and broken call `resolveFromGame` after the game save.
- Repair table from [Repair](#repair).
- Autobattle loop, seed test (simulated vs stepped), 48-throw broken refund.
- Capture sets owner, reveals neighbors, applies the tile reward, returns leftovers.
- Objective capture finishes `victory`, writes `score`, sets `finishedAt`. Catalog goes back to `not_started`. `bestScore` is the max victory total.
- Surrender is a loss. Draw is not a campaign result.
- `resolvedAttacks` makes a second delivery a no-op, including a victory retry.

Tests: UC-5, UC-5b, UC-6, UC-7, UC-8, UC-11, UC-14, UC-15, UC-18, UC-20. Plus empty-`gameId` refund, orphan resolve no-op, score formula rows, a loss that writes the garrison back, and the next attack seating that reduced stock. "NPC inventory is not merged" into the player.

### Slice 4 — Dig, Search, IncreaseMines, Buy

- Shared checks: `started`, no battle, on the map, enabled, owned.
- Dig: not dug, `mines >= 1`, pay 4 copper, credit `2 × mines × unit`, set the flag. Mines unchanged.
- Search: not searched, an unfound stash exists, pay 6 copper, mark the first unfound pile, credit it, set the flag. `found` is on this response only.
- IncreaseMines: not increased, `mines < maxMines`, pay 6 copper, `mines += 1`, set the flag.
- Buy: one priced key, `amount >= 1`, copper covers `price × amount`, no partial fill. Silver, gold, and unknown keys are 400. `sell` is 400.
- When stored `economyConsumesActionPoint` is true, these four spend one point or reject when the point is 0. Chapter I stores false. A unit test uses a hand-built instance with the flag true. No second chapter is registered.

Tests: UC-10, UC-10b. Second dig, search on the camp, search order, upgrade then the next income sees the new mines, capture then the next income is the first pay for that tile, buy during a battle.

### Slice 5 — Internal finish

- Admin route. Body `{ "reason": "external" }`.
- Reject when `activeBattle` is set (409). Reject when already finished (409).
- Finish `external`, no score, no income. Player commands stop. Catalog allows a new start. History shows the reason and no score. `bestScore` unchanged.

Tests: UC-19.

## Documentation

Update with the slice that introduces the contract.

| Slice | Docs |
|---|---|
| 0 | `API_DOCUMENTATION.md` create-game body, `CLASS_DIAGRAM.md`, `GAME_FLOW.md` |
| 1 | New Campaigns section: catalog, start, read, leave, ETag, problem responses |
| 2–5 | The action rows and the internal finish route, in the same section |

`DOCUMENTATION_INDEX.md` does not need an entry if the API doc is linked the way game routes already are. Check it in slice 1 and add a line only if the index lists API sections.

## Acceptance

The design's acceptance paragraph is met when the tests named on the slices are green and:

- Campaign inventory uses `ITEM_KEYS` and `CURRENCY_KEYS` and no other keys.
- A lobby create with `campaign.name` and no link fields does not read the user file's campaigns.
- A lobby create that sends `campaignId` is 400 and creates no game.
- A finished Chapter I user file is one `users/{id}.json` plus the game files Attack created. There is no `campaigns/` object.

## Build notes

- Vitest, next to the module, same as `GameProcessor.test.ts`. Domain commands are pure and cover the corner cases without S3.
- Repository tests use the file repository (`DATA_DIR`), asserting the JSON has `campaigns` and that a file written with only `name` and `externalId` still loads.
- Do not add a campaign prefix, a second inventory type with different key names, or a client-supplied `campaignId` path "for testing".
- `economyConsumesActionPoint`, extra chapters, and battle timers stay open, as in the design. The flag is stored and checked. The other two are not coded.
