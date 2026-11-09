# Slim inventory panels

Status: implemented.

Both storage bands on the advanced match (`BlitzGameScene`) become half as tall. Player and enemy stay twins. Effect dots pack into two columns so they still read at that height. Gesture rectangles stay three columns of 21 and come out one heat cell tall.

No API change. No new heat composite. `amountIndicatorMeasure` stays as it is. `GamePlayScene`, `ExtendedGameScene`, and the campaign map stay as they are.

## Stage

`localAdvancedPanelBoxes` stacks five full-width bands on the 390×844 stage. Shares sum to 1. The heat cell is 3px (`ROTATED_HEAT_CELL_PX`).

| Band | Share now | px now | Share | px | Role |
|---|---|---|---|---|---|
| `score` | 0.10 | 84 | 0.10 | 84 | Unchanged. |
| `enemy_inventory` | 0.15 | 127 | 0.075 | 63 | Half of today's band. Same four panels. |
| `enemy_data` | 0.25 | 211 | 0.40 | 338 | Reveal. Takes the 127px the two bands give up. |
| `current turn` | 0.35 | 295 | 0.35 | 295 | Unchanged. The button stack needs 290px. |
| `inventory` | 0.15 | 127 | 0.075 | 63 | Same height as the enemy band. |

Child panels stay 0.3 / 0.3 / 0.3 / 0.1 of the band. On 390px that is still 117 / 117 / 117 / 39. Only the height changes.

The enemy stone's `orbitRadius` stays 32 (about 192px across). The reveal grows from 211px to 338px, so the cluster has about 73px of margin on each side. Player composites still spawn on the bottom edge of `inventory` and center in `current turn`. Enemy composites still spawn on the bottom edge of `enemy_inventory` and center in `enemy_data`.

## Why the slot stack has to give up the label

Today each storage panel reserves 26px for a wrapped frame title and 8px of bottom pad. The slots get the rest: 93px, about 30.7 cells.

A half band is 63px. Leaving that 34px of chrome would leave 29px (9.7 cells) for the slots. Eight effect rows squeezed into two columns is four rows, and four rows in 9.7 cells draw a 1-cell dot (3px). Today's NA dots are already only 2.1 cells (6px). They would disappear.

So the frame title becomes one line, and the pad shrinks:

| | Now | Plan |
|---|---|---|
| `labelReserve` | 26 | 14 |
| bottom pad | 8 | 4 |
| slot height | 93px, 30.7 cells | 45px, 15.0 cells |

The visible title is the campaign word, one line, 10px, at the top of the frame: Stone, Scissors, Paper, Core. The enemy band uses the same four words. The box labels stay `stone_storage_panel`, `enemy_stone_storage_panel`, and the rest, so tests and `pushInventoryStoragePanels` keep their ids. `fitInventoryPanelLabels` still hides the band titles and, after it finds each frame title by that id, sets the shown string to the short word. "Core" fits the 39px NT panel. A wrapped `enemy_stone_storage_panel` does not fit in 14px.

Both frame helpers (`stoneStorageIndicatorFrames`, `ntEffectsIndicatorFrame`) read the same two constants.

## Rectangles

Gesture items stay 21 slots, 3 columns, 7 rows, `desc`, `rectangle`. The left frame stays 45% of the panel (53px, 17.4 cells). Column width stays 4.0 cells (12px).

The measurer pins piece height at 1 cell whenever a stack is between `rows` and `rows + 2 * (rows - 1)` cells. For 7 rows that band is 7 to 19 cells. The new stack is 15 cells, so each rectangle is 1 cell tall (3px). Today it is 2.67 cells (8px). Width does not change: the bars go from 12×8 to 12×3.

That is as tall as this measurer will draw seven rows inside a half band. A strict half of today's 8px would need a 21-cell stack (64px of slots), and the band would be about 88px again. This plan keeps the half band.

## Dots

`GESTURE_EFFECT_INDICATOR_COLUMNS` and `NT_EFFECT_INDICATOR_COLUMNS` go from 1 to 2. Caps, direction, and shape stay. Create and `syncTableAmountIndicator` already share those constants, so player and enemy both update, including a refresh after a throw.

