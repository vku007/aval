# Heat UI reference

## File order

In `site/html5Simple/index.html`, after `js/fx/HotCircleFx.js` and before `js/ui/UiPropEditor.js`:

```
js/heat/anim/easing.js
js/heat/anim/channels.js
js/heat/anim/definitions.js
js/heat/anim/run.js
js/heat/anim/animator.js
js/heat/anim/library/blocks.js
js/heat/behaviours/behaviours.js
js/heat/node/HeatNode.js
js/heat/node/HeatItem.js
js/heat/node/HeatComposite.js
js/heat/node/registry.js
js/heat/composites/stone.js
js/heat/composites/scissor.js
js/heat/composites/paper.js
js/heat/composites/diskStack.js
js/heat/composites/cross.js
```

Editor classes stay in `js/ui/` and register composites at the bottom of each file. One global class or factory per file. Split a file past about 400 lines.

## Classes

```
HeatNode          attach, detach, play, cancelAll, reset, tick
├─ HeatItem       behaviours, stamp, translate, copyBehaviourState
│  ├─ UiHotBall        Orbit, Follow (editor taps)
│  ├─ UiHotRod         PathLoop
│  ├─ UiBackHighlighter, UiShard, UiPointer, UiRound    PoseCycle
│  ├─ UiSheet          PoseCycle, Glisten, BallRunner
│  └─ UiNewSheet       DiskLoop, Spin
└─ HeatComposite  items, template, layout, transitions
   ├─ HotMapUiStone       kind hot-map-stone, config stone
   ├─ HotMapUiScissor     kind hot-map-scissor, config scissor
   ├─ HotMapUiPaper       kind hot-map-paper, config paper
   ├─ HotMapUiNewPaper    kind hot-map-new-paper, config diskStack
   └─ HotMapUiCross       kind hot-map-cross, config cross
```

Aliases to keep: `UiHotBall`, `UiHotRod`, `UiBackHighlighter`, `UiShard`, `UiPointer`, `UiRound`, `UiSheet`, `UiNewSheet`, `HotMapUiStone`, `HotMapUiScissor`, `HotMapUiPaper`, `HotMapUiNewPaper`, `HotMapUiCross`, `HorisontalPulse`, `VerticalPulse`, `VictoryPulse`.

Behaviours in `js/heat/behaviours/behaviours.js`: `Orbit`, `Follow`, `PathLoop`, `PoseCycle`, `Glisten`, `CornerGlisten`, `BallRunner`, `DiskLoop`, `Spin`. Each has `reset()`, `advance(dt)`, `copyStateFrom(other, shift)`.

## Stamp

Rendered value = fields, then behaviour state, then the item's combined channels, then the parent's group channels (`offset`, `rotate`, `scale`, `heat` about the composite center).

Field tick:

1. Diffuse.
2. Advance each node: behaviour, then runs.
3. Stamp.
4. Flush deferred adds and removes.
5. Paint.

`attachRotatedHeatField` registers `scene.events.once('shutdown', field.destroy)`. Destroy detaches every root and resolves pending `finished` promises with `cancelled`. `call` hooks do not fire after destroy.

## Channels

Identity leaves the stamp unchanged. Each run stores its own contribution.

| Channel | Combine | Identity | Used by |
|---|---|---|---|
| `offset` `{col,row}` | add | `{0,0}` | all |
| `rotate` | add | `0` | all. In-plane tumble for a shard |
| `tiltX`, `tiltY` | add | `0` | shard. Screen-axis tumble. `0` leaves the stamp unchanged |
| `scale` | multiply | `1` | all |
| `heat` | multiply | `1` | all. `0` hides |
| `phase` | add | `0` | HotBall |
| `clip` | multiply | `1` | HotRod. Scales a clip rect around its midpoint |
| `pose` | latest started | `0` | HeatRect. Overrides the pose cycle while held |
| `shape.heat`, `glisten.gain` | multiply | `1` | HeatSheet |
| `disk.heat`, `disk.scale` | multiply | `1` | HeatDisk |
| `balls.heat`, `balls.scale` | multiply | `1` | sheet and disk balls |
| `balls.offset` | add | `{0,0}` | sheet and disk balls |
| `balls.gather`, `balls.gatherAt` | latest started | `0`, point | `0` = balls in their slots, `1` = all at `gatherAt` |

