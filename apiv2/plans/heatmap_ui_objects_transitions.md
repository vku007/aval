# Heat UI objects and transitions: step 1 plan

Status: proposal. Scope: `site/html5Simple` heat objects, composites, and their animations. This is the first step of [heatmap_game_refactor.md](heatmap_game_refactor.md). It replaces that plan's Phases 3–4 for now.

Editors are tools. They're out of scope here and only need to keep working, through a thin adapter (see [Editors](#editors-kept-working-not-refactored)).

## Goals

1. **A clear structure for UI classes.** One base class, one way to hold state, one way to render.
2. **Items in a composite keep their own fields.** An item never reads its composite's state, and a composite never writes an item's internals. I read "fields" as each item's own properties and state, not separate heat grids per object.
3. **Many animations per composite.** A composite (or an item) can hold any number of named animations ("transitions"): enter, exit, hit, break, idle variants, and so on.
4. **Reusable animations and components.** One transition definition works on any object that has the channels it needs. One composite class can be used for the player, for the enemy, and in a sandbox, each with different animations.
5. **Start and reset are exact.** Every animation can be started, paused, stopped, finished, reset, and restarted. The result is deterministic and covered by tests.

## What stands in the way today

### Items depend on their composite

- **Paper** puts shared state into every sheet: `ballClock`, `glistenClock`, `shapeClock`, `ballLead`, and `ballShift`. The lead sheet writes its speeds into those shared clocks, so a sheet behaves differently inside and outside a Paper.
- **New Paper** sets `spinHost` on each disk. The disk then reads its spin and ball speed from `spinHost.sheetInit`. Changing one disk's `ballSpeed` actually writes the composite's template.
- **Composites write item internals directly:**
  - Stone sets `motion.orbitCenter`, `centerFollow`, `phaseGoal`, and `phaseFollow`.
  - Paper sets `sheet.emitter.travel = {…}`.
  - Scissor sets `emitter.travel` and replaces `emitter.stamp`.
- `HotMapUiComposite.captureLocal` / `applyLocal` switch on the item's kind to move each kind's internal points.
- New Paper registers itself as a "highlighter" only so the field will tick it.

### Animations are ad hoc

There are six separate mechanisms, and none of them can be reset:

| Animation | Where it lives | How it ends |
|---|---|---|
| Stone ball orbit-in + phase spread | `HotMapUiStone` writes follow and goal fields on the ball | Exponential follow, with no fixed duration |
| Scissor fly-in + spin | `armShardFlight` replaces `stamp` and derives progress from the remaining distance | Once the distance falls below 0.2%. It can't be seeked or reset. |
| Paper pair → split → reveal | `travel` stages inside `SheetFx` | `stage = 'done'` after a wait |
| New Paper ball travel-in | `ballTravel` inside `UiNewSheet` | `u >= 1` |
| New Paper remove "drama" | `drama` inside `UiNewSheet`, polled each frame by `finishDramas` | `drama.done`, then `onDone` |
| Pulses (fight, post-mortem, victory) | A `UiHotRod` with `advance` / `stamp` replaced and driven by `scene.tweens` | Tween complete. The tween runs on the Phaser clock, so the heat map's STOP / STEP don't pause it. |

Scene-level sequences (`LocalAdvancedGameScene.playMoveResult`) are chained `await pause()` calls. Nothing cancels them when the scene shuts down, which is the cross-visit leak described in the main plan.

### Objects' own loops can't be reset either

The pose cycle, glisten sweep, orbit, disk loop, and ball spin have no `reset()`. `applySerialized` resets some of this state by hand (`phase = 'toEnd'; waitLeft = 0; current = copy(from)`), differently in each class.

## Design

### 1. Three layers of state on every object

