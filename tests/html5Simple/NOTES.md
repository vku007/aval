# Heat UI harness

Idle goldens for the heat objects in `site/html5Simple`. Slice 1a does not change `site/`.

## Commands

From the repo root:

```bash
cd tests/html5Simple
npm ci
npm test
```

Regenerate `goldens/idle.json` after an intentional change to idle stamp math:

```bash
cd tests/html5Simple
npm run goldens
```

`npm test` compares. `npm run goldens` writes the file (`UPDATE_GOLDENS=1`).

## What the golden is

- Field: 390×844, the same stage size `UiSkin` uses. Cell size is 3, so the grid is 130×281.
- Clock: 120 frames, `dt = 1000/60` ms, through `field.update` (diffuse, advance, stamp).
- Hash: SHA-256 of the `Float32Array` `field.src` bytes.
- Items: one `UiHotBall`, `UiHotRod`, `UiBackHighlighter`, `UiSheet`, `UiNewSheet`, each with its constructor defaults. `UiShard` is built with a skewed from/to pose, because the default pose has skew 0 and stamps the same rectangle as `UiBackHighlighter`.
- Composites: three items from `addItem`. `{ animate: false }` does not exist yet. Before the first hashed frame, enter state is parked at the pose those animations commit:
  - stone: finish `spread` so the phase commits, cancel `enter`, orbit center on the target, follow fields cleared
  - scissor: cancel the enter run (channels back to identity) and leave the shard center on the target
  - paper: travel stage `done`, hold released, glisten follows `glistenAfterMove`
  - new paper: `ballTravel` cleared
- The same setup in a second `vm` context must produce the same hashes.

## Manual checklist

Drive `site/html5Simple` in a browser. Confirm the action, not only the first frame.

- Composite editor: ADD, REMOVE, and POP (where that group has it) for stone, scissor, paper, and new paper.
- Menu: skin on, then skin off. Leave the menu and come back with the skin still on.
- A full Blitz game best-of-5 match.
- Leave Blitz game during `playMoveResult` (during the reveal wait, during a pulse, and during the staggered remove) and come back. The new visit should show no rods or disks left by the old chain.

## Cause of the rebinding guards

Phaser reuses the scene instance. `attachRotatedHeatField`'s shutdown handler destroys the view, the hit zone, and the texture. It leaves `balls`, `rods`, and `highlighters` on the old field object. Anything still stored on `this` keeps stamping that dead field.

`BlitzGameScene.create` increments `_visit`, nulls the six composites, and nulls the health bars, because a length check would keep those dead emitters. `syncSceneComposites` then builds new groups. It also runs every frame: `bindToField` puts parts back on the list, and `liveOn` failing rebuilds the group. `bindSceneHeatObjects` does the same re-add for `scene.balls`, `rods`, `highlighters`, `shards`, `sheets`, and the named groups. `MenuScene` does not call it. `menuSkinLive` remounts the skin when the host's heat map scene is not this scene, or when an item is missing from the field. `create` sets `skinHost = null` first, so a restart remounts from that, and a skin toggle off only calls `setVisible(false)`.

Seven sandboxes call `bindSceneHeatObjects` with a standalone `attachHeatMap` / `attachRotatedHeatMap` / `attachHotRod` / `attachBackHighlight` / `attachSheet` / `attachHotCircle` field (`HotMapBallScene`, `RotatedHotMapBallScene`, `MoveHotRodScene`, `BackHighlightScene`, `ShardScene`, `SheetScene`, `MoveHotCircleScene`). Those scenes do not keep the lists the binder walks, so the call does nothing. The three callers that use `UiHeatMap` are `UIEditorScene`, `CompositeUIEditorScene`, and `AlterSheetScene`. Their `create` methods already build new objects and register them. The binder matters there only if an object stays on the scene after it has been removed from the field list. The harness covers that re-add, and the no-op sandbox case.

### What leaving mid-sequence actually does

Checked against Phaser 3.70.0 (`Clock.shutdown`, `TimerEvent.destroy`, `TweenManager.killAll`, `BaseTween.destroy`):

- An in-flight `this.time.delayedCall` is destroyed by clearing its callback. The callback does not run. `pause()`'s promise stays pending.
- An in-flight pulse tween is destroyed the same way. `onStop` and `onComplete` do not run. `HorisontalPulse.play()` stays pending.
- `pause()` and `HorisontalPulse.play()` resolve immediately only when they are **called** while `sys.isActive()` is false. Leaving during a wait or a pulse does not take that branch, because the promise never resumes.

So leaving during the reveal wait, a pulse, or the remove gap does not write the next visit. The chain stalls. That stall is still a bug for slice 1h: `field.destroy()` has to resolve those promises as `cancelled`, because today they never settle.

The write that does land is earlier in `onGoPress`. The visit token is checked in `catch` and `finally` only. After `await gameClient.updateGame(...)` the function always assigns `this.gameData` and calls `playMoveResult`. `playMoveResult` samples `_visit` at its own start. If the response arrives after `create` has run:

- `_visit` is already the new visit, so `visitOpen` passes
- the old response overwrites `gameData`
- `revealEnemyMove` adds items on the new visit's enemy composite
- `create` has set `_sending` back to false, so the new visit does not look busy
- the following `pause()` is scheduled on the new visit, because the scene is active again

`rebind-cause.test.js` reproduces both paths: a dropped in-flight pause leaves the next visit empty, and a network response after re-entry reveals onto it.