Group channels on a composite shake or flash the set without writing item fields.

## Blocks and library

Blocks: `tracks`, `wait`, `set`, `call`, `sequence`, `parallel`, `stagger`.

Library: `move`, `grow`, `spin`, `fade`, `flash`, `shake`, `gather`, `pose`, `sweep`, `arc`, `stoneEnter`, `stoneSpread`, `stoneDrama`, `stoneShard`, `scissorEnter`, `scissorDrama`.

Eases: `linear`, `sine` (in-out), `expOut` (`k = 3`, scaled so `u = 1` lands on 1). Fly-in duration is `3 / speed` seconds. New Paper drama step duration is `100 / speed` seconds. Do not hardcode the rounded 0.11 and 0.63.

| Config | Item | Enter | Exit |
|---|---|---|---|
| `stone` | HotBall, even phases | `move` from `$spawn`, then `spread` on slot `layout`, fill `commit` | fade, then detach. Editor POP stops the ball, snaps scale to 2 and heat to 3, then three shards at 33% size keep some orbit speed in the opposite direction and fall under gravity. The balls that remain spread evenly, the same as on add |
| `scissor` | shard | `parallel(move from $spawn, grow from ~0, spin from -(360+$turn))` | fade, then detach. Editor POP freezes the shown pose, holds heat at 3, then fades it to 0 while the shard falls under gravity (`drop * u²`) and tumbles on X, Y, and Z |
| `paper` | HeatSheet, stacked by `stackGap` | pair / split / reveal. Waypoint is the previous sheet's spec pose | fade, then detach |
| `diskStack` | HeatDisk | `gather` 1→0 from `$spawn`, 1 s | instant. POP is still `drama`, then `call detach` |
| `cross` | two HeatRects and two shards on one center | placed. Highlighters step by `highlightTurn` (90). Shards step by `shardTurn` (90) plus `shardOffset` (45) | fade, then detach |

`reveal(count)` adds on a 0.32 s stagger. `clear()` plays each exit 0.32 s apart (`HEAT_COMPOSITE_CLEAR_GAP`, same as `LOCAL_ADVANCED_REMOVE_PAUSE`). `clear({ instant: true })` drops every item. An empty reveal or clear resolves `finished`. `hit` / `break` are group `shake` / `flash` on slot `react`.

`reset()` cancels runs, clears channels, resets behaviours, and lays out again. `reset({ items: 'spec' })` rebuilds the item count from `specCount`. LocalAdvanced boards use `specCount` 0.

`sweep` parks the rod on the end cell and moves `offset` from the start delta to `{0,0}`. Victory passes `clipFrom` so width lerps from the start width to the end width. Horizontal 1.5 s, vertical 1.5 s, victory 0.75 s.

Health loss is `pose` 0→1, fill `hold`. `reset()` parks the bar back. Menu hover is `pose` on slot `hover`, policy `replace`, from `'current'`.

## Editor adapter

Legacy tab keys stay (`fromWidth`, `newBallInit_radius`, `shardSpeed`, `spawnSpeed`, drama speed keys). `parts` is `[{ object }]`. ADD / REMOVE still call `addItem` / `removeItem`.

Resource JSON that must still load: `resources/stone-1.json`, `scissors-1.json`, `paper-1.json`, `new-paper-4.json`, `ui-editor-init.json`, `hotmap-1.json`. Saved item positions stay relative to the composite center.

## Scene waits

LocalAdvanced: `enemy.reveal(count)`, `heatFieldWait` for `LOCAL_ADVANCED_REVEAL_PAUSE` (5 s) and `LOCAL_ADVANCED_CLASH_PAUSE` (2 s), fight pulses in parallel, then `removeWithDrama()` on every loser item, each drama starting 0.33 s after the previous. When both moves are the same type, the winner's board also `removeWithDrama(loserCount)` with the same gap. Post-mortem and victory pulses follow. `playMoveResult` may stay async. It must return without touching objects when the captured field is destroyed. Abort the in-flight `gameClient.updateGame` / `createGame` / `getGame` from scene shutdown (`signal`).