| Layer | What it is | Who writes it | Saved? |
|---|---|---|---|
| **Fields** | The object's own settings: position, from/to pose, radius, speeds, start phases | The object, or `set()` from outside | Yes |
| **Behavior state** | Running state of the object's own loops: orbit angle, cycle phase and timer, glisten position, spin | The object's behaviors, each tick | No (derived from fields on reset) |
| **Channels** | Temporary modifiers such as offset, angle, scale, and intensity | Only running animations | No |

Rendered value = field, then behavior, then channels.

**Rule: animations never write fields.** They only contribute to channels. That's what makes reset exact: resetting an animation just drops its contribution. The one exception is an animation that explicitly *commits* at its end, like a move-to. It sets the field and clears its own offset in the same tick, so nothing jumps.

### 2. Base class `HeatObject`

```js
class HeatObject {
  static kind = '';
  static FIELDS = {};     // own settings: default + spec (+ legacy key for tools)
  static CHANNELS = {};   // extra animatable channels, beyond the standard set

  constructor(field, data)          // defaults + data → own fields; attaches to the field
  attach(field) / detach() / destroy()

  get(key) / set(key, value) / nudge(key, dir)   // clamped by spec
  serialize() / apply(data)                      // fields only
  position() / translate(dCol, dRow)             // used for group moves
  static translateData(data, dCol, dRow)         // same move applied to saved data

  behaviors                        // this object's loops; each has reset()/advance()
  reset()                          // behaviors → start state, all runs reset
  alignTo(other)                   // copy behavior state from a sibling (not fields)

  channels                         // effective channel values for this frame
  animations                       // named slots (see §5)
  play(nameOrTransition, opts) → Run

  advance(dt)                      // behaviors, then this object's runs
  stamp(grid)                      // reads fields + behavior state + channels
}
```

**Standard channels.** Every object has these, and every `stamp()` applies them:

| Channel | Combine | Applied as |
|---|---|---|
| `offset {col,row}` | add | Moves every point of the object |
| `angle` | add | Degrees added to the object's rotation |
| `scale` | multiply | Size: radius, thickness, width/height |
| `intensity` | multiply | Heat emitted |
| `visible` | and | Skips stamping when false |

Standard channels are what let one transition work on a ball, a shard, a sheet, or a disk.

**Kind channels.** Each class declares extras for its own parts:

| Kind | Extra channels |
|---|---|
| HotBall | `phase` (add) |
| HotRod | `clip` (a region the rod stamps inside, used by pulses) |
| HeatRect (rect + shard) | `glisten` (add) |
| HeatSheet | `bodyIntensity` (multiply: shape + glisten), `ballScale` (multiply), `ballGather` (max, 0 = balls in their slots, 1 = balls together at the gather point) |
| HeatDisk | `radiusScale`, `heatScale`, `ballIntensity` (multiply); `ballJump` (add, rows); `ballCollapse` (max, 0…1 toward center + drop) |

Channels combine per running animation, and each animation owns its own contribution. So two animations on the same object (a fly-in plus a hit flash) compose, and resetting one leaves the other untouched. Combination is commutative, so the order of the animations doesn't matter.

### 3. Behaviors: the object's own loops

A behavior is a small class that holds its own state and can reset:

```js
class PoseCycle {                 // from → to, delay, back or snap, gap, repeat
  constructor(owner, { from: 'from', to: 'to' })
  reset()                         // phase = start, timer = 0, current = from
  advance(dt)
  copyStateFrom(other)            // used by alignTo
}
```

| Behavior | Used by | Replaces |
|---|---|---|
| `Follow` (ease position toward target) | All | Per-class `center += (target − center) * k` |
| `Orbit` | HotBall | `stepRotatedMotion` |
| `PathLoop` | HotRod | `stepHotRodLoop` |
| `PoseCycle` (+ hover drive) | HeatRect, HeatSheet shape, health bars | `stepBackHighlightPose` / `stepBackHighlightHover` |
| `GlistenSweep` | HeatSheet | `stepSheetGlistenRun` |
| `BallRun` | HeatSheet | `stepSheetBall` |
| `DiskLoop`, `Spin` | HeatDisk | `UiNewSheet.step` |

