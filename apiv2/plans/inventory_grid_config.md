# Configurable inventory grids

Status: implemented.

The Blitz storage tables take columns and rows. The slot cap is their product. Player and enemy each have a grid, set when `BlitzGameScene` starts. The default matches the picture that shipped: items 4×6 (cap 24), NA effects 2×4 (cap 8), Core 2×3 (cap 6).

No match API change. Stock, turn caps, and surrender stay as they are. `GamePlayScene`, `ExtendedGameScene`, and the campaign map stay as they are.

## Why the cap is the product

The old item cap was 21 in 4 columns, so the last column was three slots short. 4×6 completes that column. Six rows is what those 21 slots already occupied, so the default bar size stays. A fresh extended match still starts at 21 stones, and the three new slots stay cold. NA 2×4 and Core 2×3 were already full rectangles.

## Scene init

`BlitzGameScene.init` reads `data.inventoryGrids`. A missing side or a missing table keeps that side's default. A table is kept only when `columns` and `rows` are both integers from 1 to 12 and their product is at most 64. Anything else falls back to that table's default.

```js
fxGoTo(this, 'BlitzGameScene', {
  inventoryGrids: {
    player: { items: { columns: 4, rows: 6 } },
    enemy: { items: { columns: 5, rows: 4 }, na: { columns: 2, rows: 3 } }
  }
});
```

Lobby and campaign pass no grid. The tables are built in `create()`, before the match payload returns, so this stays on the scene and not on the game record.

## Component

`HmVerticalTableAmountIndicator` takes `rows` beside `columns`. When `rows` is set, `maxAmount` is `columns * rows` and the parts are rebuilt. Setting either one recomputes that cap. Callers that pass only `maxAmount` keep today's cap, and the editor still derives the row count from it. The composite editor place tab has a ROWS field.

Inventory tables set `fitGap: 2`. `layoutAmountTable` passes that into `amountIndicatorMeasure` instead of the shared 10-cell gap aim, so the pieces take the rest of the frame. The editor Amount Table does not set `fitGap`.

Frame geometry is unchanged. The items slice, the 24% NA slice, and the Core frame stay. Band shares stay 0.075. A denser grid draws smaller marks in the same frame.

## Tests

`npm test` in `tests/html5Simple`.

- Default item tables are 4 columns, 6 rows, cap 24. NA stays 8. Core stays 6.
- A scene init can give the player one item grid and the enemy another. Omitted NA and Core tables stay on the default. A bad table falls back.
- An inventory table with `fitGap: 2` and two columns fills its width with a 2-cell gap. A table without `fitGap` still aims at a 10-cell gap.
