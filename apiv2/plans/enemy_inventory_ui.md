# Enemy inventory UI

Status: implemented.

The advanced match already returns the seated NPC row on `enemyContext.inventory` ([npc_inventory_enemy_panel.md](./npc_inventory_enemy_panel.md)). `BlitzGameScene` prints that row as three lines of text in a short `enemy_inventory` strip. This plan replaces those lines with the same storage tables the player inventory already uses.

No API change. No new heat composite. `GamePlayScene`, `ExtendedGameScene`, and the campaign map stay as they are. Coins stay in the payload and off this panel.

## Why the strip cannot hold the tables

On the 390×844 stage the heat field is about 3px per cell. The player band is share `0.15` (127px). Each gesture table reserves 26px for its label and 8px of pad, leaving about 93px for the slots. That is the size that already ships.

The NPC stone orbits at `orbitRadius` 40, about 240px across. Today's `enemy_data` band is share `0.365` (308px) and the text strip takes the top 67px of it. A second 127px band does not fit in that 308px beside a 240px stone.

## Stage

`localAdvancedPanelBoxes` stacks five full-width bands. Shares sum to 1.

| Band | Share | px | Role |
|---|---|---|---|
| `score` | 0.10 | 84 | Unchanged. Health bars and the score line. |
| `enemy_inventory` | 0.15 | 127 | Same height as the player band. Four storage panels. |
| `enemy_data` | 0.25 | 211 | Reveal only. Move readout and the NPC throw. |
| `current turn` | 0.35 | 295 | Player gesture and the button rows. Button stack needs 290px (control 82, effects 82, selection 102, pads). |
| `inventory` | 0.15 | 127 | Unchanged player band. |

`enemy_inventory` is a sibling band. It is no longer a rectangle pushed inside `enemy_data`.

`pushInventoryStoragePanels` takes a label prefix. The player call stays unprefixed (`stone_storage_panel`, `scissors_storage_panel`, `paper_storage_panel`, `NT_effects_panel`) at shares 0.3 / 0.3 / 0.3 / 0.1. The enemy call uses prefix `enemy_` and the same shares, so each enemy panel is the same size as its player twin.

Hide the `enemy_inventory` markup title the way the `inventory` title is hidden. Word-wrap the four `enemy_*` labels with the same fit used for the player labels.

The NPC composites spawn at the bottom center of `enemy_inventory` and center on `enemy_data`. The readout stays top-left of `enemy_data`: the `enemy_data` title at `y + 2`, the `you` / `enemy` / result text at `y + 16`, depth 1100, `UI.body`. Fight pulses and the result rod look up `enemy_data`, so they stay in the reveal and do not cross the tables.

The enemy stone's `orbitRadius` is 32. At about 3px per cell that is a 192px cluster, which sits inside the 211px reveal with a small margin. Set it on the enemy stone only, after `createLocalAdvancedComposite`. The player stone stays at 40. Scissors shards are 8 cells tall and the new-paper radius tops out at 30 cells, so both already fit the reveal; leave those presets. Confirm all three in the browser and lower an enemy preset only if that composite still crosses the tables.

## Indicators

Seven `HmVerticalTableAmountIndicator`s, built with the existing frame helpers (`stoneStorageIndicatorFrames`, `ntEffectsIndicatorFrame`, `heatMapIndicatorOptions`). Same caps, columns, direction, and shape as the player:

| Table | Max | Columns | Direction | Shape | Item key |
|---|---|---|---|---|---|
| Stones, Scissors, Papers | 21 | 3 | `desc` | `rectangle` | `stones`, `scissors`, `papers` |
| NA Stones, NA Scissors, NA Papers | 8 | 1 | `asc` | `round` | `NA_effect_stone`, `NA_effect_scissors`, `NA_effect_papers` |
| NT Effects | 6 | 1 | `asc` | `round` | `NT_effect` |

`enemyInventoryStorageSpec(moveType)` mirrors `inventoryStorageSpec` with enemy field names and labels:

- `enemyStonesIndicator` / `enemyStoneNaIndicator` — `Enemy Stones`, `Enemy NA Stones`
- `enemyScissorsIndicator` / `enemyScissorsNaIndicator` — `Enemy Scissors`, `Enemy NA Scissors`
- `enemyPapersIndicator` / `enemyPapersNaIndicator` — `Enemy Papers`, `Enemy NA Papers`
- `enemyNtEffectsIndicator` — `Enemy NT Effects`

`createStorageIndicators` already skips a missing count-text field, so the gesture pairs go through it. `createNtEffectsIndicator` gains a field-name argument and defaults to `ntEffectsIndicator`, so the player path stays. There is no enemy count text and no enemy selection highlight.

`syncEnemyStorageIndicators` reads `payload.enemyContext.inventory.items` through a sibling of `readInventoryItems`. `selected` is always 0. The NPC throw is the composite in `enemy_data`, not a picked slot. A missing inventory, a request still in flight, or a non-finite count stores 0 (every slot cold). Counts above the cap clamp, same as the player. `refreshEnemyStock` calls that sync. `refreshMatchReadout` already calls `refreshEnemyStock`.

Remove `enemyStockText`. The scene stops calling `CampaignLabels.npcStockLines`. Leave the helper and its campaign tests; the map does not use it.

`setAmount` already fades slot heat over 0.4s. No new transition, and no `scene.tweens`.

## Files

- `site/html5Simple/js/scenes/BlitzGameScene.js` — bands, indicators, sync, enemy stone orbit, header comment.
- `site/html5Simple/SCENES.md` — the Blitz row gains one sentence: the enemy stock is the same storage tables as the player inventory.
- `tests/html5Simple/enemy-storage-indicator.test.js` — new. Load `BlitzGameScene.js` the way `stone-storage-indicator.test.js` does, and export `localAdvancedPanelBoxes` and `enemyInventoryStorageSpec`.

No new `<script>` tag. The indicator classes are already on the page.

## Tests

`npm test` in `tests/html5Simple`.

Layout, on 390×844:

- `enemy_inventory` height equals `inventory` height.
- The four enemy child panels match the four player child panels in width and height.
- `enemy_data` begins where `enemy_inventory` ends.

Indicators, with an extended payload whose NPC row is the advanced start (21 / 12 / 12 / 3 / 2 / 5 / 3):

- Each table is an `HmVerticalTableAmountIndicator` with the max, columns, direction, and shape in the table above.
- `stored` is that start count. `selected` is 0.
- Filling the player stone and choosing `NegateSize` lights the player tables and leaves every enemy `selected` at 0.
- Replacing the NPC row with a smaller count updates `stored` and leaves `selected` at 0.
- A payload with no `enemyContext.inventory` stores 0 on every enemy table.
- The player sync cases in `stone-storage-indicator.test.js` still pass.

## Browser

Static server at `site/html5Simple`, API with `SKIP_AUTH=true`. Open Blitz and follow [html5-scene-check](../../.cursor/skills/html5-scene-check/SKILL.md): the canvas has no button refs, so read the live scene, then click.

- Before the first throw, the enemy tables show the advanced start and nothing is selected.
- Adding a player stone lights only the player stone table.
- After GO, the NPC count for the thrown gesture drops, and the enemy tables stay unselected.
- The enemy stone, scissors, and paper composites sit inside `enemy_data` and do not cover the enemy tables.
- The move readout stays readable at the top-left of `enemy_data`.
- Score, current-turn buttons, and the player band still draw.
