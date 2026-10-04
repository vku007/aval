# Agentic implementation: heat UI step 1

Status: ready to implement. One slice per agent session. Do not start the next slice until the current slice's exit checks pass.

Authority, in order:

1. [heatmap_step1_ui_objects_transitions.md](heatmap_step1_ui_objects_transitions.md) — the design. Where it and the file below differ, this step-1 file wins.
2. This file — the implementation order, the resolved conflicts, the files, and the exit checks.
3. [heatmap_ui_objects_transitions.md](heatmap_ui_objects_transitions.md) — extra test cases, the editor adapter, and how the field tick sits around diffusion and paint. Use it only for those. Its class names, channel names, run API, slot policies, test location, and exit-reset model are superseded by the resolutions below.

Parent context: [heatmap_game_refactor.md](heatmap_game_refactor.md). This work replaces that plan's Layers 3 and 5 and Phases 3–4 for the objects and transitions. Heat-core dedupe, preset v6, the editor merge, and MatchSession stay out.

## How an agent runs one slice

1. Read this file's resolution table and the slice you were assigned. Read the source files listed in that slice. Do not re-decide the design.
2. Implement only that slice. Leave every scene playable.
3. Run the slice's tests. For any slice that changes what a scene draws or how a control behaves, verify that flow in the browser (click through the checklist). A screenshot of the first frame is not enough.
4. Stop. Report: what landed, which tests passed, what the browser showed, and anything that blocked the exit check. Do not begin the next slice in the same session unless the user asked for several slices.

