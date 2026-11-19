# Campaign editor — design

Status: plan only. Not implemented. Revised after the designer's review, [campaign_editor_review.md](./campaign_editor_review.md). Build tasks: [campaign_editor_build.md](./campaign_editor_build.md).

A single-page web app where the game designer edits Chapter I, checks routes and battles, and writes the settings file. The file is `apiv2/src/domain/campaign/chapter-i.json`, the one `ChapterI.ts` reads. The rules of the chapter live in [campaigns.md](./campaigns.md). This plan is the tool that writes their numbers, plus the small server changes that tool needs.

Out of this plan: a second chapter, a map that is not the radius-2 hex, disabled (blocked) tiles, more than one stash per tile, coins in a garrison, a per-tile match length, an upload API, hosting, auth, a preview inside the game, and a human-like player in the simulator.

## Decisions locked here

1. **No Phaser.** The editor is DOM forms and one SVG hex map. Almost every field is a form input, and the map is 19 static cells.

2. **The map shape is fixed.** Radius 2, flat-top, axial `(q, r)`, 19 cells, from `Hex.ts`. The editor never adds, removes, or moves a cell. `tileCount` is written as 19 and is not a field.

3. **The editor runs the server's code.** The schema, the definition builder, `Campaign`, and the autobattle engine are imported from `apiv2/src` as source. They bundle for the browser today (checked with esbuild: `Campaign.ts` 20 files, `Autobattle.ts` 49 files, no Node built-ins, AWS SDK, or `process.env`). The editor never re-implements a rule, so it cannot drift from the Lambda. A test keeps those imports browser-safe.

4. **Publishing is a file.** **Export** downloads `chapter-i.json`. On the dev server, **Save to repo** writes it in place. A developer commits it, runs `npm test` in `apiv2`, and deploys the Lambda. No new API, no S3 object, no AWS resource.

5. **The editor lives in `tools/campaign-editor/`.** Not under `site/`, which is synced to the public bucket. It runs on `npm run dev`.

6. **Stack: TypeScript, Vite, Preact, Vitest.**

7. **Export is canonical.** Fixed key order, tile order, 2-space indent, trailing newline, defaults omitted. Loading the bundled file and exporting it unchanged produces the same bytes.

8. **Best score stays across versions.** `bestScore` remains the highest total over every victory of the definition, whatever its `rulesetVersion`. The version warning says so.

## What exists today

| Fact | Where |
|---|---|
| Settings file: chapter fields, `rules`, `startingInventory`, `defenderKits`, `rounds`, `easyRewards`, 19 `tiles`. | `chapter-i.json` |
| Hand-written readers check types, enums, stack keys, NPC ids, `owner`, and the tile count. They accept negative counts, duplicate or off-map coordinates, `mines > maxMines`, no objective, no owned tile, `actionPointsPerTurn: 0`, and a marketplace price of 0. | `ChapterI.ts` |
| No `reward` on a tile: easy gets `easyRewards[product]`, normal and hard get nothing. The garrison is `defenderKits[difficulty]`. `rounds` is `rounds[difficulty]`. | `ChapterI.ts` `makeTile` |
| A marketplace key that is absent is not for sale. A present key is the price; 0 is free. | `Campaign.ts` `buy` |
| Start and End Turn set action points to `actionPointsPerTurn`. | `Campaign.ts` |
| Dig pays `2 × mines × unitFor(product)`. `unitFor` is 2 for copper, 1 for a gesture. | `Campaign.ts` `dig`, `CampaignInventory.ts` |
| `attackFee` absent is a free attack. `battleKit` absent is an empty kit. | `Campaign.ts` |
| A new run copies the definition. Runs already started keep their copy. | `Campaign.ts` `start` |
| `bestScore` is the maximum over all finished runs with a score. | `CampaignService.ts` `catalogBody` |
| A campaign battle game is built inline, then saved. | `GameProcessorService.createBattle` |
| `playAutobattle(game)` plays a whole match in memory. NPC randomness comes only from `campaignBattleSeed`. Player throws are capped at 48. | `Autobattle.ts`, `npcSeed.ts` |

## Server changes (apiv2)

