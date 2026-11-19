# Campaign editor — game designer review

Status: review of [campaign_editor.md](./campaign_editor.md), for the architect. Nothing here is implemented.

The plan is sound. The fixed map, one shared schema, export as the publish step, canonical output, and the per-tile derived lines are the right choices. I can author Chapter I with it.

What it lacks: two checks that let a broken chapter ship, a version warning that misses most balance changes, and any view of balance beyond one tile. The review is ordered by what blocks Slice 1, then what changes the editor's scope, then small items.

## A. Must change before Slice 1 (schema and checks)

### A1. A marketplace price of 0 makes the item free and unlimited

`Campaign.ts` buy: a key that is absent means "not for sale". A present key is a price, and `0 × amount` is 0 copper. The plan says counts are non-negative, and that `marketplace` "keeps every key". So a designer who clears a price field ships free effects.

`StackEditor` also says "zero as empty". For a price that is wrong: empty must mean "not for sale", not 0.

Ask:
- Error: a marketplace price below 1.
- The Rules tab shows each item as **For sale** at a price of 1 or more, or **Not for sale**. Not for sale omits the key.
- The marketplace is not edited in `StackEditor`. Change the canonical output rule from "keeps every key" to "keeps every item that is for sale".

### A2. `actionPointsPerTurn: 0` passes, and no attack is ever possible

`Campaign.ts` start and End Turn set action points to `rules.actionPointsPerTurn`. With 0, Attack is never legal, so the objective cannot be taken.

Ask:
- Error: `actionPointsPerTurn >= 1`.
- Warning: `actionPointsPerTurn > 1`. It allows more than one attack per turn, which [campaigns.md](./campaigns.md) lists as out of this release, and the map screen and score tuning assume one.
- Warning: `economyConsumesActionPoint: true`. Dig, Search, Upgrade, and Buy then compete with Attack. The code supports it, but Chapter I was never tuned for it.

### A3. The `rulesetVersion` warning misses most balance changes

The plan warns only when `rules` or `defenderKits` change. [campaigns.md](./campaigns.md) says `rulesetVersion` also versions the starting wallet, which the score uses as its baseline. The achievable score also moves when rewards, stashes, mines, or difficulty change.

There is a second problem. `bestScore` in `CampaignService.ts` is the maximum over every victory, whatever the version. Bumping the version records the change on the run, but scores from the old and new numbers still compete in one best score.

Ask:
- Warning when anything except `title`, `goal`, or a tile `label` differs from the loaded file and `rulesetVersion` did not change.
- Architect decision: does `bestScore` stay across versions, or is it per `rulesetVersion`? Either is fine for me. The editor's warning text should say which one applies.

## B. Scope changes I want in the editor

### B1. A route readout, to tune the score without a deploy

The tile panel shows one tile. The questions I actually tune are about routes:

- Can the starting wallet pay the first attack, and a second one after a loss plus one dig? [campaigns.md](./campaigns.md) calls this a playtest check. It is arithmetic.
- What does each reference route score? Is the short path plus the south stash still the best finish?

Proposal: a **Routes** tab. I enter a route as an ordered list of steps: capture tile, search tile, dig tile, end turn. The editor walks it with every battle won and prints, after each step, the turn, copper, silver, owned tiles, and any step the wallet cannot pay. At the end it prints the score inputs and the total from `rules.scoreWeights`. Routes are saved with the editor draft, not in `chapter-i.json`.

Leave out battle item spend and garrisons. This is the coin and turn economy only, which is what the score is made of.

Reuse: `CampaignScore.ts` imports nothing and can be bundled. The walk needs income, dig yield, fee, reward, and stash rules. See B2 for where they live.

Doc defect this would catch: [campaigns.md](./campaigns.md) has two different sets of totals for the same routes. The route table gives 200, 210, 180. The paragraph under the stash table gives 214, 228, 202. `Campaign.test.ts` asserts 214, 228, 202, using copper inputs the table shows as 0. One of them has to be corrected whether or not B1 is built.

### B2. Balance constants that are code, not settings