Scripts stay classic globals. New files are `<script>` tags in `site/html5Simple/index.html`, in the dependency order in [File order](#file-order). Bump each touched file's `?v=` query. There is no bundler.

Nodes, behaviours, the animator, and the transition library do not reference Phaser. Only `UiHeatMap` and the field attachment do.

## Resolutions (do not reopen)

| Topic | Implement this | Leave this from the other plan |
|---|---|---|
| Types | `HeatNode`, `HeatItem`, `HeatComposite` | `HeatObject` |
| Folders | `js/heat/node`, `anim`, `anim/library`, `behaviours`, `items`, `composites` | `js/heat/objects`, `anim/lib` |
| Tests | `tests/html5Simple/` at the repo root, Vitest, scripts loaded in a Node `vm`. Stays outside `site/` so `aws s3 sync site/` cannot publish it | `site/html5Simple/test/` and `module.exports` tails on FX files |
| Channels | Names and combine rules in the step-1 file: `offset`, `rotate`, `scale`, `heat`, plus the kind channels listed there | `angle`, `intensity`, `visible`, `bodyIntensity`, `ballGather`, `ballCollapse`, and the max/and combiners |
| Contributions | Each run stores its own channel contribution. The combiner applies the step-1 rules (add, multiply, latest-started). Resetting one run drops only that contribution | "Combination is commutative, so order does not matter" — false for `pose` and `gather`, which take the latest started run |
| Run API | `node.play(name, ctx)` → run. `run.finished` resolves `{ status: 'finished' \| 'cancelled' }` and never rejects. Methods: `pause`, `resume`, `seek`, `finish`, `cancel` | `start` / `stop` / `reset` / `restart`, a `done` promise of `'reset' \| 'destroyed'`, fill name `forwards` |
| Slots | `life` (enter/exit), `react` (hit/break), `layout`, `hover`, `move`. Different slots run together. Busy-slot policy: `replace` (default), `queue`, `ignore` | A `parallel` slot policy. Parallelism inside one transition is the `parallel(...)` block |
| Fills | `none` (enter), `hold` (exit, health loss), `commit` (layout moves, phase spread) | `forwards` |
| Sibling sync | On add, `item.copyBehaviourState(lead, { shift })`. `composite.set(key, value)` writes that field through to every item. Setting one item's own field changes only that item | `alignTo` as the only sync, and no write-through |
| Phase spread | A composite `spread` transition on slot `layout`, fill `commit` | Setting the field first and easing a channel from (old − new) to 0, unless that is how you implement `commit` and the tests still pass |
| Remove | `remove` plays `exit` and detaches when that run finishes. `cancel()` on that run restores the slot to identity and leaves the item attached, because detach has not happened yet | A `leaving` list and "reset puts the item back at its old index" as a separate mechanism |
| Health bars | Existing `HeatRect` rows. Lost life is `pose` 0→1, fill `hold`. `reset()` restores the bar | A new `HealthBar` composite type |
| Scene waits | Reveal, clash, and the 0.32 s remove gap are `wait` runs on the field clock. `field.destroy()` cancels them | `scene.time.delayedCall` and `_visit` checks. A MatchSession choreography runner (parent plan, Phase 7) |
| Presets | Today's JSON, through legacy key aliases. No new schema | Saving slots as `{ transition, params }` (that is preset v6) |
| Editors | Thin adapter so current tabs, ADD / REMOVE, copy, save, and load keep working | A transitions panel, PROPS rewrite, or merging the two editors |

Sibling sync, stated once: a composite-level control such as ball speed writes every item. Opening one sheet and changing its speed changes that sheet only. That is the step-1 decision.

## Contracts

### Channels

Identity: `offset` `{col:0,row:0}`, `rotate` `0`, `scale` `1`, `heat` `1`. Kind channels from the step-1 table, same identity idea (`pose` 0, `gather` 0, multipliers 1, heat multipliers 1).

Stamp order for an item: fields, then behaviour state, then the item's combined channels, then the parent's group channels (`offset`, `rotate`, `scale`, `heat` about the composite center).

Transitions write channels only. The exception is fill `commit`, which writes the final value into the item's fields and clears that slot in the same tick.

### Run

```js
const run = node.play('enter', ctx);
run.finished; // Promise<{ status: 'finished' | 'cancelled' }>
run.pause(); run.resume(); run.seek(t); run.finish(); run.cancel();
node.cancelAll(); node.reset();
```

- Clock is the field tick, with the same clamped `dt` behaviours use. `UiHeatMap.stop()` freezes runs. `step()` advances one tick (the existing 1/60 s step).
- `from` is resolved at start: a literal, `'current'` (the slot's current value), or a context value the composite supplies (`$spawn`, `$turn`, `$waypoint`, `$splitDelay`, `$jump`, `$drop`).
- `play()` on a detached node resolves `cancelled` and logs a warning.
- `field.destroy()` detaches every root. Every pending `finished` resolves `cancelled`. No callback runs after that.
- Inside one tick: behaviours, then runs, then completion handlers, then queued adds and removes, then stamp. Do not mutate the live lists while iterating them.

### Behaviours

`Orbit`, `Follow` (editor taps only), `PathLoop`, `PoseCycle`, `Glisten`, `BallRunner`, `DiskLoop`, `Spin`.

Each has `reset()`, `advance(dt)`, and `copyStateFrom(other, shift)`. Continuous loops keep today's math. `item.reset()` cancels runs, clears channels, and resets behaviours from the item's own fields. The result equals a freshly built item with those fields.

### Transition blocks

`tracks`, `wait`, `set`, `call`, `sequence`, `parallel`, `stagger`.

Library, all reusable: `move`, `grow`, `spin`, `fade`, `flash`, `shake`, `gather`, `pose`. Kind-specific transitions are compositions of these, not new engines. Definitions live in `js/heat/anim/library/`.

Durations:

- Exponential follow (`k = 1 - exp(-speed * dt)` in `stepRotatedMotion`) becomes duration `3 / speed` seconds and ease `expOut`. `3 / speed` is `-ln(0.05) / speed`, so it covers 95% of the old path. Tune by eye after the tests pass. Stone's default `spawnSpeed` is 1.2, so the starting duration is 2.5 s.
- New Paper drama keeps the current rate. In `UiNewSheet.advanceDrama`, `rate = speed / 100`, so a step lasts `100 / speed` seconds. Defaults 400 / 900 / 160 are 0.25 s, 100/900 s, and 0.625 s. The step-1 file's 0.11 and 0.63 are those values rounded. Derive the duration from the speed the editor still edits. Do not hardcode the rounded numbers.
- Pulses: horizontal 1.5 s, vertical 1.5 s, victory 0.75 s, sine ease, then `call detach`. Constants today: `HORISONTAL_PULSE_MS = 1500` and the matching vertical and victory constants.
- Health loss and menu hover: `pose` on slot `hover` for the menu, slot `life` or a dedicated held run for the lost bar, fill `hold`, policy `replace` from `'current'`.

### Composites

```js
createItem('hot-ball', field, fields)
createComposite('stone', field, { center, spawn, ...overrides })
```

| Config | Item | Layout | Transitions |
|---|---|---|---|
| `stone` | HotBall | Even phases | `enter` = `move` from `$spawn`. `spread` on slot `layout`, fill `commit`. `exit` |
| `scissor` | HeatRect (shard shows skew, glisten, shape) | Angle step per index | `enter` = `parallel(move from $spawn, grow from ~0, spin from -(360 + $turn))`. `exit` |
| `paper` | HeatSheet | Stack by `stackGap`. The pair waypoint is the previous sheet's spec pose, not its animated pose | `enter` = the step-1 pair / split / reveal sequence. `exit` |
| `diskStack` | HeatDisk | Depth and gains per index | `enter` = `gather` 1→0 from `$spawn`, 1 s. `exit` is instant. `drama` is the three-step sequence in the step-1 file, then `call detach` |

Every config also has `reveal(count)` (staggered adds), `clear` (staggered exits, 0.32 s apart, matching `LOCAL_ADVANCED_REMOVE_PAUSE`), `hit` and `break` as `shake` and `flash` on the group channels.

`moveTo(cell)` translates each item's `POSITION_FIELDS`. Running transitions are offsets, so a move during a flight does not jump. `POSITION_FIELDS` replaces the kind switch in `HotMapUiComposite.captureLocal` / `applyLocal`.

Saved positions stay relative to the composite center, as `serialize()` does today.

`composite.reset()` resets the composite and every item and runs layout again. `composite.reset({ items: 'spec' })` also rebuilds the item count from the spec.

`parent` is the only link from an item to its composite, and it exists for the group transform. An item never reads composite fields.

### Editor adapter (mechanical only)

Keep these surfaces working. They can be getters on the new classes:

- `params`, `nudgeParam`, `setParam`, `PROP_TABS`, `serialize`, `applySerialized`
- Legacy keys mapped onto fields (`fromWidth` → pose width, `newBallInit_radius`, `shardSpeed`, `spawnSpeed`, drama speed keys, and the rest of today's tab keys)
- `parts` as `[{ object }]` over `items`
- `onPartAdded` / `onPartRemoved` still invoked
- `addItem` / `removeItem` still the editor's entry points; they call `add` / `remove`
- Old constructor names as aliases: `UiHotBall`, `UiHotRod`, `UiBackHighlighter`, `UiShard`, `UiSheet`, `UiNewSheet`, `HotMapUiStone`, `HotMapUiScissor`, `HotMapUiPaper`, `HotMapUiNewPaper`, `HorisontalPulse`, `VerticalPulse`, `VictoryPulse`

`heatMapRegistration` must keep recognizing the aliases until 1h, then accept the new kinds.

## Current code the slices touch

| Today | File | What leaves |
|---|---|---|
| Field lists and tick | `js/fx/RotatedHeatMapFx.js` `attachRotatedHeatField` (`balls` / `rods` / `highlighters`, `sheetEpoch`, `forEach` advance+stamp) | Roots, deferred mutations, `destroy()`. Diffusion and paint stay |
| Registration and transport | `js/ui/UiHeatMap.js` `update`, `play` / `stop` / `step`, `heatMapRegistration`, `bindSceneHeatObjects` | `addRoot` / `removeRoot`. STOP already skips `field.update`; runs must live on that tick |
| Ball follow and phase | `js/fx/RotatedHeatMapFx.js` `stepRotatedMotion` (`centerFollow`, `phaseGoal`, `phaseFollow`) | Those three fields, after stone enter/spread is a transition |
| Stone | `js/ui/HotMapUiStone.js` `addItem`, `spreadBallPhases` | Direct writes into ball motion |
| Scissor stamp patch | `js/ui/HotMapUiScissor.js` `armShardFlight` | Replaced `emitter.stamp` |
| Paper clocks and travel | `js/ui/HotMapUiPaper.js` `syncBalls`, `clearSheetClocks`; `js/fx/SheetFx.js` `travel` stages | `ballClock`, `glistenClock`, `shapeClock`, `ballLead`, `ballShift`, `sheetEpoch` checks, `travel` |
| Disk host and drama | `js/ui/UiNewSheet.js` `spinHost`, `ballTravel`, `drama`, `advanceDrama`; `js/ui/HotMapUiNewPaper.js` `finishDramas` | Highlighter registration used only to poll |
| Pulses | `js/ui/HorisontalPulse.js`, `VerticalPulse.js`, `VictoryPulse.js` | Phaser tweens and replaced `advance` / `stamp` |
| Health and menu hover | `UiBackHighlighter.armHover` / `setHovered`; `LocalAdvancedGameScene` health bars | "Hovered" meaning "lost a life" |
| Match sequence | `js/scenes/LocalAdvancedGameScene.js` `playMoveResult`, `pause`, `visitOpen`, `_visit` | Scene timers and visit checks, in 1h |
| Rebinding guards | `bindSceneHeatObjects` in ten scenes; `liveOn`, `bindToField`, `syncSceneComposites` | Deleted in 1h, after 1a has written the cause |

FX stamp math stays in `js/fx/*`. Items call those functions. Do not dedupe the palette, diffusion, or clamps in this step.

Resource files that must still load: `resources/stone-1.json`, `scissors-1.json`, `paper-1.json`, `new-paper-4.json`, `ui-editor-init.json`, `hotmap-1.json`.

## File order

Add to `index.html` after `js/fx/HotCircleFx.js` and before `js/ui/UiPropEditor.js`:

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
js/heat/items/HotBall.js
js/heat/items/HotRod.js
js/heat/items/HeatRect.js
js/heat/items/HeatSheet.js
js/heat/items/HeatDisk.js
js/heat/composites/stone.js
js/heat/composites/scissor.js
js/heat/composites/paper.js
js/heat/composites/diskStack.js
```

Split a file if it passes about 400 lines. Keep one global class or factory per file so the script order stays obvious. Aliases can live at the bottom of the new item and composite files; delete the old `js/ui/Ui*` bodies only when every caller uses the alias or the new name, and keep the alias until the editors are migrated later.

## Tests

Harness: `tests/html5Simple/`, own `package.json` with Vitest, or a script invoked from the repo root. Load the heat scripts with `node:vm` into one context. Provide a minimal `window` / `Phaser` stub only if a loaded file touches them at eval time. Call stamp and step functions directly. Fixed `dt` of `1/60`. Grid hash is a stable hash of the `Float32Array`, not a screenshot.

Two layers:

- **Idle goldens.** Each item kind, and each composite with 3 items and animations suppressed (`{ animate: false }` once that option exists). Hash after N frames. These must stay bit-identical from 1a through 1e, and after 1f for the idle path. Capture them in 1a against today's code.
- **Lifecycle tests.** Written in 1e against the animator, repeated on real items in 1f–1g. These do not require bit-identical enter/exit grids. Enter and exit are judged by the lifecycle tests plus a visual check.

Lifecycle cases (from the step-1 rules, plus the cases in the other plan that still apply):

- The first frame is applied in the same tick as `play`.
- `cancel()` restores that slot's identity and resolves `cancelled`. Another run on the same object, in another slot, keeps its contribution.
- `finish()` equals `seek` to the end, then the fill. A second `finish()` is a no-op and stays resolved.
- `seek(t)` matches stepping to `t` within 1e-9.
- `pause` holds time. Field STOP holds runs and behaviours. STEP advances exactly one tick.
- Slot policies: `replace` (from `'current'`, no pose jump), `queue`, `ignore`.
- Fills: `none` clears, `hold` keeps the final value, `commit` writes fields and clears the channel.
- `field.destroy()` resolves every `finished` with `cancelled`, and later ticks do nothing.
- Same fields and the same `dt` sequence produce the same grid.
- `item.reset()` and `composite.reset()` deep-equal a fresh item or composite with the same fields.
- Two stones on one field with different `enter` definitions do not affect each other.
- Changing one sheet's speed field does not change another sheet. `composite.set('ballSpeed', v)` changes every disk.
- Exit `cancel()` leaves the item attached. Exit `finish()` detaches it after the tick, not during the stamp loop.

## Slices

### 1a — Baseline and harness

Read: `attachRotatedHeatField`, one item file per kind (`UiHotBall`, `UiHotRod`, `UiBackHighlighter`, `UiShard`, `UiSheet`, `UiNewSheet`), and the four composite `addItem` methods. Skim `LocalAdvancedGameScene.playMoveResult` and `UiHeatMap.bindSceneHeatObjects`.

Build the harness and idle goldens on the current code. Write `tests/html5Simple/NOTES.md` with:

- The commands to regenerate and check goldens.
- The manual checklist: Composite editor ADD / REMOVE / POP per group; Menu skin on and off; a full LocalAdvanced match; leave mid-animation and come back.
- The cause of the rebinding guards. Reproduce it (leave and re-enter a scene, toggle the menu skin, leave LocalAdvanced during `playMoveResult`). The known confirmed leak is the async chain: `pause()` resolves immediately when the scene is inactive, the scene instance is reused, and the old chain mutates the new visit. Confirm whether anything else still breaks once that chain is the suspect. Do not delete the guards in this slice.

Exit: `npm test` in the harness passes on unmodified behaviour. NOTES.md has the cause. No production file changes except none — this slice does not change `site/`.

### 1b — Nodes and field roots

Read: `UiHeatMap.update`, `attachRotatedHeatField` update and shutdown, `heatMapRegistration`.

Add `HeatNode` and `HeatItem` with `attach`, `detach`, `tick`, `serialize`, `parent`. Move each current wrapper onto `HeatItem` without changing loop math: the motion and emitter objects can remain as the behaviour state for now. Field gains `addRoot` / `removeRoot`, a deferred add/remove queue, and `destroy()`. Existing `addBall` / `addRod` / `addHighlighter` stay as wrappers that also register a root, so current scenes keep working.

Shutdown of the Phaser scene calls `field.destroy()`.

Exit: idle goldens unchanged. Menu, UI Editor, and one sandbox (Alter Sheet) still open, edit, and leave.

### 1c — Behaviours and reset

Extract `Orbit`, `Follow`, `PathLoop`, `PoseCycle`, `Glisten`, `BallRunner`, `DiskLoop`, `Spin` from the current step functions. Copy the math. Add `reset` and `copyStateFrom`. `item.reset()` as specified.

Do not yet remove `centerFollow`, `travel`, `ballTravel`, `drama`, or the shared clocks. Those go in 1f.

Exit: new test, reset equals fresh, for each kind. Idle goldens unchanged.

### 1d — Channels

Add the channel set and the combiner. Stamp paths multiply or add identity values, so frames do not change. Composites gain group channels, also at identity.

Exit: idle goldens unchanged. A unit test shows a non-identity `offset` shifts the stamped position and clearing it restores the golden.

### 1e — Animator

Implement `Run`, slots, fills, easing (`linear`, `sine`, `expOut`), the blocks, and the library functions with no callers in the scenes yet.

Exit: every lifecycle test in [Tests](#tests) passes against plain nodes. No visible change. This is the slice that makes later animation moves safe.

### 1f — Move one animation at a time

Each sub-slice deletes the old fields it replaces and updates the idle or lifecycle tests. Do not start the next sub-slice while the previous one's tests fail.

Order:

1. **Scissor fly-in.** Delete `armShardFlight` and the replaced `stamp`. `enter` is the parallel move / grow / spin. Waypoint and spin come from the composite context (`$spawn`, `$turn`), frozen at start, so retargeting mid-flight does not recompute progress from remaining distance.
2. **Stone enter and spread.** Delete `centerFollow`, `phaseGoal`, `phaseFollow` writes. The ball's field position starts on the spawn point. `spread` commits the new phases.
3. **New Paper enter and drama.** Delete `ballTravel`, `drama`, and `finishDramas`. The disk stack is a root, not a highlighter. `drama` ends with `call detach`. Durations from `100 / speed`.
4. **Paper enter.** Delete `travel`, `glistenHold`, `glistenAfterMove`, `travelBallGap` as animation state. The waypoint is the previous sheet's spec pose. Shared clocks stay until 1g (they are not this animation).
5. **Pulses.** `HorisontalPulse`, `VerticalPulse`, and `VictoryPulse` become a `HotRod` plus `move` (and `clip` for victory) and `call detach`. Delete the tween and the stamp patch. STOP must freeze a pulse; that is the regression to check in the browser.
6. **Hover and health.** Menu hover is `pose` on slot `hover`, policy `replace`, from `'current'`. A lost health bar is `pose` 0→1, fill `hold`. `reset()` parks it back. `setHovered(true)` must not be the way a bar loses a life.

Exit for each sub-slice: lifecycle tests for that transition, idle goldens still green, and the matching scene still performs the action (scissor ADD, stone ADD, new-paper ADD and REMOVE, paper ADD, a LocalAdvanced exchange's pulses, menu hover and a lost life).

### 1g — Composites

Add `HeatComposite` and the four configs. `createComposite` / `createItem`. Layout runs on add, on reset, and when a layout setting changes.

Delete shared clocks and epoch checks: `ballClock`, `ballLead`, `ballShift`, `glistenClock`, `shapeClock`, `field.sheetEpoch` readers, `spinHost`. On add, copy the lead item's behaviour state plus the per-index shift. `set` on the composite writes through.

Keep legacy param key names as aliases so the editor tabs do not change.

`reveal`, `clear`, `hit`, `break` exist. `hit` and `break` are group `shake` and `flash`.

Exit: reset-equals-fresh on all four configs. The independence test (one sheet's speed vs write-through). Composite editor ADD / REMOVE / POP for each group looks like the current motion. Save and load of each resource JSON round-trips and looks the same.

### 1h — LocalAdvanced on the new API

Replace `playMoveResult`'s `await this.pause(...)` chain with:

- `await enemy.play('reveal', { count }).finished` (or the reveal helper that returns that run)
- fight pulses as runs, in parallel
- `await loser.play('clear').finished` with the 0.32 s stagger
- post-mortem and victory pulses as runs
- waits as `wait` runs on the field clock (`LOCAL_ADVANCED_REVEAL_PAUSE` is 5 s, `LOCAL_ADVANCED_CLASH_PAUSE` is 2 s)

`reset({ items: 'spec' })` at the start of a round.

Scene `shutdown` calls `field.destroy()`. Delete `_visit`, `visitOpen`, `syncSceneComposites`, `liveOn`, `bindToField`, and `bindSceneHeatObjects`, including the calls in the sandbox and editor scenes. This is allowed only because 1a's NOTES.md names the cause and the new cancellation covers it. If NOTES.md names an extra cause, fix that cause here too, in the same way: cancel on destroy, do not re-bind every frame.

`playMoveResult` may stay an async function that awaits `run.finished`. It must not use `scene.time.delayedCall`. After shutdown, those promises resolve `cancelled` and the function returns without touching the next visit's objects.

Exit: a best-of-5 local match plays. Leaving during reveal, during a pulse, and during the staggered clear, then re-entering, leaves no rods, no disks, and no pending runs. The ten scenes that used to call `bindSceneHeatObjects` still open and shut down cleanly.

## Browser checks

Serve `site/html5Simple` the way this repo already does locally, and drive the page. Confirm the action, not only the first paint.

| Slice | Flow |
|---|---|
| 1b, 1c, 1d | UI Editor: add a ball, STOP, STEP once, leave the scene, re-enter |
| 1f1–1f4 | Composite editor: ADD and REMOVE on that group. POP if the group has it |
| 1f5 | LocalAdvanced: start a move and press nothing else; confirm the pulse is gone after it finishes. In the editor, STOP during a pulse freezes it |
| 1f6 | Menu skin hover. LocalAdvanced: lose a life, then start a new match and see the bar restored |
| 1g | Each composite group ADD, REMOVE, save, load |
| 1h | Full match; leave mid-reveal; leave mid-clear; re-enter and play another move |

## Out of this implementation

- Editor redesign, a TRANSITIONS tab, merging UI Editor and Composite UI Editor
- Heat core dedupe (palette, diffusion, clamps, coordinate helpers)
- Preset v6 and migrators
- MatchSession, HeatArena, named layout regions
- Sandbox scene base class
- New visual effects or retuning of idle loops

## Done when

Matches the step-1 "Done when" section:

- The composite-only fields listed there are gone (`centerFollow`, `phaseGoal`, `phaseFollow`, `travel` and the paper clock fields, `spinHost`, `ballTravel`, `drama`).
- Every animation is a behaviour or a transition on the field tick, and can be cancelled, finished, and reset.
- Reset tests pass.
- Leaving mid-animation leaves no stray emitters, and every `run.finished` resolves `cancelled`.
- Existing resource JSON and presets load and look the same. Editors still add, remove, copy, save, and load.