No second cross-visit write showed up on the menu-skin toggle or on the sandbox binder. The extra cause for slice 1h is the `updateGame` continuation, fixed the same way as the waits: cancel when the field is destroyed, including the fetch that is already in flight, and do not re-bind every frame.

## Slice 1g

`HeatComposite` plus configs `stone`, `scissor`, `paper`, and `diskStack`. `createComposite` / `createItem` build them. Layout runs on add (`{ animate: false }` settles immediately), on `reset()`, and when `stackGap`, `angleStep`, `distance`, or a gain changes.

Shared clocks are gone. A new sheet copies the lead sheet's cycles and then keeps its own; the ball cycle is shifted by `index * 0.08`. A new disk copies the lead disk's spin and loop angle. `set` on the group writes that field through every item. Changing one sheet's or disk's own speed leaves the others. `hit` and `break` are group `shake` and `flash`. `reveal(count)` adds on a 0.32 s stagger. `clear({ instant: true })` drops every item; `clear()` plays each exit 0.32 s apart.

Idle hashes for a lone sheet are unchanged. The paper composite hash was updated: each sheet now eases its own pose instead of blending through one shared shape clock. The ball shift is still `index * 0.08`.

## Slice 1g

`HeatComposite` is the group. `createComposite('stone' | 'scissor' | 'paper' | 'diskStack', heatMap, overrides)` and `createItem(kind, heatMap, fields)` build them. The editor classes are those configs.

Layout runs on add when animations are off, on `reset()`, and when a layout setting changes (`stackGap`, `angleStep`, `distance`, the three gains). `set(key, value)` writes the template and every item. One sheet's or disk's own `ballSpeed` stays local.

Shared clocks are gone. A new sheet copies the lead sheet's pose, glisten, and ball, then adds `index * 0.08` to the ball. A new disk copies the lead disk's spin and loop angle. `spinHost` is gone. `reveal(count)` and `clear()` are staggered by 0.32 s on the field clock. `hit` and `break` are group `shake` and `flash`. Exit fades, then detaches; `cancel()` leaves the item in the group. New Paper's exit is still instant, and POP is still the old drama.

Idle goldens stay on the parked path. Paper's hashed frames are per-sheet cycles with that ball shift, which matches the old shared clock for equal speeds.

## Slice 1f

One animation at a time. Idle goldens stay on the parked path.

### 1f2 — Stone enter and spread

`addItem` parks the orbit center on the stone. `enter` (slot `life`, fill `none`) is `move` from the offset that puts the dot on the spawn point, duration `3 / spawnSpeed`, ease `expOut`. `spread` (slot `layout`, fill `commit`) eases `phase` from the current value to the even-phase goal. Commit adds that angle onto the ball and clears the channel. `centerFollow`, `phaseGoal`, and `phaseFollow` are no longer written. The idle park finishes spread and cancels enter.

### 1f1 — Scissor fly-in

`addItem` places the shard on the landing cell and plays `scissorEnter`: parallel move from `$spawn`, grow from ~0, spin from `$spin` (`-(360 + turn)`), duration `3 / speed`, ease `expOut`, slot `life`, fill `none`. Spawn and spin are read once when the run starts. `armShardFlight` and the replaced `stamp` are gone. `removeItem` cancels that run, then drops the highlighter. The idle park cancels the run so the hashed frames are the settled pose.

## Slice 1e

The animator is in and nothing in a scene calls `play` yet. Lifecycle coverage is `lifecycle.test.js`. Idle goldens are unchanged.

- `expOut` uses `k = 3` (`-ln(0.05)`) and is scaled so `u = 1` lands on 1. `sine` is in-out. Durations are passed in by the caller.
- `from: 'current'` is that slot's contribution, captured before replace. `$name` reads the context frozen at the run's start.
- Inside a field tick: each node advances its behaviour and its runs, then every node stamps, then deferred adds and removes flush. A run born during the tick stays on frame 0 until the next tick. `finish()` of an exit queues `detach` and the item is still in the list for that stamp.
- `play` on a node that is not attached warns and resolves `cancelled`. `field.destroy()` cancels running promises and does not fire `call` hooks.
- `composite.set` write-through is still slice 1g. The 1e independence test only checks that two nodes do not share fields or enter runs.

## Slice 1h

Blitz game's move sequence waits on the field clock. `reveal`, the fight pulses, `clear` (0.32 s stagger), and the post-mortem and victory pulses are runs. `heatFieldWait` is the 5 s reveal pause and the 2 s clash pause. Each board is built once per visit with `specCount` 0, and `reset({ items: 'spec' })` empties the enemy boards at the start of the exchange and the winner's board after the post-mortem pulse.

Pulses are a `HotRod` plus `sweep` (move, and `clip` on a victory strike) and `call detach`. They advance only when the field ticks, so STOP freezes them. `field.destroy()` on scene shutdown cancels every run. `finish()` marks the run completing before the end `detach`, so that call resolves `finished` instead of cancelling itself.

`_visit`, `visitOpen`, `syncSceneComposites`, `liveOn`, `bindToField`, and `bindSceneHeatObjects` are gone, including the ten scene `update` calls. The late `updateGame` response is the extra cause from 1a: the request is aborted on shutdown, and the continuation returns when that visit's field is no longer the live one, so it does not reveal onto the next visit.