These numbers decide the economy, but they are in code:

| Constant | Where | Value |
|---|---|---|
| Dig yields this many turns of income | `Campaign.ts` dig: `2 * tile.mines * unitFor(product)` | 2 |
| Income unit for copper vs a gesture | `CampaignInventory.ts` `unitFor` | 2 and 1 |

`CampaignInventory.ts` imports `shared/errors`, so the editor cannot bundle `unitFor`. The plan's `derive.ts` would then write "unit 2 for copper" a second time, and the two copies can drift.

Ask the architect to choose one:

1. Move `unitFor` and a `DIG_TURNS = 2` constant into a pure file next to `InventoryKeys.ts`. Re-export them from where they live today. The editor shows both as read-only, labelled "fixed by code". This is the smallest change, and it is my preference for now.
2. Make `digTurns` and `copperIncomeUnit` fields in `rules`, with defaults so old runs still load. This needs a `rulesetVersion` bump and a migration note for stored runs.

### B3. Shorten the playtest loop with local dev

Today the loop is: export, send the file, a developer commits, deploys the Lambda, and I start a new run on production. [local_dev.md](./local_dev.md) already runs `apiv2` and the html5 client on localhost.

Ask:
- Editor dev server only: a **Save to repo** button that writes `apiv2/src/domain/campaign/chapter-i.json` directly. It goes through the same canonical serializer, and it is disabled while an error exists. It is a local tool, so writing to the repo is fine. Export stays for anyone without a checkout.
- README: the playtest steps. Run `apiv2` `npm run dev`, open the local client, and **Leave** any started Chapter I run, because a started run keeps its old copy.

### B4. Simulate a battle

The editor shows the garrison kit and the rounds. It does not show whether the player can win. Defender kits, rounds, the starting stack, and the NPC algorithm are the numbers I change most, and today the only test is playing by hand after a deploy.

What I want to see, on the Tile tab, for the selected tile:

| Output | Over N seeded battles |
|---|---|
| Win rate | Share of battles the player wins. |
| Broken rate | Share that hit the 48-throw cap. Should be 0. |
| Round wins | Average player and NPC round wins. |
| Items spent | Average and worst case per item key, what the player loses. |
| Garrison left after a loss | Average stock, which is what the next attack meets. |
| Second attack | Win rate of a second attack with the player's leftovers against the reduced garrison. |

Inputs:

- The tile's effective defender kit (its own kit from B5, or `defenderKits[difficulty]`), the length from `rounds[difficulty]`, and its `npcAlgorithmId`.
- The player stack. By default it is the starting items when `battleEntry` is `fee`, because a fee attack commits every item, or `battleKit` when it is `wager`. I can switch to a custom stack in `StackEditor`.
- N, 200 by default. Seeds are 1 to N, so the same file always gives the same numbers, and any change in the numbers comes from my edit.

The player side is the autobattle script in `Autobattle.ts`, not a human. Label the results "autobattle". A careful player does better, so this is a floor. That is fine for comparing two versions of a kit. Simulation results are numbers only. They are not warnings and never block Export.

What exists:

- `playAutobattle(game)` plays a whole match in memory with no I/O. NPC randomness comes only from `campaignBattleSeed` (`npcSeed.ts`). `Autobattle.test.ts` already builds a battle in memory and plays it.
- Its import graph is 50 files: `Game`, `GameProcessor`, the resolvers, `NpcActor`, `Logger`, and `shared/errors`. None of them imports `node:*`, an AWS SDK, or `process.env` today.
- The game a campaign attack creates is built inline in `GameProcessorService.createBattle`, then saved.

Asks for the architect:

1. Extract a pure `buildBattleGame(spec, gameId, now)` from `createBattle`. Attack and the simulator both call it, so the simulator fights the same match Attack creates. This is the prerequisite.
2. Add a pure `simulateBattles({ humanItems, npcItems, rounds, npcAlgorithmId, runs })` in `apiv2`, next to `Autobattle.ts`. Add a Vitest that pins its output for the bundled Chapter I gate and citadel, so a change to the engine or the script shows up as a changed number.
3. Choose where it runs:
   - **In the editor, in a Web Worker.** The editor imports the 50 files through the existing alias. I see the result live as I edit. This adds a guard, a test or lint rule that keeps that graph free of Node and AWS imports. This is my preference.
   - **In Node.** Use `npm run simulate` in `apiv2`, or the editor's Vite dev server calls it. The engine stays out of the browser, but the editor only works with a checkout.