**Keeping siblings in sync without shared state.** Paper's sheets and New Paper's disks need to move in step. Each item keeps its own behaviors and speeds. The composite calls `item.alignTo(firstItem)` when it adds an item and when it resets. Items with the same speed then stay in step on their own. A per-index shift, such as Paper's ball offset per sheet, is an ordinary item field set at add time.

The trade-off: changing one sheet's speed no longer changes its siblings. That's what "individual fields" means. Tools can offer "apply to all" later.

### 4. Transitions and runs

A **transition** is a reusable definition. It holds no state and takes parameters. A **run** is one playback of a transition on specific targets.

```js
const flyIn = defineTransition('flyIn', {
  params: { duration: 1.2, spin: 360, startScale: 0.05, from: 'spawn', ease: 'sineInOut' },
  requires: ['offset', 'scale', 'angle'],
  begin(ctx) {                                   // once per start; result frozen for the run
    ctx.fromOffset = ctx.pointDelta(ctx.resolve(ctx.params.from), ctx.item.position());
  },
  frame(u, ctx) {                                // u = eased 0…1; returns this run's contribution
    return {
      offset: lerpPoint(ctx.fromOffset, ZERO, u),
      scale: lerp(ctx.params.startScale, 1, u),
      angle: -(1 - u) * ctx.params.spin
    };
  }
});
```

**Building blocks.** New animations are composed from pieces instead of written from scratch:

- `tween(channel, from, to, { duration, ease })`
- `wait(s)`
- `set(channel, value)`
- `seq(a, b, …)`
- `par(a, b, …)`
- `stagger(t, { each: 0.32 })`: plays `t` on each target in turn
- `repeat(t, n | Infinity)`
- `call(fn)`: a structural action, such as detaching an item

**Run API.** This is where start and reset are defined:

| Method | Effect | State after |
|---|---|---|
| `start()` | Resolves the context (spawn point, current positions) and freezes it for this run. Sets t = 0 and applies the first frame in the same tick, so nothing flashes for one frame. | running |
| `pause()` / `resume()` | Holds or continues the time. The contribution stays. | paused / running |
| `seek(t)` | Jumps to time t. A run's pose depends only on its frozen context and t, so `seek` gives the same result as stepping there. | unchanged |
| `stop()` | Freezes at the current frame. The contribution stays until reset. | stopped |
| `finish()` | Jumps to the end and runs the end actions (for exit: detach the item). Safe to call twice. | done |
| `reset()` | Drops the contribution and skips the end actions, so the target looks exactly as it did before `start()`. | idle |
| `restart()` | `reset()` then `start()`. The context is resolved again. | running |

- **`done`** is a Promise that resolves with `'finished' | 'reset' | 'destroyed'`. There are also `start`, `end`, and `reset` events.
- **`fill`**: `'none'` (default) drops the contribution when the run finishes. `'forwards'` keeps the last frame after finishing, for things like "hide".
- **Time comes from the heat field's tick**, not `scene.tweens`. So STOP / STEP pause animations too, and tests can step exact frames. When the field is destroyed on scene shutdown, every run resolves `'destroyed'` and never fires again. That ends the need for `_visit` checks.

### 5. Animation slots

Any object, item or composite, has `animations`: a set of named slots.

```js
stone.animations.define('enter', orbitIn({ duration: 1 }));
stone.animations.define('hit',   shake({ amp: 3, duration: 0.4 }));
stone.animations.define('break', stagger(burst({ heat: 3 }), { each: 0.1 }));

const run = stone.play('hit');                         // default targets: all items
stone.play('hit', { targets: 'last' });                // 'all' | 'first' | 'last' | index | item | fn
await stone.play('break').done;
stone.animations.reset('hit');
stone.animations.resetAll();
```

