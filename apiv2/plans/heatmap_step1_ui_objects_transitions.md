# Step 1: heat UI objects, composites, and transitions

Status: proposal. Implementation order and resolved conflicts: [heatmap_step1_agent_implementation.md](heatmap_step1_agent_implementation.md). Scope: `site/html5Simple` heat objects, composites, pulses, and `LocalAdvancedGameScene`. This is the first step of [heatmap_game_refactor.md](heatmap_game_refactor.md). It replaces that plan's Layers 3 and 5 where they differ. Where this file and [heatmap_ui_objects_transitions.md](heatmap_ui_objects_transitions.md) differ, this file wins.

## Intentions

1. **Items own their fields.** A ball, rod, rect, shard, sheet, or disk holds all of its own state. It doesn't carry fields that only make sense inside a composite, and it works the same alone or inside one.
2. **A composite has many animations.** Enter, exit, reveal, clear, hit, break, and more later. We call them transitions.
3. **Things are reusable:**
   - The same item class is used alone or in any composite.
   - The same composite spec builds the editor default, the player's stack, and the enemy's stack.
   - The same transition (fly in, fade, gather…) works on different kinds.
4. **Start and reset are reliable.** Every animation has a defined start, end, cancel, and reset. Resetting gives exactly the state a fresh object would have.

The editors are tools. In this step they only get the mechanical changes they need to keep working.

## Where animations live today

| Animation | Where its state lives | How it ends | Problem |
|---|---|---|---|
| Stone: a new ball flies in from spawn | `motion.centerFollow` on the ball, set by `HotMapUiStone.addItem` | Orbit center gets within 0.5 cell of target | No cancel, reset, or replay |
| Stone: phases spread when a ball is added | `phaseGoal` / `phaseFollow` on every ball | Angle within 0.02 rad of goal | No completion signal. It writes directly into each ball's live angle |
| Scissor: a shard flies in, grows, and spins | `emitter.travel` plus a replaced `emitter.stamp` | Remaining distance under 0.2% of the start span | Progress comes from the distance to the target, so retargeting the shard mid-flight makes the pose jump. The stamp patch has to undo itself |
| Paper: pair → split → reveal | `travel` stages, `glistenHold`, `glistenAfterMove`, and `travelBallGap` on the sheet | Stage flags | The pair aims at the previous sheet's bottom, measured from that sheet's *current animated* pose, so the path depends on timing |
| Paper: shared ball, shape, and glisten cycle | `ballClock`, `ballLead`, `ballShift`, `glistenClock`, and `shapeClock` written into each sheet, deduped with `field.sheetEpoch` | Never | A sheet can't be understood alone, and removing one needs `clearSheetClocks` |
| New Paper: balls travel in | `ballTravel` on the disk | `u` reaches 1 after 1 s | Starting a drama just drops it |
| New Paper: drama remove | `drama` on the disk. The holder polls `finishDramas()` | Step 3 done, then `onDone` | The holder is registered as a highlighter only so it can poll |
| New Paper: shared spin | `spinHost` pointer on each disk. The disk reads the host's `ballSpin` and `sheetInit.ballSpeed` | Never | The disk's behaviour depends on its holder |
| Pulses | Phaser tween on the scene clock, with `advance` / `stamp` replaced on a rod | Tween complete, which resolves a Promise | Keeps moving when the heat map is stopped, because it runs on a different clock |
| Health bars, menu highlights | Rect hover drive (`armHover`, `setHovered`) | Parks at the end pose | "Hovered" is also used to mean "lost a life" |
| LocalAdvanced outcome sequence | An async chain with scene timers and `_visit` checks | End of the function | Keeps running after the scene exits, so it needs a check after every `await` |

Across all of these, four clocks drive animation:

- the field tick
- Phaser tweens
- scene timers
- per-frame epoch comparisons

The editor's STOP freezes only the first. Most animations end on a distance threshold, because an exponential follow never actually arrives. Nothing can be cancelled, finished early, or reset, and starting one animation over another isn't defined.

## Model

### Three kinds of motion