Later, after B1: an option in the Routes tab to run each capture as a seeded battle and retry a loss on the next turn. It gives a spread of turns and score per route, not one best case. I'd keep it out of the first version.

### B5. Defender kit per tile, with the difficulty kit as the template

One kit per difficulty is too coarse. I want a tile to have its own garrison. Examples: a heavy-scissors tile next to the scissors mine, an easy rim tile that is lighter than the others, or a gate that differs from a later normal tile. Most tiles should still follow their difficulty, so the difficulty kit stays as the default and as the starting point for a custom kit.

This is a file and server change, not only an editor change.

**File.** Add an optional `defenderKit` field (`ItemStack`) on a tile. When it is absent, the garrison is `defenderKits[difficulty]`, as today. When it is present, it is the garrison, whole. It is not added to the difficulty kit.

**Server.** `ChapterI.ts` `makeTile` builds the garrison with `Garrison.hidden(npcAlgorithmId, defenderKit(spec.difficulty))`. It becomes `spec.defenderKit ?? defenderKits[difficulty]`. The schema checks the item keys, as it does for `defenderKits`. Runs copy their garrisons at start, so stored runs need no migration. Bump `rulesetVersion` when a tile kit is first used (A3 covers it).

**What difficulty still decides.** Rounds, the default reward, the map fill, and the `level.name` on the game. It is also the label the player sees on a seen tile before Attack.

**Editor, Tile tab.** Defender kit is **Default** or **Custom**, the same pattern as Reward.

- Default shows `defenderKits[difficulty]` read-only.
- **Custom** copies the current difficulty kit into `StackEditor`, and I edit from there. The copy is a starting point. It is not a link. A later change to `defenderKits` does not reach a custom tile.
- Under the editor, a line shows the difference from the difficulty kit, for example `+3 scissors, −1 NA_effect_stone`, and a **Reset to difficulty kit** button.
- Changing the difficulty of a custom tile keeps the custom kit. The difference line then compares it with the new difficulty's kit. Switching back to Default takes the new difficulty's kit.
- The derived garrison line and the simulator (B4) use the effective kit, custom or default.

**Editor, elsewhere.**

- Map: a `k` glyph on a tile with a custom kit, next to `r` and `s`.
- Inventory tab: next to each difficulty kit, the number of tiles that use it by default, and the list of custom tiles of that difficulty. An edit to a difficulty kit then shows which tiles it reaches and which it does not.
- A multi-selection can apply one custom kit to several tiles, or reset them to Default. The brush gets a "kit: Default" value.

**Checks.**

| Level | Check | Why |
|---|---|---|
| Error | An owned tile with `defenderKit`. | An owned tile has no garrison. Never read. |
| Error | An unknown item key in `defenderKit`. | Same rule as `defenderKits`. |
| Warning | A custom kit whose total item count is above the next difficulty's kit, or below the previous one. | The player chooses targets by the difficulty label. An "easy" tile with a hard-sized kit misleads them. Either change the difficulty or the kit. |
| Warning | A custom kit with no gestures. | The NPC surrenders on its first turn. That is a free capture, and probably a mistake. |

**Canonical output.** `defenderKit` is written only when Custom, after `npcAlgorithmId`, in item-key order, with zeros dropped. A Custom kit identical to its difficulty kit is still written, because it must not start following `defenderKits` without my choosing. The Tile tab shows "same as the normal kit" in that case.

**Docs.** In [campaigns.md](./campaigns.md), the Chapter I sentence "every neutral garrison … starts from the easy, normal, or hard kit" and the Defender kits section say that a tile may name its own kit. Chapter I version 1 still uses none.

