# Menu account button — UI plan

Status: implemented. The design is [menu_account_button.md](./menu_account_button.md). This plan is how the html5Simple menu implements it.

The card stays in Phaser. Email, password, and display name stay HTML inputs (`mountAuthFields` in `site/html5Simple/js/authFields.js`). No API change. `GET /apiv2/external/me` still has no role. The button reads the ID token claim `role`.

## Files

| Change | File |
|---|---|
| One account button, label from `role` | `site/html5Simple/js/scenes/MenuScene.js` |
| Boot writes `role` next to `currentUser` | `site/html5Simple/js/scenes/BootScene.js` |
| New overlay, three sign-in steps and the log-out card | `site/html5Simple/js/scenes/AccountModalScene.js` |
| Remove | `site/html5Simple/js/scenes/LoginModalScene.js`, `site/html5Simple/js/scenes/RegisterModalScene.js` |
| `tokenRole` and `accountButtonLabel` | `site/html5Simple/js/authRole.js` |
| Optional initial value on a field | `site/html5Simple/js/authFields.js` |
| Scene list | `site/html5Simple/js/game.js` |
| Script tags and `?v=` | `site/html5Simple/index.html` |
| Menu frames | `site/html5Simple/js/ui/UiStageMarkup.js` |
| Highlight named **Account**; **Login**, **Register**, **Logout** leave | `site/html5Simple/resources/ui-editor-init.json` |
| Preset cache query | `site/html5Simple/js/ui/UiSkin.js` (`UI_SKIN_JSON_PATH`) |
| Scene list and menu copy | `site/html5Simple/SCENES.md`, `site/html5Simple/UI schema.md` |

`ErrorModalScene` stays the red error window. START GAME, UI TESTS, EXIT, and SKIN stay. EXIT stays a stub.

## Role

`role` is a registry value beside `currentUser`. The profile name is never the role. A profile named "Guest User" with role `user` is signed in.

`authRole.js` is a classic global, loaded before `BootScene.js`. Two pure functions:

- `tokenRole(idToken)` reads the JWT payload claim `role`. The value counts only when it is `guest`, `user`, or `admin`. A missing token, a bad payload, or any other claim yields `null`. The client does not check the signature. API Gateway already accepted the token.
- `accountButtonLabel(role)` returns **LOG OUT** for `user` and `admin`. Every other value, including `guest` and `null`, returns **SIGN IN**.

Who writes the registry:

| Moment | `currentUser` | `role` |
|---|---|---|
| Boot, `gameAPI.localMode` | `getMe()` after `clearAuth()` | `admin`. This is local play (`SKIP_AUTH`). There is no token to decode. |
| Boot, stored token | `initAuth()` | `tokenRole` of that token |
| Boot, guest create | `loginAsGuest()` | `tokenRole` of the new token |
| Boot, guest create failed | `null` | `null` |
| Login or promote success | the `getMe()` profile | `tokenRole` of the token `gameAPI` just stored |
| Log out approved | `null`, then reload | `null`, then reload |

`gameAPI.login` and `gameAPI.promoteToRegular` already replace the token and then call `getMe()`. The menu writes both registry values in the success callback. The menu does not reload.

## The button

`MenuScene.create` builds one outline button where **LOGIN** is today: width `UI.menuBtnW` (320), height `UI.menuBtnH` (56), first in the stack. The stack is **SIGN IN** or **LOG OUT**, **START GAME**, **UI TESTS**, **EXIT**. Gap stays 16. The vertical centering formula stays:

`120 + (height - 120 - 28 - 16 - 12 - totalHeight) / 2`

On 390×844 the four-button stack is 280px tall and starts at y = 314.

The visible label is `accountButtonLabel(this.registry.get('role'))`. The button stores a stable `heatName` of `Account`. `linkMenuHighlights` matches a highlight to `heatName` when the button has one, and to `menuLabel` for **START GAME**, **UI TESTS**, and **EXIT**. The highlight name does not follow the label.

A successful login or promote updates the corner with `Player: ${name}` and sets the button text. When the skin is on, call `styleUiSkinMenuButton` again so the knocked-out letters match the new word. Leave the **Account** highlight where it is.

The name check `user.name !== 'Guest User'` in `onRegisterClick` goes away with that button.

Tap behavior:

| Label | Tap |
|---|---|
| **SIGN IN** | Launch `AccountModalScene` with `mode: 'sign-in'`. |
| **LOG OUT** | Launch `AccountModalScene` with `mode: 'logout'`. |