- **Behaviour**: an item's own endless loop. Examples: orbit spin, rod path loop, rect pose cycle, sheet glisten and ball run, disk pulse and spin. The item owns it, and its parameters are the item's fields. It can be reset and paused.
- **Transition**: a finite, named animation that is started from outside and ends. It writes only to channels (below). It has the full lifecycle.
- **Layout**: a pure function that decides where a composite puts item N and what its fields are. It runs on add, on reset, and when layout settings change.

### Items own their fields

An item has two parts:

- **Fields**: its own individual, serializable settings, such as position, sizes, heat, speeds, and phase.
- **Runtime**: behaviour state, channels, and running transitions.

The rules:

- A composite changes an item only through the item's public API: `setFields`, `translate`, `play`, `reset`, and `copyBehaviourState`.
- The only link from an item to its composite is `parent`, used for the group transform (below). The item never reads composite fields.
- At runtime an item's position is its own absolute field. When a composite is saved, item positions are written relative to the composite center, as today, so one spec can be placed anywhere.

Shared cycles become per-item fields:

- **On add:** the new item copies the lead item's behaviour state, plus a shift: `item.copyBehaviourState(lead, { shift })`.
- **While running:** items tick with the same `dt`, so they stay in sync without a shared clock object.
- **Composite-level settings write through.** For example, `stack.set('ballSpeed', v)` sets every disk's `ballSpeed`.

The consequence: editing one sheet's speed changes only that sheet.

### Channels: the animation layer

Every node has channels, and each channel starts at its identity value. Transitions write only to channels, never to fields. That's what makes cancel and reset safe: clear the channels and the item is back to its fields plus its behaviour.

Each item stamps its fields, then its behaviour state, then its channels, then its parent's group channels.

| Channel | Items | Meaning |
|---|---|---|
| `offset` | all | Cells added to position |
| `rotate` | all | Degrees added to angle |
| `scale` | all | Size multiplier (radius, width/height, thickness, disk radius) |
| `heat` | all | Emitted heat multiplier. 0 hides the item |
| `phase` | HotBall | Degrees added to the orbit angle |
| `clip` | HotRod | Multiplier on the rod's clip span (victory pulse) |
| `pose` | HeatRect | 0…1 blend from the FROM pose to the TO pose. While a transition holds it, it overrides the cycle |
| `shape.heat`, `glisten.gain` | HeatSheet | Ribbon heat and glisten band gain |
| `disk.heat`, `disk.scale` | HeatDisk | Disk heat and radius multipliers |
| `balls.heat`, `balls.scale`, `balls.offset` | HeatSheet, HeatDisk | Applied to the item's own balls |
| `balls.gather` + `balls.gatherAt` | HeatSheet, HeatDisk | 0 = balls at their own spots, 1 = all balls at one point |

Composites have group channels: `offset`, `rotate`, `scale` (all three about the center), and `heat`. These apply to every item as a parent transform. Shaking or flashing a whole stone never touches the balls.

When several transitions touch the same channel at once:

- `offset` and `rotate` add.
- `scale` and `heat` multiply.
- `pose` and `gather` take the latest started value.

### Transition lifecycle

```js
const run = node.play('enter', ctx);   // starts now, returns a run
run.finished;                          // Promise<{ status: 'finished' | 'cancelled' }> (never rejects)
run.pause(); run.resume(); run.seek(t); run.finish(); run.cancel();
node.cancelAll(); node.reset();
```

A run moves through: idle, then running (which can pause and resume), then either finished or cancelled.

**Clock**
- Only the field tick advances runs, with the same clamped `dt` as behaviours.
- Pausing or stepping the field freezes or steps everything.
- There are no Phaser tweens or scene timers inside components. Waiting is a transition too (`wait`).

**Start**
- `from` values are resolved when the run starts. A `from` can be:
  - an explicit value
  - `'current'`, meaning the slot's current value, so an interrupted animation continues smoothly
  - a context value such as `$spawn` or `$turn`, which the composite supplies from its own fields