## C. Smaller checks and editor behaviour

New warnings, all computed from the file:

| Warning | Why |
|---|---|
| A stash on an objective tile. | Taking the objective ends the chapter, so the stash can never be searched. |
| A normal or hard tile with the Default reward. | Default is empty for those. Taking the tile pays only leftovers, which is easy to do by accident. |
| A tile with `mines: 0`. | It cannot be dug and pays nothing until upgraded. The rulebook says Chapter I does not author it. Stronger text on an owned starting tile. |
| A tile whose dig nets zero or less (`yield <= digCost`). | True for every copper tile at 1 mine today, and that is intended. Show it so the choice is visible. |

Errors:

| Error | Why |
|---|---|
| `battleEntry: 'fee'` with a `battleKit`, or `'wager'` with an `attackFee`. | The unused field is dead data. Switching the entry type in the Rules tab removes the other field. |
| An owned tile with an `npcAlgorithmId`. | Never read, the same as `difficulty` and `reward`. Owner set to Player clears it. |

Tile tab:

- Derived lines show **net** dig (yield minus cost) next to the yield.
- On an objective tile, the income line reads "never pays: taking it ends the chapter".
- Owner from Player back to Neutral: restore the difficulty, algorithm, and reward from before the switch within the session. If there is none, use easy, `npc-v1`, and Default. The plan does not say.

Map:

- Hover on a cell shows which hidden cells its capture reveals. The start view shows turn 0. This shows the reveal chain, which is how the citadel is hidden behind the gate.

## D. Accepted as written

- Rounds stay per difficulty. A per-tile match length is not needed yet.
- Garrisons hold items only. A per-tile kit has no coins, the same as today's difficulty kits.
- One stash per tile, no disabled tiles, no second chapter.
- No human-like player in the simulator. The autobattle script is the only player policy.

## Summary for the architect

| # | Item | Type | Slice |
|---|---|---|---|
| A1 | Marketplace price ≥ 1, or omitted for "not for sale" | Error + UI | 1, 3 |
| A2 | `actionPointsPerTurn >= 1`; warn above 1 and on `economyConsumesActionPoint` | Error + warnings | 1 |
| A3 | Version warning covers every gameplay field; decide `bestScore` per version | Warning + decision | 1 |
| B1 | Routes tab: coin and turn walk, score per route | New tab | New slice after 4 |
| B2 | Dig multiplier and copper unit: pure constants, or rules fields | Decision | 1 |
| B3 | Save to repo in dev; playtest steps in README | Feature + docs | 2 |
| B4 | Battle simulator: shared battle builder, seeded `simulateBattles`, results on the Tile tab | apiv2 + new panel | Builder and simulator in 1; panel in a new slice after 4 |
| B5 | Optional per-tile `defenderKit`, difficulty kit as default and template; four checks | Schema + server + Tile tab | Schema and server in 1; editor in 3 |
| C | Six checks, net dig line, objective income line, owner toggle, reveal hover | Checks + UI | 1, 3, 4 |
| — | Fix the two score tables in campaigns.md | Doc | Now |

Decisions needed from the architect: A3 (best score across versions), B2 (option 1 or 2), and B4 (simulate in the browser or in Node).

## Architect response

All items are accepted and folded into [campaign_editor.md](./campaign_editor.md).

- **A3:** `bestScore` stays the highest over all versions. The version warning says so.
- **B2:** option 1, smaller. `CampaignInventory.ts` and `shared/errors` bundle for the browser, so `unitFor` is imported as is; only `DIG_TURNS = 2` is added beside it. No file moves.
- **B4:** in the browser, in a Web Worker. `Autobattle.ts` bundles for the browser today (49 files, no Node, AWS, or `process.env`). A test keeps it that way.
- **B1:** the Routes tab drives the real `Campaign`, not a copy of the economy. It moved ahead of the editing panels, because replaying the reference routes on the bundled file found that only the bare rush can be paid. The score examples and the stash paragraph in [campaigns.md](./campaigns.md) are corrected, and the balance fix is open for the designer.