If `AccountModalScene` is already active, the tap returns. A second card is not launched.

`uiMenuMarkupBoxes` uses the same four-button stack. The first frame is labeled **SIGN IN**. The editor MENU frames follow that stack. SKIN stays the bottom frame.

## Heat preset

In `resources/ui-editor-init.json`, delete the **Login**, **Register**, and **Logout** highlighters. Add **Account** with Login's pose (from 106×18 heat 0.1, to 108×22 heat 0.9, cycling off, speed 6, delay 0.5, gap 0.4). **Start Game** keeps its taller pose (from height 22, to height 26). **UI Tests** and **Exit** keep their poses. **Back Highlight 2** stays hidden and unmoved.

Centers use the same cell mapping the current preset uses. The menu field is 3px cells: 130×281 on 390×844. Column stays 64.5. Row is `centerY / 844 * 280`.

| Highlight | Button center Y | `center.row` and `target.row` |
|---|---|---|
| Account | 342 | 113.4597 |
| Start Game | 418 | 138.6730 |
| UI Tests | 494 | 163.8863 |
| Exit | 566 | 187.7725 |

Bump the `?v=` on `UI_SKIN_JSON_PATH` in `UiSkin.js`.

## Sign-in sheet

One scene, key `AccountModalScene`. It replaces `LoginModalScene` and `RegisterModalScene` in `game.js` and `index.html`. The dim layer is the same rectangle the login card uses today (`_fxTargetAlpha` 0.5, interactive, no pointer handler). A tap on it does nothing. `fxOpenModal` runs once, when the scene opens. Changing step swaps the card contents and does not replay the pop.

`mountAuthFields` accepts an optional `value` on each field and writes it onto the input before show. Choice and log-out mount no fields. Entering a form mounts that form's fields. Leaving a form calls `destroy()`, which is what clears them. `shutdown` still destroys a leftover form.

While `isSubmitting` is true, every control on the card returns. The status line stays on the error text: **Logging in...** or **Creating account...**

Escape follows the outline dismiss of the current step. On a form it is **BACK**. On the choice it is **CANCEL**. On log-out it is **STAY**.

### Choice

Title **Sign in**. Subtitle **Open an account you already have, or save this guest.** when `gameAPI.token` is set. Subtitle **Open an account you already have.** when it is not.

Three full-width outline buttons, stacked, height `UI.touchMin`, inside the same card width the login card uses (`Math.min(350, width - 24)`). **CREATE ACCOUNT** is omitted when there is no token, and the card is only as tall as the buttons it has.

| Control | Result |
|---|---|
| **LOG IN** | Login step. |
| **CREATE ACCOUNT** | Create-account step. Present only with a token. |
| **CANCEL** | `fxCloseModal`. The guest stays. |

### Log in

Same card height (400) and the same two field rectangles as `LoginModalScene` today. Title **Log in**. Subtitle **Open an account you already have.** Fields: email (`username`), password (`current-password`). **BACK** is the left outline button. **LOG IN** is the right filled button.

Validation copy stays: **Email is required**, **Invalid email format**, **Password is required**, **Password must be at least 8 characters**.

| Result | Message |
|---|---|
| 401 | **Invalid email or password.** |
| 429 | **Too many attempts. Try again later.** |
| Anything else | **Login failed. Please try again.** |

Success calls the menu callback with the profile, then closes. The menu writes `currentUser` and `role` and sets the corner name. The button becomes **LOG OUT**.

**BACK** destroys the fields and shows the choice.

### Create account

Same card height (520) and the same three field rectangles as `RegisterModalScene` today. Title **Create account**. Subtitle **Save this guest as a real player.** Fields: email (`email`), password (`new-password`), display name (`nickname`). **BACK** is the left outline button. **CREATE ACCOUNT** is the right filled button.

Validation copy stays: email required and shaped like an email, password required, at least 12 characters, a letter and a number (**Password must contain letters and numbers**). An empty display name is sent as the part before `@`.

Submit calls `gameAPI.promoteToRegular`.

| Result | What the card does |
|---|---|
| Email already registered (`409` or `EMAIL_EXISTS`) | **This email already has an account.** A **LOG IN** text button on that line opens the login step with that email filled in and the password empty. |
| Already a regular user (`ALREADY_REGULAR`) | **You are already a registered user.** If `tokenRole` of the current token is `user` or `admin`, the card closes and the menu button becomes **LOG OUT**. Otherwise the card stays on that sentence. |
| 429 | **Too many attempts. Try again later.** |
| Anything else | **Could not create the account. Please try again.** |