**Slots**
- Every definition names a slot: `life` (enter/exit), `react` (hit/break), `layout`, `hover`, or `move`.
- Runs in different slots run together.
- Starting a run in a busy slot follows the definition's policy:
  - `replace` (default): cancel the old run and start the new one from the current value
  - `queue`
  - `ignore`

**End (fill)**
- `none` clears the slot. Enter uses it, because it ends at identity anyway.
- `hold` keeps the final value until the slot is reset. Exit and health loss use it.
- `commit` writes the final value into the item's own fields, then clears the slot. Layout moves and phase spread use it, so a later reset starts from the new arrangement.

**Cancel and finish**
- `cancel()` sets the slot back to identity and resolves `cancelled`.
- `finish()` jumps to the end, applies the fill, and resolves `finished`.

**Order inside a tick**
1. Behaviours advance.
2. Runs advance.
3. Completion handlers run.
4. Adds and removes requested by handlers are applied.
5. Items stamp.

Lists never change while they are being iterated.

**Reset**
- `item.reset()` cancels all runs, clears the channels, and resets behaviours from the item's own fields. The result must equal a freshly created item with the same fields; this is tested.
- `composite.reset()` does the same for itself and every item, and runs the layout again.
- `composite.reset({ items: 'spec' })` also rebuilds the item count from the spec, for example to start a new round.

**Detach and destroy**
- Detaching or destroying a node cancels its runs.
- `play()` on a detached node resolves `cancelled` immediately and logs a warning.
- Scene shutdown calls `field.destroy()`. Every run resolves `cancelled`, so sequences stop by themselves. This replaces `_visit`.

**Determinism**
- The same fields and the same `dt` sequence give the same grid.
- Transition durations are in seconds, so every transition has a real end.

### Transition definitions (data, reusable)

The building blocks:

- `tracks`: animate channels over a duration with an ease
- `wait`
- `set`: an instant channel or field value
- `call`: a named hook, such as `detach`
- `sequence`, `parallel`
- `stagger`: the same definition on many targets, each with a delay

Shared library: `move`, `grow`, `spin`, `fade`, `flash`, `shake`, `gather`, `pose`. Kind-specific transitions are compositions of these, not new code:

| Transition | Definition |
|---|---|
| Scissor `enter` | `parallel(move from $spawn, grow from ~0, spin from −(360 + $turn))` |
| Stone `enter` | `move from $spawn` (the ball starts exactly on the spawn point, as today), then composite `spread` (slot `layout`, fill `commit`) |
| Paper `enter` | `sequence(set shape.heat 0, glisten 0, balls.scale 2, gather 1 at $spawn; move gatherAt → $waypoint; parallel(gather 1→0, balls.scale 2→1); wait $splitDelay; set shape.heat 1, glisten 1)` |
| New Paper disk `enter` | `gather 1→0 from $spawn`, 1 s |
| New Paper disk `drama` | `sequence(disk.heat 1→3 in 0.25 s; parallel(disk.scale 1→3, disk.heat 3→0, balls.offset −$jump) in 0.11 s; parallel(gather 0→1 to center + $drop, balls.heat 1→0) in 0.63 s; call detach)`. Today's speeds 400 / 900 / 160 map to those durations exactly. |
| Pulses (horizontal, vertical, victory) | A standalone HotRod plus `move` (plus `clip` for victory), 1.5 s / 1.5 s / 0.75 s, sine ease, then `call detach` |
| Health bar lost | `pose 0→1`, fill `hold`. `reset()` restores the bar for a new match |
| Menu hover | `pose →1` / `pose →0`, slot `hover`, `replace` from current |

The fly-ins today use exponential follow speeds. They become durations with an `expOut` ease. The starting point is `3 / speed` seconds, which covers 95% of the old path; I'll tune by eye. The continuous behaviours (orbit, pose cycle, glisten) keep their current math.

### Composite

