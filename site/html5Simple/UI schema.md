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

Hub from the menu **UI TESTS** button. Not a play layout. Buttons: **UI PLAZMA BALL**, **HOT MAP BALL**, **BACK**.

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

