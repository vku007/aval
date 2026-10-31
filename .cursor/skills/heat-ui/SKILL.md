---
name: heat-ui
description: >-
  Work on html5Simple Game UI and HotMap UI: heat items, composites, channels,
  behaviours, transitions, pulses, the Blitz game, and the game FPS overlay.
  Use when editing site/html5Simple/js/heat, js/ui heat objects, HotMap
  composites, pulses, UiHeatMap, BlitzGameScene, or scenes that stamp a heat
  field, and when Chrome shows 30 FPS on html5Simple.
---

# Game UI and HotMap UI

Scope is `site/html5Simple` heat objects, composites, pulses, and the scenes that drive them. Design authority, in order:

1. `apiv2/plans/heatmap_step1_ui_objects_transitions.md`
2. `apiv2/plans/heatmap_step1_agent_implementation.md` — wins on names, channels, the run API, slots, and fills
3. `apiv2/plans/heatmap_ui_objects_transitions.md` — only the editor adapter and how the tick sits around diffusion and paint

Step 1 (slices 1a–1h) is implemented. Do not reintroduce the mechanisms it removed.

## Rules

- Scripts are classic globals. There is no bundler. Add a `<script>` in `site/html5Simple/index.html` in the order in [reference.md](reference.md), and bump that file's `?v=`.
- Nodes, behaviours, the animator, and the transition library do not reference Phaser. Only `UiHeatMap` and field attachment do.
- An item owns its fields. It never reads composite fields. `parent` exists only for the group transform.
- A composite changes an item only through `set` / `setFields`, `translate`, `play`, `reset`, `copyBehaviourState`, and layout.
- `composite.set(key, value)` writes that field through every item. Setting one item's own field changes only that item.
- On add, copy the lead item's behaviour state, plus any per-index shift. Do not add a shared clock.
- Transitions write channels only. Fill `commit` is the exception: it writes the final value into fields and clears that slot in the same tick.
- Time comes from the field tick (`UiHeatMap.update` → `field.update`). `stop()` freezes runs and behaviours. `step()` advances one 1/60 s tick. Do not use `scene.tweens` or `scene.time.delayedCall` for heat motion or scene waits. Waiting is `heatFieldWait(field, seconds)` or a `wait` block.
- `play()` on a detached node resolves `cancelled` and warns. `field.destroy()` (scene shutdown) cancels every run. Continuations must return when that visit's field is destroyed or is no longer `this.heatMap.field`. Do not add `_visit` tokens or per-frame rebind.
- Do not add `bindSceneHeatObjects`, `liveOn`, or `bindToField`.
- Lists do not change while they are being iterated. Adds and removes from a run are deferred until after stamp.
- Keep editor surfaces working: `params`, `nudgeParam`, `setParam`, `PROP_TABS`, `serialize`, `applySerialized`, legacy key aliases, `parts` as `[{ object }]`, `onPartAdded` / `onPartRemoved`, `addItem` / `removeItem`. Keep the old constructor names as aliases.
- Do not dedupe palette, diffusion, or clamps. Do not add a preset schema or a transitions panel. Stamp math stays in `js/fx/*`; items call it.

## What to edit

| Change | Where |
|---|---|
| Endless loop (orbit, pose, glisten, spin) | `js/heat/behaviours/behaviours.js`. Copy today's math. Give it `reset`, `advance`, `copyStateFrom`. |
| Finite animation | Compose `move`, `grow`, `spin`, `fade`, `flash`, `shake`, `gather`, `pose`, `sweep` in `js/heat/anim/library/blocks.js`. A new engine is not a new file of stamp patches. |
| One-shot on a rod (pulse) | `HotRod` parked on the end cell, `sweep` from the start offset, `call('detach')`. Duration in seconds, ease `sine`. |
| New composite behaviour | Layout function plus `heatRegisterComposite` on the existing editor class. `createComposite(name, heatMap, overrides)`. |
| Scene sequence | `await node.play(...).finished` or `await heatFieldWait(...).finished`. After every await, return if `!fieldLive(field)`. |

`createItem` names: `hot-ball`, `hot-rod`, `heat-rect` / `back-highlight`, `shard`, `pointer`, `round`, `circle`, `core`, `sheet` / `heat-sheet`, `disk` / `new-sheet` / `heat-disk`.

`createComposite` names: `stone`, `scissor`, `paper`, `diskStack`, `cross`, `prime`, `stonePrime`, `scissorsPrime`, `paperPrime`, `amountIndicator`, `verticalAmountIndicator`, `verticalTableAmountIndicator`.

## Run contract

```js
const run = node.play('enter', ctx);
await run.finished; // { status: 'finished' | 'cancelled' }, never rejects
run.pause(); run.resume(); run.seek(t); run.finish(); run.cancel();
node.cancelAll(); node.reset();
```

Slots (`life`, `react`, `layout`, `hover`, `move`) run together. A busy slot uses the definition's policy: `replace` (default, from `'current'`), `queue`, or `ignore`. Fills: `none` clears, `hold` keeps the final value, `commit` writes fields and clears the channel. `finish()` equals seek-to-end plus the fill; a second `finish()` is a no-op. A `call('detach')` at the end must resolve `finished`, not cancel the run that fired it (`_completing`).

`from` is resolved when the run starts: a literal, `'current'`, or a `$name` from the context frozen at start (`$spawn`, `$turn`, `$duration`, …).

## Tests

From `tests/html5Simple`:

```bash
npm test
```

Idle goldens must stay bit-identical unless stamp math intentionally changed. Then `npm run goldens` and say why. New motion needs a lifecycle case: first frame in the same tick, `cancel` restores that slot, `finish` matches seek-to-end, `seek` matches stepping, destroy resolves `cancelled`. Harness loads scripts with `node:vm`. Add a new heat script to `HEAT_SCRIPTS` in `tests/html5Simple/harness.js` in the same order as `index.html`, and export any name the test calls.

## Frame rate

`#game-fps` (`showGameFps` in `js/game.js`) shows `Math.round(game.loop.actualFps)`. Phaser 3.70 runs its callback on every `requestAnimationFrame`. A steady 30 means Chrome is delivering frames at 30 Hz.

On this Mac that was macOS Low Power Mode while the laptop was unplugged. The menu was idle, the skin was off, and the same page returned to 60 as soon as the laptop was plugged in. Check `pmset -g` for `lowpowermode 1` before changing heat or scene code. The Cursor browser can still report 60 on that URL while the user's Chrome is capped, and a Chrome window that is not frontmost can sit near 30 even on `about:blank`. Measure in the frontmost Chrome window with the laptop plugged in.

A game stall is separate: a frame misses 16.6 ms and Chrome then presents every other vsync. Rebuilding a full-width RenderTexture on every divider move did that on the results bar. Draw the moving panel with Graphics, and rebuild only the small glyph texture when the label string changes.

## Out of scope

Editor redesign, merging the two editors, heat-core dedupe, preset v6, MatchSession, a sandbox scene base class, retuning idle loops.

## Reference

Channel table, file map, composite configs, and the editor adapter: [reference.md](reference.md).