```js
class HeatComposite extends HeatNode {
  items         // ordered children, each a full item with its own fields
  template      // item fields copied into each new item (never shared by reference)
  layout        // place(item, index, count, composite): sets that item's fields
  transitions   // name → definition: enter, exit, reveal, clear, hit, break, …
  add(opts)             // create from template, lay out, attach, play 'enter' → { item, run }
  remove(item, opts)    // play 'exit' (or instant), detach when it finishes → run
  clear(opts)           // exit all (staggered) or instantly
  play(name, ctx)       // composite-level transition; targets: self, items, item
  moveTo(cell)          // translates items' own position fields
  reset(opts)
  on('added' | 'removed' | 'transition', fn)
}
```

- Moving a composite translates the items' own fields. Running transitions are relative offsets, so moving or retargeting an item mid-flight keeps the animation smooth.
- Each kind declares `POSITION_FIELDS`. `translate` and the relative save/load use it, which replaces the kind switch in `captureLocal` / `applyLocal`.
- The four composites become configs (spec + layout + transitions):

| Composite | Item | Layout | Transitions |
|---|---|---|---|
| stone | HotBall | Even phases around the center | enter, exit, spread |
| scissor | HeatRect (shard) | Angle step per index | enter (fly-in), exit |
| paper | HeatSheet | Stack by `stackGap`. The pair's waypoint comes from the previous sheet's spec pose, not its animated pose | enter (pair / split / reveal), exit |
| diskStack (New Paper) | HeatDisk | Depth and gains per index | enter, exit (instant), drama |

- Every composite also gets `reveal(count)` (staggered adds), `clear` (staggered exits, 0.32 s apart as LocalAdvanced does today), and `hit` / `break`. The last two start as `shake` / `flash` on the group channels.
- Components are created from specs: `createComposite('stone', field, { center, spawn, …overrides })` and `createItem('hot-ball', field, fields)`. LocalAdvanced's six composites come from three specs.
- A detached composite can be attached to a new field. After `reset()` it's the same as a new one, so reuse across scene visits works either way.

### Class structure

```
HeatNode          id, name, kind, fields, channels, runs, parent,
│                 attach / detach, tick, play, cancelAll, reset, serialize
├─ HeatItem       + behaviours, stamp(grid), translate, copyBehaviourState
│  ├─ HotBall     Orbit (+ Follow for editor taps)
│  ├─ HotRod      PathLoop
│  ├─ HeatRect    PoseCycle                 rect and shard
│  ├─ HeatSheet   PoseCycle, Glisten, BallRunner
│  └─ HeatDisk    DiskLoop, Spin, orbiting balls
└─ HeatComposite  + items, template, layout, transitions library
```

Nodes, behaviours, and the animator don't use Phaser. Only the heat field does, so everything else can be tested in Node.

The field changes are small:

- `addRoot(node)` / `removeRoot(node)`
- the tick order above
- `pause` / `step`
- `destroy()`, which detaches every root

That removes the New-Paper-as-highlighter hack and the `finishDramas` polling.

| Today | After |
|---|---|
| `UiHotBall` | `HotBall` |
| `UiHotRod` | `HotRod` |
| `UiBackHighlighter`, `UiShard` | `HeatRect` (shard shows skew / glisten / shape) |
| `UiSheet` | `HeatSheet` |
| `UiNewSheet` | `HeatDisk` |
| `HotMapUiStone` / `Scissor` / `Paper` / `NewPaper` | composite configs `stone` / `scissor` / `paper` / `diskStack` |
| `HorisontalPulse`, `VerticalPulse`, `VictoryPulse` | HotRod + pulse transitions |

The old names stay as aliases until the editors stop using them.

Item fields that go away (they become transitions, channels, or per-item fields):

- **HotBall:** `centerFollow`, `phaseGoal`, `phaseFollow`
- **Sheet and shard:** `travel`, `glistenHold`, `glistenAfterMove`, `travelBallGap`
- **Paper sheets:** `ballClock`, `ballLead`, `ballShift`, `glistenClock`, `shapeClock`
- **Disk:** `spinHost`, `ballTravel`, `drama`

### Files