- **Any number of slots.** `enter` and `exit` are the ones `add()` and `remove()` use. Everything else is named freely: `hit`, `break`, `idleCalm`, `idleAngry`, `win`, …
- **Policy when a slot plays while it's already running:**
  - `restart` (default): reset the old run, then start
  - `ignore`: keep the old run
  - `queue`: start after the old run ends
  - `parallel`: run both
- **Slots are data.** A slot is saved as `{ transition: 'flyIn', params: {…} }`, and the name is looked up in a transition registry. Presets can then carry animation settings.
- Several of today's composite fields are really transition params, and they move into slots:
  - Scissor TURN
  - Paper SPAN, GAP, SIZE, DELAY
  - New Paper HEAT / BURST / FALL speeds, JUMP, DROP
  - Stone SPAWN SPEED
- **Reuse.** The same `Stone` class is used for the player and for the enemy, each with its own `enter`, `exit`, and `hit` definitions. The same `flyIn` works on the Scissor's shards and on any other composite's items.

### 6. Composites

`HeatComposite` replaces `HotMapUiComposite`. It holds references to its items, never their state.

- **Its own fields:** `center`, `spawn`, the item `template` (`{ kind, data }` of item fields), and layout params.
- **`place(index, previousItem) → field overrides`** is a layout rule applied once, when an item is added. After that the item is independent. Examples:
  - Stone: even phases
  - Scissor: angle + TURN
  - Paper: stack below the previous sheet, with a ball shift
  - New Paper: depth = index × DISTANCE, plus the gains
- **Structure:**
  - `add(opts)` creates the item from the template and the placement, attaches it, and aligns it to its siblings. It then plays `enter` (unless `{ animate: false }`) and returns `{ item, run }`.
  - `remove(item = last, opts)` takes the item out of `items` right away, so counts and move size reflect what the player asked for. The item keeps rendering in `leaving` while `exit` plays, and is detached when that run finishes. Resetting that exit run puts the item back at its old index.
  - `clear({ animate })`.
- **Moving:** `setCenter(p)` calls `translate(delta)` on every item. No kind switches, and no stored offsets per item.
- **Resetting:**
  - `animations.resetAll()` resets every run on the composite and its items. Leaving items come back.
  - `reset()` also resets and re-aligns every item's behaviors, which gives a known start state. Games call this between rounds.
  - `finishAll()` jumps everything to its end state. Leaving items are detached.
- **Ticking:** the composite registers on the field as a *controller*. Controllers tick before items, so a composite run's contribution is in place before items stamp.
- **Events:** `added`, `removed`, `animationStart`, `animationEnd`.
- **Serializing:** its own fields, template, and slots, plus each item's `serialize()` made relative to `center` through `translateData`.

Current composites become configurations:

| Composite | Item | Placement | `enter` | `exit` |
|---|---|---|---|---|
| Stone | HotBall | Even phases; siblings' phases eased with a `phase` channel | `orbitIn` (from spawn) | `fadeOut` |
| Scissor | HeatRect (shard) | Angle + TURN | `flyIn` (spin = 360 + TURN) | `fadeOut` |
| Paper | HeatSheet | Stack below previous; ball shift per index | `pairSplitReveal` (span, gap, size, reveal delay) | `fadeOut` |
| New Paper | HeatDisk | Depth + heat / disk / ball gains | `ballsTravelIn` | `diskDrama` (heat, burst, fall, jump, drop) |

The phase spread in Stone is the general "smooth set" pattern. Set the field to its new value right away, and play a short transition that starts the matching channel at (old − new) and eases it to 0. The field is correct immediately, and the motion stays continuous.

### 7. Tick order in the field

Fixed order, every tick:

1. Diffuse the heat.
2. Advance controllers: composites and their runs, and scene timelines.
3. Advance objects: behaviors, then each object's own runs, then compute its effective channels.
4. Stamp the visible objects, in layer order (balls, rods, the rest; same as today).
5. Apply queued structural changes (detaches from finished exit runs, removals).
6. Paint.

Runs never add or remove objects in the middle of steps 2–4. That fixes today's `forEach` over `highlighters` while New Paper removes a sheet from it.