| Table | Max | Columns | Rows | Direction | Shape |
|---|---|---|---|---|---|
| Stones, Scissors, Papers | 21 | 3 | 7 | `desc` | `rectangle` |
| NA Stones, NA Scissors, NA Papers | 8 | 2 | 4 | `asc` | `round` |
| NT Effects | 6 | 2 | 3 | `asc` | `round` |

Index 0 still fills the left column from the top (`asc`) or the bottom (`desc`). The next indexes finish that column, then the column to its right. For NA, indexes 0–3 are the left column and 4–7 the right. For NT, indexes 0–2 are the left column and 3–5 the right.

On the 15-cell stack, four rows draw a 2.3-cell piece (7px). Today's NA dot is 2.1 cells, so the dot stays about the same size. The right frame has to be wide enough that the disk is limited by that height. It widens from 15% of the panel (18px, one skinny column) to 24% (28px). Two columns there are 4 cells wide, the round uses the 2.3-cell height, and the gap between the rectangle table and the dots shrinks from 31px to about 28px. The tables do not overlap.

The NT frame stops using half of the inner width. It uses the full inner width (31px once the pad is 4) so two columns have 4 cells each. Three rows on the 15-cell stack also give a 4-cell piece, so the Core dots stay about 12px, which is today's size.

## Files

- `site/html5Simple/js/scenes/BlitzGameScene.js` — band shares, the two frame constants, effect column constants, the wider NA frame, the full-width NT frame, the short frame titles, and the header comment (three columns of rectangles, two columns of NA rounds, two columns of NT rounds).
- `tests/html5Simple/stone-storage-indicator.test.js` — column counts, the NA frame width, the NT frame width, and the NT column split.
- `tests/html5Simple/enemy-storage-indicator.test.js` — the same column counts on the enemy tables, plus the band height.

`SCENES.md` already says the enemy stock is the same storage tables as the player inventory. That sentence stays. No new `<script>` tag. Idle goldens stay bit-identical: stamp math does not change.

## Tests

`npm test` in `tests/html5Simple`.

Layout, on 390×844:

- `inventory` height and `enemy_inventory` height are both `844 * 0.075`, and they are equal.
- The four enemy child panels match the four player child panels in width and height.
- `enemy_data` begins where `enemy_inventory` ends, and its height is `844 * 0.40`.
- `current turn` height is unchanged (`844 * 0.35`).

Indicators, built on those real boxes:

- Each gesture table is still an `HmVerticalTableAmountIndicator`, max 21, 3 columns, `desc`, `rectangle`. The first slot's height is 1 cell and its width is still about 4 cells.
- Each NA table is max 8, 2 columns, `asc`, `round`. Indexes 0 and 1 share a column. Index 4 is to the right of index 0.
- The NT table is max 6, 2 columns, `asc`, `round`. Indexes 0 and 2 share a column. Index 3 is to the right of index 0.
- The NA frame width is 24% of the storage panel. The NT frame width is the panel width minus the pad on both sides.
- Stored and selected behaviour is unchanged: the advanced start fills stored, a player pick lights only the player tables, and every enemy `selected` stays 0.

## Browser

Static server at `site/html5Simple`, API with `SKIP_AUTH=true`. Open Blitz and follow [html5-scene-check](../../.cursor/skills/html5-scene-check/SKILL.md).

- Before the first throw, both bands show the advanced start. Rectangles are flat bars in three columns. NA dots are two columns of four. Core dots are two columns of three. Frame titles read Stone, Scissors, Paper, Core, on one line, and the slots sit under that line.
- Adding a player stone lights only the player stone table.
- After GO, the NPC count for the thrown gesture drops, and the enemy tables stay unselected.
- The enemy stone, scissors, and paper sit inside `enemy_data` and do not cover either band. The move readout stays readable at the top-left of `enemy_data`.
- Score, the current-turn buttons, and both bands still draw. BACK still returns to Choose a game.
