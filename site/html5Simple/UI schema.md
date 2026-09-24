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

## MenuScene

Main menu. Title **Sweet Adventure**. Bottom **SKIN** switch above the Layout/FX chips: **IN** fills the background with the heat-map preset in [`resources/ui-editor-init.json`](resources/ui-editor-init.json) (UiHeatMap + UiHotBall + UiHotRod + UiBackHighlighter) and punches the menu button labels through a black fill so the heat map shows in the letters. The seven visible highlights sit on LOGIN, REGISTER, LOGOUT, INVENTORY, START GAME, UI TESTS, and EXIT. **OFF** leaves the background blank (default) with outline buttons. The choice is stored in `localStorage`.

## TestsScene

Hub from the menu **UI TESTS** button. Not a play layout. Buttons sit in two columns. Left: **UI EDITOR**, **COMPOSITE UI EDITOR**, **UI PLAZMA BALL**, **HOT MAP BALL**, **ROTATED HOT MAP BALL**. Right: **MOVE HOT ROD**, **BACK HIGHLIGHT**, **MOVE HOT CIRCLE**, **BACK**.

## CompositeUIEditorScene

Copy of **UIEditorScene** opened from Tests **COMPOSITE UI EDITOR**. Same stage and tools layout. The tools canvas is [`CompositeUIEditorToolsScene`](js/scenes/CompositeUIEditorToolsScene.js). BACK returns to Tests.

## UIEditorScene

Sandbox from Tests **UI EDITOR**. Not a play layout. Two canvases. The stage canvas is the main game frame (**390×844**, same on-screen size and scale as the main screen). The tools canvas beside it holds **EFFECTS** above **PROPS**, with **OBJECTS** on the right.

```
┌────────────┬──────────────────┬──────────────────┐
│ STAGE      │ UI Editor        │ OBJECTS          │
│ 390×844    │ EFFECTS          │ name · type      │
│ UiHeatMap  │ DIFFUSE / COOL   │ COPY · DEL       │
│            │ PLAY / STEP / STOP│ SAVE · LOAD     │
│            ├──────────────────┤                  │
│            │ PROPS            │                  │
│            │ BACK             │                  │
└────────────┴──────────────────┴──────────────────┘
```

| Panel | Function | What it shows |
|---|---|---|
| **STAGE** | `new UiHeatMap` | Its own canvas, main-scene size **390×844**, same on-screen scale as the main screen. One shared heat field ([`UiHeatMap`](js/ui/UiHeatMap.js) / `attachRotatedHeatField`). Three [`UiHotBall`](js/ui/UiHotBall.js), three [`UiHotRod`](js/ui/UiHotRod.js), and two [`UiBackHighlighter`](js/ui/UiBackHighlighter.js) emitters stamp into it. Green frames ([`UiStageMarkup`](js/ui/UiStageMarkup.js)) outline the main-scene panels and buttons for the active layout, including the extended Effects row. **MENU** outlines the menu buttons, SKIN switch, and LAYOUT / FX chips. The frames are transparent and ignore taps. Tap moves the **selected** object (orbit a ball, slide a rod along its normal, or move a highlight center). |
| **EFFECTS** | `UiHeatMap.createEffectsEditor` | **HEAT**: **FRAMES** (ON/OFF green main-scene markup), **MENU** (ON/OFF green menu markup; starts OFF), DIFFUSE, COOL. **VIEW**: shared 3/4 camera (VIEW X/Y/Z) applied after each ball’s own plane tilts. Bottom **PLAY** / **STEP** / **STOP**. |
| **OBJECTS** | `createObjectsList` | Scrollable list of each object’s name and type (**Ball**, **Rod**, **Highlight**). Each row has **COPY** and **DEL**. **COPY** adds the same type with the same props, shifts **START X/Y** (rod) or **CENTER X/Y** (ball, highlight), and suffixes the name with **copy**. **DEL** removes that object. Click the row to show its props. Wheel or drag scrolls. Bottom **SAVE** / **LOAD** stay fixed. |
| **PROPS** | `UiPropEditor` on selected object | **Ball**: **HEAT** VISIBLE, DOT SIZE, DOT HEAT. **GEO** ANG SPEED, PHASE, RADIUS, CENTER X/Y, TILT X/Y/Z. **Rod**: **HEAT** VISIBLE, LINE HEAT. **GEO** THICKNESS, NOISE, GRAIN, FLICKER. **MOVE** SPEED, DELAY (hold at end, seconds), GAP (hold at start after snap, seconds), START/END X% Y% (−200 to 200, panel = 100%), START ANG, END ANG. The rod eases start pose → end pose, waits DELAY, snaps to start, waits GAP, then repeats. **Back highlight**: **FIELD** VISIBLE, CYCLING, SPEED, DELAY, GAP, CENTER X% Y%. **FROM** / **TO** WIDTH, HEIGHT, ANGLE, HEAT. It eases FROM → TO, pauses DELAY, eases back when CYCLING is on, pauses GAP, then repeats. Tap Stage sets the selected rod’s end point or the selected highlight’s center. |

BACK on the tools canvas returns to Tests and restores the Tests canvas width. The left box in the diagram is the stage canvas. EFFECTS, PROPS, OBJECTS, and BACK are the second canvas.

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

## BackHighlightScene

Sandbox from Tests **BACK HIGHLIGHT**. Not a play layout.

| Panel | Function | What it shows |
|---|---|---|
| **TestPanel** | `createTestPanel` | Heat field with a filled hot rectangle (`attachBackHighlight`). **WIDTH**, **HEIGHT**, **ANGLE**, and **HEAT** ease **FROM** → **TO**, pause **DELAY**, then ease back when **CYCLING** is on (or snap to **FROM** when it is off). **GAP** pauses at **FROM**. A tap eases the center to the tap. |
| **SettingsPanel** | `createSettingsPanel` | Three tabs. **FROM** / **TO**: WIDTH, HEIGHT, ANGLE, HEAT. **FIELD**: CYCLING (on/off), SPEED, DELAY, GAP, DIFFUSE, COOL. Live **− / +** steppers. |

BACK under the panel returns to Tests.

## MoveHotCircleScene

Sandbox from Tests **MOVE HOT CIRCLE**. Not a play layout.

| Panel | Function | What it shows |
|---|---|---|
| **TestPanel** | `createTestPanel` | Heat field with a hot **ring** (`attachHotCircle`). A tap eases the center to the tap. **TILT X / Y / Z** rotate the circle's plane in 3D (path looks like an ellipse). |
| **SettingsPanel** | `createSettingsPanel` | Three tabs. **HEAT**: DIFFUSE, COOL, CIRCLE HEAT, NOISE, GRAIN, FLICKER. **GEO**: RADIUS, THICKNESS, TILT X, TILT Y, TILT Z (degrees), SPEED. **WIND**: FORCE, DIR (degrees, 0 = right), GUST (curl-noise swirls and drifting vortices), X SPEED (scrolls the whole field horizontally; wraps). Live **− / +** steppers. |

BACK under the panel returns to Tests.