```
apiv2/src/domain/campaign/ChapterSettingsSchema.ts      Zod schema, ChapterSettings type, checkChapterSettings()
apiv2/src/domain/campaign/ChapterDefinitionBuilder.ts   buildChapterDefinition(settings): CampaignDefinition
apiv2/src/domain/campaign/ChapterI.ts                   parse the bundled JSON, build, export CHAPTER_I
apiv2/src/application/campaign/BattleGameBuilder.ts     buildBattleGame(spec, gameId, now): Game
apiv2/src/application/campaign/BattleSimulator.ts       simulateBattles(input): SimulationResult
apiv2/src/browserSafe.test.ts                           bundles the editor's entry points for the browser
```

**Schema.** `ChapterSettingsSchema` is the file, field for field. Counts are non-negative integers. Stack keys are `ITEM_KEYS` or `CURRENCY_KEYS`. `battleEntry: 'fee'` requires `attackFee` and forbids `battleKit`; `'wager'` the reverse. A tile may carry `defenderKit` (an `ItemStack`).

**Checks.** `checkChapterSettings(settings): Problem[]`, where a `Problem` is `{ level: 'error' | 'warning', path, message }`. The path names the field or the tile `(q, r)`. The server throws on the first error and ignores warnings. The tables are under [Checks](#checks).

**Definition builder.** `makeTile` and its helpers move out of `ChapterI.ts` into `buildChapterDefinition`, which takes parsed settings and imports no JSON. One change: the garrison is `spec.defenderKit ?? defenderKits[difficulty]`, whole, not added to the difficulty kit. Stored runs already hold their garrisons, so nothing migrates. `CHAPTER_I` is deep-equal to today's build.

**Dig constant.** `DIG_TURNS = 2` beside `unitFor` in `CampaignInventory.ts`. `Campaign.ts` dig uses it. The editor imports both and labels them "fixed by code".

**Battle builder.** `createBattle` builds the `Game` with `buildBattleGame`, then saves it. Attack and the simulator fight the same match.

**Simulator.** `simulateBattles({ humanItems, npcItems, rounds, npcAlgorithmId, runs })` builds a game per seed 1..N with `buildBattleGame`, plays it with `playAutobattle`, and returns per-run outcomes and the aggregates the panel shows. Same input, same output. A Vitest pins the numbers for the bundled gate and citadel, so an engine or script change shows up as a changed number.

**Browser guard.** `browserSafe.test.ts` runs esbuild with `platform: 'browser'` on `ChapterSettingsSchema.ts`, `ChapterDefinitionBuilder.ts`, `Campaign.ts`, and `BattleSimulator.ts`, and fails on a Node built-in, an AWS SDK import, or `process.env` in the output.

## Checks

Errors block Export and Save, and fail the Lambda load:

| Check | Why |
|---|---|
| 19 tiles, one per on-map coordinate. | Fixed map. |
| `0 <= mines <= maxMines`, `maxMines >= 1`. | Upgrade and income assume it. |
| At least one owned tile. | No attack origin. |
| At least one objective, and no objective is owned. | No victory. |
| A tile that is not owned has a `difficulty`. | Its battle needs `rounds` and a kit. |
| An owned tile has no `difficulty`, `reward`, `npcAlgorithmId`, or `defenderKit`. | None of them is read. |
| Every stack key is known. Every `npcAlgorithmId` is supported. | Same as today. |
| `battleEntry` has its field and not the other one. | A missing `attackFee` is a free attack; the other field is dead data. |
| A marketplace price below 1. | 0 is free and unlimited. Not for sale omits the key. |
| `actionPointsPerTurn < 1`. | No attack is ever legal. |

Warnings do not block:

| Check | Why |
|---|---|
| Anything except `title`, `goal`, or a tile `label` differs from the loaded file and `rulesetVersion` did not change. Text adds: "Best score keeps the highest total over all versions." | Runs on old and new numbers share one version and one best score. |
| More than one objective. | The first one taken wins. |
| `actionPointsPerTurn > 1`. | More than one attack a turn is out of this release; the map and score assume one. |
| `economyConsumesActionPoint: true`. | Economy actions then compete with Attack. Chapter I was not tuned for it. |
| A neighbor of an owned tile is hidden. | A legal target is always already revealed. |
| An objective is a neighbor of an owned tile. | The chapter can end on turn 1. |
| Two tiles share a `label`. | The log names tiles by label. |
| `attackFee` above starting copper plus one turn of income. | The first attack cannot be paid. |
| A stash on an objective. | Taking the objective ends the chapter; the stash is never searched. |
| A normal or hard tile with the Default reward. | Default is empty for those. |
| A tile with `mines: 0`. Stronger text on an owned tile. | It cannot be dug and pays nothing until upgraded. |
| A copper tile whose dig nets 0 copper or less. | True for every copper tile at 1 mine; shown so the choice is visible. Gesture tiles dig for items and are skipped. |
| A custom kit whose item total is above the next difficulty's kit or below the previous one. | The player picks targets by the difficulty label. |
| A custom kit with no gestures. | The NPC surrenders on its first turn. |

The bundled `chapter-i.json` has no errors. A test asserts that, and each row has one fixture.

## Editor

```
tools/campaign-editor/
  package.json  vite.config.ts  tsconfig.json  index.html  README.md
  routes/chapter-i.routes.json   reference routes, committed
  src/main.tsx
  src/model/document.ts          edited ChapterSettings, reducer, actions
  src/model/history.ts           undo and redo over actions
  src/model/serialize.ts         canonical JSON out, schema-checked JSON in
  src/model/derive.ts            effective reward and kit, rounds, income, dig yield and net, start view, reveal chain
  src/routes/walk.ts             runs a route on Campaign
  src/sim/simWorker.ts           Web Worker around simulateBattles
  src/map/hexLayout.ts
  src/map/HexMap.tsx
  src/panels/TilePanel.tsx  ChapterPanel.tsx  RulesPanel.tsx  InventoryPanel.tsx
  src/panels/RewardsPanel.tsx  RoutesPanel.tsx  ProblemsPanel.tsx  SimulationPanel.tsx
  src/components/StackEditor.tsx
  src/io/files.ts                open, drop, download, save to repo, local draft
  src/io/savePlugin.ts           Vite dev-server plugin behind Save to repo
```

`vite.config.ts` aliases `@apiv2` to `../../apiv2/src` and dedupes `zod`.

### Screen

```
+---------------------------------------------------------------------------------+
| Chapter I [Open] [Bundled] [Undo] [Redo]   2 errors 1 warning  [Save] [Export]   |
+--------------------------------------+------------------------------------------+
|                                      | Tile | Chapter | Rules | Inventory |      |
|            SVG hex map               | Rewards | Routes | Problems              |
|                                      |                                          |
|  brush: none | difficulty | product  |   form for the selected tab              |
|         | revealed | kit: Default    |                                          |
|  overlay: design | start view        |                                          |
+--------------------------------------+------------------------------------------+
```

Desktop only, minimum width 1100px.

### Map

Flat-top placement, the game's math (`x = size · 3/2 · q`, `y = size · (√3/2 · q + √3 · r)`), north up.

| Shown on a cell | Source |
|---|---|
| Fill | Difficulty. Owned tiles use the player color. |
| Glyph | St, Sc, Pa, C, then `mines/maxMines`. |
| Star | `objective`. |
| `s` / `r` / `k` | Stash; custom reward; custom defender kit. |
| Hatched | `revealed: false`. |
| Red / yellow outline | Error / warning on the tile. |

Click selects a cell. Shift-click adds to the selection; fields that differ show as mixed and are written only when changed. A multi-selection can apply one custom kit or reset kits to Default.

The brush paints one field across cells. One drag is one undo step.

The **start view** overlay shows owned, seen, and hidden at turn 0. Hovering a cell highlights the hidden cells its capture would reveal, so the reveal chain to the objective is visible.

### Tile tab

| Field | Control |
|---|---|
| Coordinate | Read-only. |
| Label | Text. Empty becomes `(q,r)` on export. |
| Owner | Neutral or Player. Player clears difficulty, algorithm, reward, and kit. Back to Neutral restores what the tile had earlier in this session, or easy, `npc-v1`, Default. |
| Product, Mines, Max mines | Select, integers. |
| Difficulty | easy, normal, hard. Hidden when owned. |
| Revealed, Objective | Checkboxes. Objective disabled when owned. |
| NPC algorithm | `npc-v1`, `npc-greed-v1`. Hidden when owned. |
| Reward | **Default** (inherited stack, read-only) or **Custom** (`StackEditor`). |
| Defender kit | **Default** (`defenderKits[difficulty]`, read-only) or **Custom**. Custom starts as a copy of the difficulty kit, not a link. A line shows the difference from the difficulty kit (`+3 scissors, −1 NA_effect_stone`) with **Reset to difficulty kit**. Changing difficulty keeps a custom kit; the line then compares with the new difficulty. Identical to the difficulty kit shows "same as the normal kit" and is still written. |
| Stash | None or one pile in `StackEditor`. |

Derived lines: income per turn (`mines × unitFor`), or "never pays: taking it ends the chapter" on an objective; dig yield and net (`DIG_TURNS × mines × unitFor − digCost`); rounds; the effective garrison.

**Simulation** (under the derived lines, not owned tiles): runs `simulateBattles` in the worker, debounced after each edit. Inputs: the effective kit, `rounds[difficulty]`, the tile's algorithm, N (200), and the player stack: starting items on a fee chapter, `battleKit` on a wager chapter, or a custom stack. Outputs: win rate, share that hit the 48-throw cap, average round wins, items spent (average and worst per key), garrison left after a loss, and the win rate of a second attack with the leftovers against that garrison. Labelled "autobattle, a floor for a careful player". Numbers only; never a problem, never blocks Export.

### Chapter, Rules, Inventory, Rewards tabs

- **Chapter:** `id` (read-only), `title`, `goal`, `rulesetVersion`.
- **Rules:** dig, search, and upgrade costs; battle entry with `attackFee` or `battleKit` (switching removes the other); `actionPointsPerTurn`; `economyConsumesActionPoint`; score weights; marketplace, one row per item key, **For sale** at a price of 1 or more or **Not for sale**. The marketplace is not a `StackEditor`. `DIG_TURNS` and the income units are read-only, "fixed by code".
- **Inventory:** starting inventory; per difficulty, the kit, the rounds, the number of tiles that use the kit by default, and the custom-kit tiles of that difficulty.
- **Rewards:** the easy reward per product.

`StackEditor` lists every item and currency key in fixed order, zero as empty, and writes only positive amounts.

### Routes tab

A route is a name and ordered steps: `attack (q, r)`, `search (q, r)`, `dig (q, r)`, `upgrade (q, r)`, `buy item amount`, `end turn`. `walk.ts` builds the definition with `buildChapterDefinition`, starts a `Campaign`, and applies each step with the real methods. An attack is won: `beginAttack`, `attachGame`, then `applyBattle` with `kind: 'win'` and every committed item returned. Item spend in battle is left out; this is the coin and turn economy the score is made of.

After each step: turn, copper, silver, owned tiles. A step the campaign rejects stops the walk and shows the server's message, for example "Not enough copper for the attack". At the end: the stored score object and its lines from `rules.scoreWeights`.

`routes/chapter-i.routes.json` holds the reference routes from [campaigns.md](./campaigns.md) and loads by default. Routes the designer adds live in the local draft. Every route re-runs on each edit, and the tab header shows how many fail.

A later option, not in this plan: play each attack as a seeded autobattle and retry a loss next turn, for a spread of turns and score per route.

### Problems tab

Errors first, then warnings. Clicking a row selects the tile or opens the tab that owns the path.

### Files

- **Bundled** loads the repo's `chapter-i.json`, imported at build time.
- **Open** and drag-and-drop read a local file. A file that fails the schema is not loaded; the issues are listed with paths.
- **Export** downloads `chapter-i.json`. Disabled while an error exists.
- **Save to repo** posts the canonical text to the dev-server plugin, which writes only `apiv2/src/domain/campaign/chapter-i.json` and re-checks it with the schema first. Present only under `vite dev`. Disabled while an error exists.
- The document and the designer's routes are saved to `localStorage` on each change and offered as **Resume draft**.

### Canonical output

Keys in the order of today's file. Tiles keep the loaded order. A tile writes `defenderKit` after `npcAlgorithmId`, only when Custom. Omitted at the default: `owner` when neutral, `objective` when false, `npcAlgorithmId` when `npc-v1`, `reward` and `defenderKit` when Default, `stash` when None. Stacks follow `ITEM_KEYS` and `CURRENCY_KEYS` order with zeros dropped, except `startingInventory` and `scoreWeights`, which keep every key. `marketplace` keeps every item for sale.

## Publishing and playtest

1. **Save to repo** (or Export and copy over the file). Review the diff.
2. `cd apiv2 && npm test`.
3. Playtest locally per [local_dev.md](./local_dev.md): `npm run dev` in `apiv2`, open the local client, and **Leave** any started Chapter I run, because a started run keeps its old copy.
4. Build, zip, and `terraform apply -target=module.lambda_api2.aws_lambda_function.main`.

Bump `rulesetVersion` when anything but a title, goal, or label changes.

## Slices

### Slice 1 — Schema, checks, kits (apiv2)

- `ChapterSettingsSchema`, `checkChapterSettings`, `ChapterDefinitionBuilder`, `defenderKit` on a tile, `DIG_TURNS`.
- Tests: the bundled file has no errors; one fixture per check row; `CHAPTER_I` deep-equal to the current build; a tile with `defenderKit` gets that garrison whole. Existing campaign tests pass.
- `campaigns.md`: a tile may name its own defender kit; Chapter I version 1 uses none.

### Slice 2 — Battle builder and simulator (apiv2)

- `buildBattleGame` used by `createBattle`. `simulateBattles` with pinned numbers for the gate and the citadel.
- `browserSafe.test.ts` over the four entry points.

### Slice 3 — Editor shell and round trip

- Vite project, alias, Vitest. Bundled, Open, Export, Save to repo, Problems tab, read-only map.
- Test: bundled file, parse, serialize, equals the source bytes.

### Slice 4 — Routes tab

- `walk.ts`, the reference routes file, the tab. It works on the loaded file without the editing panels, so it can check the open balance issue in [campaigns.md](./campaigns.md) first.
- Tests: on the bundled file, the bare rush scores 200; the south-stash route stops at the citadel attack with 6 copper.

### Slice 5 — Editing

- Reducer, undo and redo, `StackEditor`, all tabs, the marketplace rows, the Owner toggle restore, local draft.
- Tests: Owner to Player clears the four tile fields and back restores them; Default reward shows `easyRewards[product]`; a zero amount is not written; Not for sale omits the key; switching battle entry removes the other field.

### Slice 6 — Map tools

- Multi-select, brush, start view, reveal hover, outlines, `k` glyph, derived lines, kit usage on the Inventory tab.

### Slice 7 — Simulation panel

- Worker, debounce, the outputs above. Browser pass on the acceptance list.

## Acceptance

1. Bundled, then Export with no edits, gives a file identical to the repo's `chapter-i.json`.
2. On the bundled file, the Routes tab shows the bare rush at 200 and the south-stash route failing at the citadel attack with 6 copper.
3. Raising starting copper by 4 lets the south-stash route finish, and the version warning appears until `rulesetVersion` changes.
4. Setting the gate to hard shows `BO7` and the hard kit, and the cell fill changes.
5. Citadel `mines` above `maxMines` outlines it red, lists the error, and disables Export and Save.
6. Clearing a marketplace price marks the item Not for sale and omits the key. Entering 0 is an error.
7. `actionPointsPerTurn` 0 is an error; 2 is a warning.
8. A custom kit on the gate is written as `defenderKit`, shows `k`, and its difference line updates when the normal kit changes.
9. The simulation for the bundled gate matches the pinned apiv2 test.
10. Default to Custom and back on a reward or kit writes no key.
11. Brushing `difficulty: normal` across three cells is undone in one step.
12. A file with an unknown item key fails to open and names the path.
13. A saved file passes `npm test` in `apiv2`, and a new local run shows the edited numbers.

## Docs

- `tools/campaign-editor/README.md`: run, routes, simulation, save, playtest, publish.
- `DOCUMENTATION_INDEX.md`: link to that README and this plan.
- `campaigns.md`: per-tile defender kit (Slice 1).
- No API change and no AWS resource, so `API_DOCUMENTATION.md` and `INFRASTRUCTURE_OVERVIEW.md` stay as they are.
