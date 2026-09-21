# Extended game UI schema

Panel names and on-screen layout for [`ExtendedGameScene`](js/scenes/ExtendedGameScene.js). Canvas is always **390×844**. Switch layout with `?layout=thumb|balanced|arena`. Default is **Thumb**.

Classic game uses the same panel set and the same three layouts, except **EffectsPanel** (extended only).

## All panel names

| Panel | Function | What it shows |
|---|---|---|
| **HudPanel** | `createHudPanel` | Player name · VS · Enemy name, plus scores/rounds below |
| **CharactersPanel** | `createCharactersPanel` | Player name · VS · Enemy name (names only) |
| **StagePanel** | `createStagePanel` | Last completed subround: your move, result, enemy move |
| **StatusCard** | `createStatusCard` | Outer frame around the status text |
| **GameResultsPanel** | `createGameResultsPanel` | Outer frame around scores + rounds |
| **PlayerScorePanel** | `createPlayerScorePanel` | Label `PLAYER` + score |
| **EnemyScorePanel** | `createEnemyScorePanel` | Label `ENEMY` + score |
| **RoundsResultPanel** | `createRoundsResultPanel` | Label `ROUNDS` + round tiles |
| **RoundResultPanel** | `createRoundResultPanel` | One finished/in-progress round tile |
| **PlaceholderRoundPanel** | `createPlaceholderRoundPanel` | Empty future round tile |
| **CurrentMovePanel** | `createCurrentMovePanel` | Pending pick (READY) / status / waiting opponent (NEXT); extended also nests EffectsPanel |
| **MainPanel** | `createMainPanel` | Status text (`Loading match...`, `STONE 1 ready — tap GO`, …) |
| **SidePlaceholder** | `createSidePlaceholder` | READY = move you will send; NEXT = `…` until GO |
| **EffectsPanel** | `createEffectsPanel` | Extended only. Label `EFFECTS` + four buttons (`NEG` / `OVER` / `PROT` / `SIZE`) that set `effects[]` |
| **ThumbPlayPanel** | `createThumbPlayPanel` | GO, STONE/SCISSORS/PAPER, CANCEL, BACK |
| **TwoRowActionPanel** | `createTwoRowActionPanel` | CANCEL + GO on top, three moves below |
| **GridActionPanel** | `createGridActionPanel` | 2×2 move grid + CANCEL |

## StagePanel

Shown in every layout, between the HUD / results strip and the current-move / status area. After **GO** returns and the subround is calculated, it shows only the **last completed subround**:

- **YOU** — your move (`Stone 5` in extended; type only in classic)
- **STAGE** — `YOU WIN` / `ENEMY WINS` / `DRAW` (the subround winner; that is also the round winner unless the subround was a draw)
- **ENEMY** — opponent move

Before the first completed subround it shows `WAIT`. If a draw opens a new empty subround, the panel keeps the draw until the next subround finishes.

## Default: Thumb (`hud-status-play`) — 18% / 14% / 16% / 52%

```
┌─────────────────────────────────────────┐
│ HudPanel                          18%   │
│  Player          VS          Enemy      │
│ ┌──────┐ ┌─────────────────┐ ┌──────┐   │
│ │PLAYER│ │ RoundsResult    │ │ENEMY │   │
│ │Score │ │  [1] [2] [3]…   │ │Score │   │
│ └──────┘ └─────────────────┘ └──────┘   │
├─────────────────────────────────────────┤
│ StagePanel                        14%   │
│ ┌────────┐ ┌─────────────┐ ┌────────┐   │
│ │ YOU    │ │ STAGE       │ │ ENEMY  │   │
│ │ Stone 5│ │ YOU WIN     │ │ Scis 3 │   │
│ └────────┘ └─────────────┘ └────────┘   │
├─────────────────────────────────────────┤
│ StatusCard                        16%   │
│   ┌───────────────────────────────┐     │
│   │ MainPanel                     │     │
│   │  "Pick Stone, Scissors,       │     │
│   │   or Paper"                   │     │
│   └───────────────────────────────┘     │
│   ┌───────────────────────────────┐     │
│   │ EffectsPanel (extended)       │     │
│   │ EFFECTS [NEG] [OVER] [PROT] [SIZE] │     │
│   └───────────────────────────────┘     │
├─────────────────────────────────────────┤
│ ThumbPlayPanel                    52%   │
│                                         │
│         ┌─────────────────────┐         │
│         │        GO           │         │
│         └─────────────────────┘         │
│         ┌──────┬──────┬──────┐          │
│         │STONE │SCISS.│PAPER │          │
│         └──────┴──────┴──────┘          │
│         ┌──────────┬─────────┐          │
│         │  CANCEL  │  BACK   │          │
│         └──────────┴─────────┘          │
└─────────────────────────────────────────┘
```