```
js/heat/node/         HeatNode, HeatItem, HeatComposite, registry (createItem, createComposite)
js/heat/anim/         Animator, Run, channels, easing, definitions (tracks, wait, set, call, sequence, parallel, stagger)
js/heat/anim/library/ move, grow, spin, fade, flash, shake, gather, pose, pulses
js/heat/behaviours/   Orbit, Follow, PathLoop, PoseCycle, Glisten, BallRunner, DiskLoop, Spin
js/heat/items/        HotBall, HotRod, HeatRect, HeatSheet, HeatDisk
js/heat/composites/   stone, scissor, paper, diskStack
```

These are classic scripts, added to `index.html` in dependency order. The existing FX math files stay where they are in this step. Items call their stamp functions.

## Work breakdown

Each part lands on its own and keeps every scene working.

**1a: Baseline and harness**
- Create `tests/html5Simple/` at the repo root with Vitest, loading the classic scripts into a Node `vm` context. It must stay outside `site/`, because the deploy (`aws s3 sync site/ …`) would publish it.
- Golden tests:
  - each item kind: grid hash after N fixed frames
  - Stone / Scissor / Paper / New Paper: add 3 items, run, hash
- Manual checklist:
  - Composite editor ADD / REMOVE / POP per group
  - Menu skin
  - A full LocalAdvanced match, including leaving mid-animation and coming back
- Reproduce the problem behind the uncommitted rebinding guards and write down its cause.

**1b: Nodes and field roots**
- Add HeatNode / HeatItem.
- The current wrappers become HeatItem subclasses, with loop code moved into behaviours unchanged.
- The field gets roots, deferred mutations, and `destroy()`.

Goldens unchanged.

**1c: Behaviours with reset**
- Add `reset()` and `copyBehaviourState()` on every behaviour, and `item.reset()`.
- Test: reset equals fresh.

**1d: Channels**
- Wire identity channels into every stamp path, and add group channels on composites.

Goldens unchanged.

**1e: Animator**
- Add runs, slots, fills, easing, definitions, and the library.
- Unit test each rule: start from current, replace / queue / ignore, fills, cancel, finish, pause, seek, destroy resolves `cancelled`, and determinism.

**1f: Move ad-hoc animations to transitions**
Move them one at a time, deleting the old item fields each time:
1. Scissor fly-in (removes the stamp patch)
2. Stone enter + spread
3. New Paper enter + drama
4. Paper enter
5. Pulses (removes the tweens and patches)
6. Hover and health bars

**1g: Composites**
- Add HeatComposite and the four configs.
- Drop the shared clocks and the epoch checks.
- Composite params keep today's key names (`newBallInit_radius`, `fromWidth`, `shardSpeed`…) as aliases, so the editor tabs work unchanged.

**1h: LocalAdvanced on the new API**
- The move sequence becomes `await enemy.play('reveal', { count })`, `await loser.play('clear')`, and the pulse transitions.
- `reset()` starts each round.
- Shutdown cancels everything.
- Delete `_visit`, `syncSceneComposites`, `liveOn`, `bindToField`, and `bindSceneHeatObjects` (once 1a's repro is fixed at its cause).

## Done when

- No item has a composite-only field. Every field in the list above is gone.
- Every animation is a behaviour or a transition, runs on the field tick, and can be cancelled, finished, and reset.
- `item.reset()` and `composite.reset()` equal fresh construction, in tests.
- Leaving a scene mid-animation leaves no stray emitters, and every pending `run.finished` resolves `cancelled`.
- The existing resource JSON and saved presets load and look the same. The editors still add, remove, copy, save, and load.

## Not in this step

- Editor redesign. A TRANSITIONS tab with PLAY / RESET per transition is cheap after 1e, but optional.
- Heat core dedupe (palette, diffusion, clamps)
- Preset v6
- MatchSession
- Sandbox scenes

## Decided

1. Shared cycles become per-item fields: copied on add, with composite-level settings writing through. Editing one sheet's or disk's speed then changes only that item.
2. Fly-ins and other enter/exit animations use fixed durations in seconds with an `expOut` ease, tuned to look close to today. Continuous loops keep their current math.