### 8. How today's pieces map over

| Today | After step 1 |
|---|---|
| `UiHotBall` + `motion` object | `HotBall` (fields on the object; `Orbit`, `Follow` behaviors) |
| `UiHotRod` + `emitter` | `HotRod` (`PathLoop`, `Follow`) |
| `UiBackHighlighter`, `UiShard` | `HeatRect`, one class; the shard shows skew / glisten / shape fields |
| `UiSheet` + SheetFx emitter + `travel` | `HeatSheet` + `pairSplitReveal` transition |
| `UiNewSheet` (+ `ballTravel`, `drama`, `spinHost`) | `HeatDisk` + `ballsTravelIn`, `diskDrama` transitions |
| `ballClock` / `glistenClock` / `shapeClock` / `sheetEpoch` checks | Own behaviors per item + `alignTo` |
| `captureLocal` / `applyLocal`, `hotMapStoneWith*Points` | `translate` / `translateData` |
| `armShardFlight` (replaced `stamp`) | `flyIn` transition |
| `finishDramas` polling | Run `done` + end action |
| `HorisontalPulse`, `VerticalPulse`, `VictoryPulse` | One `HotRod` in scripted mode, with a `sweep` transition (offset + `clip`) |
| Health bars via `armHover` / `setHovered(true)` | `HeatRect` items in a `HealthBar` composite, with a `fade` slot |
| `LocalAdvanced` `await pause()` chain + `_visit` | A scene timeline built from the same blocks (`seq`, `par`, `wait`, `call`), ticked by the field |

The old `Ui*` names stay as aliases (`const UiHotBall = HotBall`) until the editor refactor.

### Editors: kept working, not refactored

- A small adapter on `HeatObject` gives the tools what they use today: `params`, `nudgeParam`, `PROP_TABS`, `serialize` / `applySerialized`. Each entry in FIELDS can declare its legacy key (`fromWidth` → `from.width`), so the tabs don't change.
- Composites keep a `parts` getter (`[{ object }]`) and emit `added` / `removed`, which the adapter maps onto `onPartAdded` / `onPartRemoved`.
- The ADD / REMOVE tabs read and write slot params through legacy keys (for example `angleStep` → layout TURN + `enter.spin`).
- New editor features for slots are left for later.

## File layout for this step

```
js/heat/anim/        Run, defineTransition, blocks (tween, seq, par, stagger, wait, set, call, repeat),
                     AnimationSlots, easing, registry
js/heat/anim/lib/    flyIn, orbitIn, fadeIn/fadeOut, shake, burst, phaseEase,
                     pairSplitReveal, ballsTravelIn, diskDrama, sweep
js/heat/objects/     HeatObject, channels, behaviors/ (Follow, Orbit, PathLoop, PoseCycle,
                     GlistenSweep, BallRun, DiskLoop, Spin), HotBall, HotRod, HeatRect,
                     HeatSheet, HeatDisk
js/heat/composites/  HeatComposite, stone, scissor, paper, diskStack, healthBar
js/ui/               Ui* aliases + tools adapter (removed later)
```

These stay classic `<script>` globals in `index.html`, loaded in the order above. The stamp and step math in `js/fx/*` is reused as is. Consolidating it is Phase 1 of the main plan and isn't needed here.

## Steps

Each step ships on its own and keeps every scene working.

### S0: Baseline

- Add the Vitest harness for the pure code (`site/html5Simple/test/`, with a `module.exports` tail on each pure file).
- Golden grid hashes after N fixed frames for: ball, rod, rect, shard, sheet, disk.
- Short screen captures of each composite's add and remove, and of a local advanced round, to compare against visually.

Exit: goldens pass on the current code.

### S1: Animation core (pure, no Phaser)

- Build `Run`, `defineTransition`, the blocks, easing, `AnimationSlots`, and the channel combiner.
- Change the field tick to the order in §7: controllers, deferred structural changes, and runs bound to the field.
- Write the unit tests listed below.

