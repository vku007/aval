# Login and register fields

Status: implemented. The card stays in Phaser. The boxes are HTML inputs.

Login and register keep the Phaser card. The email, password, and display-name boxes become real HTML inputs laid over that card. Phaser stays on 3.70.0. `createStyledInput` is removed. No API change.

The canvas fields look wrong because they are not inputs. In `createStyledInput` (`site/html5Simple/js/uiFx.js`) the label is centered in the box and the placeholder is drawn 8px below it, so "Email" and "you@email.com" sit on top of each other. Focus hides the placeholder, floats the label, and parks a tweened rectangle at `y = 8`. Typed text is monospace with no clip. The password is a string of `•`. A `keydown` listener appends `event.key` one character at a time, so paste, IME, autofill, and the platform password manager never run. On a phone the OS keyboard often never opens.

## Decisions

1. **The card stays in Phaser.** Title, subtitle, error line, dim layer, and CANCEL / LOGIN / REGISTER stay as they are. `ErrorModalScene` is unchanged. It has no fields.

2. **The fields are HTML, not `Phaser.GameObjects.DOMElement`.** DOMElement is scaled by the canvas CSS transform and fights `Scale.FIT`. The inputs are normal elements on `document.body`, `position: fixed`, above the canvas.

3. **One slot, one control.** Each field keeps the box the scene already reserves: `fieldW` by `max(UI.fieldH, 54)`, gap 14. No floating label. The placeholder is the name: **Email**, **Password**, **Display name**. `aria-label` uses the same words.

4. **The browser owns typing.** Delete the scene `keydown` handlers that append characters, move a fake caret, and trap Tab. Enter submits the form. Escape closes the card. Tab order is email, then password, then display name on register.

5. **Phaser must not take those keys.** Phaser listens on `window`. While the form is open, call `keyboard.disableGlobalCapture()` and do not add a scene key capture. Restore capture when the form is removed.

6. **Values are read from the inputs at submit.** Login still calls `gameAPI.login`. Register still calls `gameAPI.promoteToRegular`. The checks stay the ones already in the scenes: email shape, login password length 8, register password length 12 with a letter and a digit, display name falling back to the mailbox name. Error strings stay on the Phaser error text, including **Logging in...** and **Registering...**.

7. **The form is removed in `shutdown`.** Close, a successful submit, and a scene stop all go through `shutdown`. A leftover form must not sit over the menu.

## Fields

| Scene | Inputs | Types | Autocomplete |
|---|---|---|---|
| `LoginModalScene` | Email, Password | `email`, `password` | `username`, `current-password` |
| `RegisterModalScene` | Email, Password, Display name | `email`, `password`, `text` | `email`, `new-password`, `nickname` |

Font is 16px monospace. `UI.body` is 14, and a field under 16px makes iOS Safari zoom the page, which breaks `Scale.FIT`. Color `#111` on `#fff`. Border 1px `#d0d0d0`, 2px `#111` while focused. Corner radius is 12 game pixels times the canvas scale. Padding is 16 game pixels times that scale. `autocomplete` stays on. No show-password toggle.

The open pop (`fxOpenModal`) scales the card. The inputs do not follow that scale. They are shown at the final rectangle when the open tween ends, and hidden at the start of `fxCloseModal`, before the card shrinks.

## Placement

A pure function maps a game rectangle to CSS pixels:

`canvas.getBoundingClientRect()`, then `left + worldX * (rect.width / game.scale.width)` and the same for Y, width, and height. The scene scale is 390×844. The field's world center is the card center plus the field's local `y`.

Recompute on `window` resize, on `game.scale`'s resize, and after `applyGameFrame` in `game.js`. The form is a child of `document.body`, not `#game-container`. That container is `overflow: hidden`, which clips a password-manager popup. `z-index` is above `#game-fps`.

The form itself is `pointer-events: none`. Only the inputs take hits, so CANCEL and LOGIN still hit the canvas. A canvas tap while the iOS keyboard is up may only dismiss the keyboard. The next tap activates the button. Do not add a workaround in this change.

## What is deleted

`createStyledInput` has no other caller. Delete it, and delete `emailValue`, `passwordValue`, `displayNameValue`, `activeField`, `setActiveField`, `updateDisplay`, and `syncCaret` from both scenes. `MenuScene` still launches the same scenes with the same success callbacks.

## Docs and checks

Update the Login and Register rows in `site/html5Simple/SCENES.md` to say the fields are HTML inputs on the card. No change to `AUTH.md`. The tokens and endpoints stay as they are.

Bump `?v=` on every changed script and on `css/style.css` in `site/html5Simple/index.html`.

Test the rectangle function with `node --test`. Check the scenes in the browser at `http://127.0.0.1:8099/index.html`:

- Login, empty: placeholders read **Email** and **Password**, with no second line through them.
- Type, paste, and autofill an email. The text stays inside the box.
- Password shows the platform dots. Enter submits. Escape closes and the inputs are gone.
- Register: three fields, Tab order email → password → display name.
- Resize the window while the card is open. The inputs stay on the boxes.
- CANCEL and LOGIN still fire. A failed login still prints **Invalid email or password** on the card.