HudPanel **contains** PlayerScorePanel + RoundsResultPanel + EnemyScorePanel.  
StatusCard **contains** MainPanel, plus EffectsPanel in extended.

## Balanced (`four-panel`) — 10% / 12% / 14% / 18% / 46%

```
┌─────────────────────────────────────────┐
│ CharactersPanel                   10%   │
│ [BACK]  Player      VS      Enemy       │
├─────────────────────────────────────────┤
│ GameResultsPanel                  12%   │
│ ┌──────┐ ┌─────────────────┐ ┌──────┐   │
│ │PLAYER│ │ RoundsResult    │ │ENEMY │   │
│ │Score │ │  [1] [2] [3]…   │ │Score │   │
│ └──────┘ └─────────────────┘ └──────┘   │
├─────────────────────────────────────────┤
│ StagePanel                        14%   │
│ ┌────────┐ ┌─────────────┐ ┌────────┐   │
│ │ YOU    │ │ STAGE       │ │ ENEMY  │   │
│ │ Stone 5│ │ YOU WIN     │ │ Scis 3 │   │
│ └────────┘ └─────────────┘ └────────┘   │
├─────────────────────────────────────────┤
│ CurrentMovePanel                  18%   │
│ ┌────────┐ ┌─────────────┐ ┌────────┐   │
│ │ READY  │ │ MainPanel   │ │ NEXT   │   │
│ │ Stone 5│ │  status     │ │   …    │   │
│ └────────┘ └─────────────┘ └────────┘   │
│ ┌───────────────────────────────────┐   │
│ │ EFFECTS  [ NEG ] [ OVER ] [ PROT ] [ SIZE ] │   │
│ └───────────────────────────────────┘   │
├─────────────────────────────────────────┤
│ TwoRowActionPanel                 46%   │
│                                         │
│   ┌──────────────────┐ ┌────┐           │
│   │     CANCEL       │ │ GO │           │
│   └──────────────────┘ └────┘           │
│   ┌────────┬─────────┬────────┐         │
│   │ STONE  │ SCISSORS│ PAPER  │         │
│   └────────┴─────────┴────────┘         │
└─────────────────────────────────────────┘
```

## Arena (`hud-arena-grid`) — 12% / 14% / 38% / 36%

```
┌─────────────────────────────────────────┐
│ HudPanel                          12%   │
│ [BACK] Player      VS      Enemy        │
│ ┌──────┐ ┌─────────────────┐ ┌──────┐   │
│ │PLAYER│ │ RoundsResult    │ │ENEMY │   │
│ │Score │ │  [1] [2] [3]…   │ │Score │   │
│ └──────┘ └─────────────────┘ └──────┘   │
├─────────────────────────────────────────┤
│ StagePanel                        14%   │
│ ┌────────┐ ┌─────────────┐ ┌────────┐   │
│ │ YOU    │ │ STAGE       │ │ ENEMY  │   │
│ │ Stone 5│ │ YOU WIN     │ │ Scis 3 │   │
│ └────────┘ └─────────────┘ └────────┘   │
├─────────────────────────────────────────┤
│ CurrentMovePanel                  38%   │
│ ┌────────┐ ┌─────────────┐ ┌────────┐   │
│ │ READY  │ │ MainPanel   │ │ NEXT   │   │
│ │ Stone 5│ │  status     │ │   …    │   │
│ └────────┘ └─────────────┘ └────────┘   │
│ ┌───────────────────────────────────┐   │
│ │ EFFECTS  [ NEG ] [ OVER ] [ PROT ] [ SIZE ] │   │
│ └───────────────────────────────────┘   │
├─────────────────────────────────────────┤
│ GridActionPanel                   36%   │
│                                         │
│         ┌─────────┬─────────┐           │
│         │  STONE  │ SCISSORS│           │
│         ├─────────┼─────────┤           │
│         │  PAPER  │   GO    │           │
│         └─────────┴─────────┘           │
│         ┌───────────────────┐           │
│         │      CANCEL       │           │
│         └───────────────────┘           │
└─────────────────────────────────────────┘
```