Exit: all the start / reset tests pass. Nothing visible changes yet.

### S2: `HeatObject` + simple kinds

- Build `HotBall`, `HotRod`, and `HeatRect` with behaviors, standard channels, `reset`, `alignTo`, and `translate`.
- Add the old names as aliases, plus the tools adapter.

Exit: goldens are unchanged for ball, rod, rect, and shard. The UI Editor and the Menu skin behave the same.

### S3: Sheet and disk

- Build `HeatSheet` and `HeatDisk`.
- Remove the clock injection, `spinHost`, `ballLead`, and the `travel` / `ballTravel` / `drama` state from items.
- Add their kind channels.

Exit: goldens are unchanged for their loops. The AlterSheet and Sheet sandboxes behave the same.

### S4: Composites

- Build `HeatComposite` plus the Stone, Scissor, Paper, and New Paper configs.
- Write their `enter` / `exit` transitions (`orbitIn`, `flyIn`, `pairSplitReveal`, `ballsTravelIn`, `diskDrama`).
- Move the old composite animation fields into slot params. Load old presets through the adapter keys.

Exit: add and remove look like the S0 captures. The start / reset tests pass on real composites.

### S5: Consumers

- Pulses become `sweep` runs and health bars become a `HealthBar` composite.
- LocalAdvanced plays `enter` / `exit` / pulses through runs and a scene timeline.
- Remove the `_visit` checks, `syncSceneComposites`, `liveOn` / `bindToField`, and the composite part of `bindSceneHeatObjects`.

Exit: a full best-of-5 round plays. Leaving in the middle of a round and coming back leaves nothing running and no stray heat.

### S6: Docs

- Add a transition catalogue: the name, params, required channels, and a one-line description of each.
- Update the composite sections in `SCENES.md` / `UI schema.md`.

## Tests that pin start and reset

Pure unit tests (S1), repeated on real objects in S2–S4:

- `start()` applies frame 0 in the same tick.
- `reset()` gives back exactly the pre-start effective values, bit for bit, even while another run on the same channel keeps going.
- `finish()` equals `seek(duration)` plus the end actions. Calling it twice is harmless.
- Two `restart()` calls in a row give the same frames as one `start()`.
- `seek(t)` matches stepping to t in fixed ticks, within 1e-9.
- `pause()` holds time. `stop()` holds the frame until `reset()`.
- Slot policies: `restart`, `ignore`, `queue`, `parallel`.
- Exit: `reset()` puts the item back at its index, still attached. `finish()` detaches it after the tick.
- `field.destroy()`: every `done` resolves `'destroyed'`, and no callbacks fire afterwards.
- Field STOP: runs and behaviors don't advance. STEP advances exactly one tick.
- `composite.reset()`: every item's behavior state equals that of a freshly built item with the same fields.
- Reuse: two Stones on one field with different `enter` definitions don't affect each other.
- Independence: changing a field on one sheet in a Paper doesn't change any other sheet.

## Open decisions

Recommended defaults first.

1. **Sibling sync.** Align on add and on reset, with each item keeping its own fields (default), or an opt-in shared clock for composites that must stay locked together.
2. **Exit reset.** The item comes back and stays (default), or reset of an exit is not allowed.
3. **Timing feel.** Transitions are duration-based with easing (default; this is what gives start / seek / reset their meaning), with an `expoFollow` ease that keeps today's feel. The alternative keeps today's follow-speed easing, which has no fixed end time.
4. **Parity.** Objects' own loops must match today exactly (grid goldens). Enter / exit transitions must look the same but don't have to match bit for bit, since their timing model changes.

## Out of scope

- Editor refactor and new editor UI for slots
- Heat math consolidation (main plan, Phase 1)
- Preset schema v6 (main plan, Phase 5). This step reads and writes today's formats through the adapter.
- Game `MatchSession` (main plan, Phase 7)
