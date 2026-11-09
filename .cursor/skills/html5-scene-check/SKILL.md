---
name: html5-scene-check
description: >-
  Check html5Simple Phaser scenes in the Cursor browser. Use when verifying
  site/html5Simple UI, the campaign catalog or map, canvas buttons, or when a
  browser snapshot of the game shows no clickable refs.
---

# html5Simple scene check

Buttons are Phaser objects on a 390×844 canvas (`Scale.FIT` in `js/game.js`). `browser_snapshot` lists no buttons. Read the live scene, then click through the browser tool.

## Where

- Page: `http://127.0.0.1:8099/index.html`, static server rooted at `site/html5Simple`.
- API: `http://127.0.0.1:3000` with `SKIP_AUTH=true`. The player is `test-admin`.
- Campaign modules that do not touch Phaser: `node --test site/html5Simple/js/campaign/campaign.test.js`. That runner does not start a scene.
- Heat goldens stay `npm test` in `tests/html5Simple`. This skill does not replace them.

## Read the scene

Lock the browser tab first. With `Runtime.evaluate` and `returnByValue`:

```javascript
const scene = game.scene.getScenes(true)[0];
const labels = [];
const walk = (o) => {
  if (!o) return;
  if (o.type === 'Text' && o.text) labels.push(o.text);
  if (o.list) o.list.forEach(walk);
};
scene.children.list.forEach(walk);
({ key: scene.sys.settings.key, labels })
```

Wait until the field the scene fills is set before judging labels. On the catalog that field is `catalog`. A screenshot taken in the same beat as the click can still show the previous scene. `activePointer.isDown` just after the click tool does not mean the press missed.

## Click

1. Take the label container's `getBounds()` center. Graphics do not grow those bounds; a centered label's center is the button center. The hit rectangle from `setInteractive` is larger than the text.
2. Turn that into a viewport pixel from `game.canvas.getBoundingClientRect()`: `left + worldX * (rect.width / game.scale.width)`, and the same for Y with `game.scale.height`. The scale size is 390×844.
3. `browser_mouse_click_xy` takes screenshot pixels. Its result echoes `Screenshot position` and `Viewport position`. Divide those once for the ratio, then pass `desiredViewport / ratio`. Passing the viewport pixel itself misses the button.
4. Poll the scene key and the text labels after the click. The accessibility tree stays empty.

A `PointerEvent` dispatched on `game.canvas` can change the first scene and then leave `game.input.activePointer` stuck, so a later `pointermove` never changes `worldX` or `worldY`. If a dispatched event does not move the pointer, stop and use the click tool.

Unlock the browser when the check is finished.

## Cache

The page ignores a script edit until that tag's `?v=` in `site/html5Simple/index.html` changes. Confirm the new global exists on `window` before treating the scene as wrong.