## Nesting (shared pieces)

```
HudPanel / GameResultsPanel
 ├── PlayerScorePanel     (left,  label PLAYER)
 ├── RoundsResultPanel    (center, label ROUNDS)
 │    ├── RoundResultPanel × N        (played)
 │    └── PlaceholderRoundPanel × N   (not yet)
 └── EnemyScorePanel      (right, label ENEMY)

StagePanel
 ├── YOU move box         (left)
 ├── STAGE result box     (center)
 └── ENEMY move box       (right)

CurrentMovePanel
 ├── SidePlaceholder READY    (left, pending move)
 ├── MainPanel                (center, status text)
 ├── SidePlaceholder NEXT     (right, … until GO)
 └── EffectsPanel             (extended only; NEG/OVER/PROT/SIZE)

StatusCard (Thumb)
 ├── MainPanel
 └── EffectsPanel             (extended only)

EffectsPanel is a multi-select of move effects. Tap a button to add that kind; tap again to clear it. Tapping a second size effect (NEG vs OVER) or type effect (PROT vs SIZE) replaces the first. Classic never shows it and always sends `effects: []`. `decorId` stays 0.

StagePanel is the last resolved subround. CurrentMove READY/NEXT is the pending pick, not the result.
```

Panels are stacked full-width from top to bottom. Nested score/side panels sit left-to-right inside their parent.

Layout fractions live in [`js/frameSize.js`](js/frameSize.js) (`UI.layouts`). Shared panel code lives in [`js/scenes/GamePlayScene.js`](js/scenes/GamePlayScene.js).

## TestsScene

Hub from the menu **UI TESTS** button. Not a play layout. Buttons: **UI EDITOR**, **UI PLAZMA BALL**, **HOT MAP BALL**, **ROTATED HOT MAP BALL**, **MOVE HOT ROD**, **MOVE HOT CIRCLE**, **BACK**.

## UIEditorScene

Sandbox from Tests **UI EDITOR**. Not a play layout. Canvas is the Tests width **780×844**.

```
┌──────────────────┬──────────────────┐
│ STAGE            │ EFFECTS          │
│ UiHeatMap        │ DIFFUSE / COOL   │
│ + UiHotBall ×3   │                  │
│ + UiHotRod ×3    │                  │
├──────────────────┼──────────────────┤
│ OBJECTS          │ PROPS            │
│ Hot Ball 1–3     │ ball: HEAT / GEO │
│ Hot Rod 1–3      │ rod: HEAT / GEO  │
└──────────────────┴──────────────────┘
```

| Panel | Function | What it shows |
|---|---|---|
| **STAGE** | `createEditorPanel` + `new UiHeatMap` | One shared heat field ([`UiHeatMap`](js/ui/UiHeatMap.js) / `attachRotatedHeatField`). Three [`UiHotBall`](js/ui/UiHotBall.js) and three [`UiHotRod`](js/ui/UiHotRod.js) emitters stamp into it. Tap moves the **selected** object (orbit a ball, slide a rod along its normal). |
| **EFFECTS** | `UiHeatMap.createEffectsEditor` | **HEAT**: DIFFUSE, COOL. **VIEW**: shared 3/4 camera (VIEW X/Y/Z) applied after each ball’s own plane tilts. Bottom **PLAY** / **STEP** / **STOP**. |
| **OBJECTS** | `createObjectsList` | Select **Hot Ball 1–3** or **Hot Rod 1–3**. Bottom **SAVE** downloads a timestamped JSON preset to Downloads; **LOAD** opens a file chooser. |
| **PROPS** | `UiPropEditor` on selected object | **Ball**: **HEAT** VISIBLE, DOT SIZE, DOT HEAT. **GEO** ANG SPEED, PHASE, RADIUS, CENTER X/Y, TILT X/Y/Z. **Rod**: **HEAT** VISIBLE, LINE HEAT. **GEO** THICKNESS, NOISE, GRAIN, FLICKER. **MOVE** SPEED, DELAY (hold at end, seconds), GAP (hold at start after snap, seconds), START/END X% Y% (−200 to 200, panel = 100%), START ANG, END ANG. The rod eases start pose → end pose, waits DELAY, snaps to start, waits GAP, then repeats. Tap Stage sets the selected rod’s end point. |