Success is the same menu update as login.

## Log-out card

`mode: 'logout'` on the same scene. No fields. Title **Log out**. Body **Leave this account? The game starts again as a new guest. Games on this account stay on this account.**

| Control | Look | Result |
|---|---|---|
| **STAY** | Outline, left | Close. The account stays. |
| **LOG OUT** | Filled, right | `gameAPI.clearAuth()`, registry `currentUser` and `role` set to `null`, `window.location.reload()`. |

The overlay does not confirm. Local admin uses this card. After reload, Boot sets `role` to `admin` again, so the button is **LOG OUT**.

This clears `aval_auth_token` through `clearAuth`. It does not open the website Cognito logout page.

## Docs

In `SCENES.md`, the menu launches `AccountModalScene` and returns by stopping that overlay. Log out still reloads into Boot. The menu button list is **SIGN IN** or **LOG OUT**, **START GAME**, **UI TESTS**, **EXIT**. The skin row describes four highlights plus the hidden one, with **Account** on the first button. Replace the Login and Register scene rows with one Account row that lists the choice, the two forms, and the log-out card. The transition rows become Menu → Account and Account → Menu.

In `UI schema.md`, the MenuScene paragraph names the four visible highlights: **Account**, **Start Game**, **UI Tests**, **Exit**.

Leave `AUTH.md` as it is. Tokens and endpoints stay. Leave [login_html_fields.md](./login_html_fields.md) as the record of how the HTML fields were added. Those fields now live on `AccountModalScene`.

Bump `?v=` on every changed script in `index.html`.

## Checks

`node --test site/html5Simple/js/authRole.test.js`, same `node:vm` load as `authFields.test.js`:

| `role` | Label |
|---|---|
| `user` | **LOG OUT** |
| `admin` | **LOG OUT** |
| `guest` | **SIGN IN** |
| `null`, `''`, `'Guest User'` | **SIGN IN** |

`tokenRole` on a payload `{ "role": "user" }` returns `user`. A payload whose `role` is missing, or is anything outside `guest` / `user` / `admin`, returns `null`. A token that does not split into three parts returns `null`.

Heat goldens stay `npm test` in `tests/html5Simple`. This change does not touch stamp math. Idle goldens stay bit-identical.

Browser, `http://127.0.0.1:8099/index.html`. Canvas buttons have no snapshot refs; read the live scene labels, then click the label center (see the html5 scene check). `127.0.0.1` is local play, so Boot's role is `admin` and the button is **LOG OUT**. That host covers the log-out card and case 15. Guest cases need a host where `gameAPI.localMode` is false.

| # | Check |
|---|---|
| 1 | Guest menu: corner shows the guest name. Button is **SIGN IN**. |
| 2 | **SIGN IN** opens the choice with **LOG IN**, **CREATE ACCOUNT**, **CANCEL**. The menu stays underneath. |
| 3 | **CANCEL** closes it. Still a guest. |
| 4 | **LOG IN** with a real account closes the card, sets the corner name, and the button is **LOG OUT**. The menu does not reload. |
| 5 | A wrong password stays on the card with **Invalid email or password.** |
| 6 | **CREATE ACCOUNT** with a new email closes the card. Corner shows the new name. Button is **LOG OUT**. |
| 7 | An email that already exists stays on the card with **This email already has an account.** **LOG IN** on that line opens the login form with the email kept. |
| 8 | **BACK** from either form shows the choice. The inputs are gone. |
| 9 | A `user` or `admin` menu opens with **LOG OUT**. |
| 10 | **LOG OUT** then **STAY** closes the card. The account stays. |
| 11 | **LOG OUT** then **LOG OUT** reloads. The new session is a guest. Button is **SIGN IN**. |
| 12 | Admin uses the same card and the same reload. |
| 13 | No token: the choice has **LOG IN** and **CANCEL**. |
| 14 | Login from that choice matches case 4. |
| 15 | Local admin: approving **LOG OUT** reloads back to **LOG OUT**. |
| 16 | Tapping the menu button while the card is open leaves the open card alone. |
| 17 | Role `user` and name "Guest User": button is **LOG OUT**. |

Also: a second submit while the request runs does nothing. A tap on the dim layer leaves the card open. With the skin on, **Account** sits on the first button for both labels, and **Start Game**, **UI Tests**, and **Exit** sit on those buttons. The editor MENU frames match the four-button stack.