BACK under the grid returns to Tests.

## UITestScene

Sandbox from Tests **UI PLAZMA BALL**. Not a play layout.

| Panel | Function | What it shows |
|---|---|---|
| **TestPanel** | `createTestPanel` | Deep blue field with a moving yellow plasma ball (`attachPlasmaBall`). Tap to orbit around that point (radius = 3 ball sizes). The orbit center eases to the new tap so the ball flies. |

BACK under the panel returns to Tests.

## HotMapBallScene

Sandbox from Tests **HOT MAP BALL**. Not a play layout.

| Panel | Function | What it shows |
|---|---|---|
| **TestPanel** | `createTestPanel` | Starts black. Tap drops a hot dot (`attachHeatMap`). Heat diffuses into neighboring pixels; hotter cells are brighter (black → red → yellow → white). |
| **SettingsPanel** | `createSettingsPanel` | Live **− / +** steppers: **DIFFUSE** (spread), **COOL** (fade), **DOT SIZE** (click radius), **DOT HEAT** (click energy). Changes apply to the running field immediately. |

BACK under the panel returns to Tests.

## RotatedHotMapBallScene

Sandbox from Tests **ROTATED HOT MAP BALL**. Not a play layout.

| Panel | Function | What it shows |
|---|---|---|
| **TestPanel** | `createTestPanel` | Heat field with a moving hot ball (`attachRotatedHeatMap`). The ball wanders until a tap, then orbits that point in a plane tilted with **TILT X / Y / Z** (path looks like an ellipse). The orbit center eases like plasma. Heat trails from the path. |
| **SettingsPanel** | `createSettingsPanel` | Two tabs. **HEAT**: DIFFUSE, COOL, DOT SIZE, DOT HEAT. **GEO**: ANG SPEED, RADIUS, TILT X, TILT Y, TILT Z (degrees). Live **− / +** steppers. |

BACK under the panel returns to Tests.

## MoveHotRodScene

Sandbox from Tests **MOVE HOT ROD**. Not a play layout.

| Panel | Function | What it shows |
|---|---|---|
| **TestPanel** | `createTestPanel` | Heat field with a hot line (`attachHotRod`). The rod looks infinite: it always spans the panel. A tap eases it along the direction **orthogonal to ANGLE**. **ANGLE** rotates it in the view plane. Heat trails as it moves. Emission along the rod is noisy. |
| **SettingsPanel** | `createSettingsPanel` | Two tabs. **HEAT**: DIFFUSE, COOL, LINE HEAT. **GEO**: THICKNESS, ANGLE (2D degrees), SPEED, NOISE, GRAIN, FLICKER. Live **− / +** steppers. |

BACK under the panel returns to Tests.

## MoveHotCircleScene

Sandbox from Tests **MOVE HOT CIRCLE**. Not a play layout.

| Panel | Function | What it shows |
|---|---|---|
| **TestPanel** | `createTestPanel` | Heat field with a hot **ring** (`attachHotCircle`). A tap eases the center to the tap. **TILT X / Y / Z** rotate the circle's plane in 3D (path looks like an ellipse). |
| **SettingsPanel** | `createSettingsPanel` | Three tabs. **HEAT**: DIFFUSE, COOL, CIRCLE HEAT, NOISE, GRAIN, FLICKER. **GEO**: RADIUS, THICKNESS, TILT X, TILT Y, TILT Z (degrees), SPEED. **WIND**: FORCE, DIR (degrees, 0 = right), GUST (curl-noise swirls and drifting vortices), X SPEED (scrolls the whole field horizontally; wraps). Live **− / +** steppers. |

BACK under the panel returns to Tests.

