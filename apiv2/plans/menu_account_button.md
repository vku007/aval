# Menu account button

`MenuScene` has three account buttons: **LOGIN**, **REGISTER**, and **LOGOUT**. They become one button. The label follows the token role. A guest, or a session with no role, sees **SIGN IN**. A regular user or an admin sees **LOG OUT**.

The player name in the corner stays. The button does not repeat it. **START GAME**, **UI TESTS**, **EXIT**, and **SKIN** stay.

## Who counts as signed in

The role is the ID token claim `role`: `guest`, `user`, or `admin`. `GET /apiv2/external/me` does not return a role. The profile name is not a role. A person named "Guest User" with role `user` is signed in. A guest whose name was edited is still a guest.

Boot stores the profile in `currentUser` and also stores `role` from the token that produced that profile. Login and promote replace both. Logout clears both.

| Role on the token | Button |
|---|---|
| `user` | **LOG OUT** |
| `admin` | **LOG OUT** |
| `guest` | **SIGN IN** |
| missing, or no session | **SIGN IN** |

Local play (`SKIP_AUTH`) is the injected admin. The button is **LOG OUT**. Approving logout reloads, and Boot signs that same admin back in. There is no guest on that server.

## The button

One outline button, same width and height as **LOGIN** is today, first in the stack. One heat highlight, stable name **Account**, linked to the button and not to the visible label. The label changes. The highlight does not.

Removing **REGISTER** and **LOGOUT** shortens the stack. The remaining highlights move with **START GAME**, **UI TESTS**, and **EXIT**. The **Login**, **Register**, and **Logout** highlights leave the preset.

## Sign-in sheet

**SIGN IN** opens one card over the menu. The menu stays underneath. The card has three steps. Back from a form returns to the choice. **CANCEL** on the choice closes the card. The overlay does not close it, so a missed tap does not drop a half-filled form.

### Choice

Title **Sign in**. Subtitle **Open an account you already have, or save this guest.**

| Control | Does |
|---|---|
| **LOG IN** | Opens the login form. |
| **CREATE ACCOUNT** | Opens the create-account form. Shown when this session has a token, because promote needs the guest. |
| **CANCEL** | Closes the card. The guest stays. |

With no token, **CREATE ACCOUNT** is absent. The subtitle is **Open an account you already have.** Guest creation already failed in Boot, and this card does not retry it.

### Log in

Same fields as today: email, password. Title **Log in**. Subtitle **Open an account you already have.**

| Control | Does |
|---|---|
| **LOG IN** | `POST /apiv2/public/login`, then `GET /me`. |
| **BACK** | Returns to the choice. Fields are cleared. |

Empty email, a bad email shape, an empty password, and a password shorter than 8 characters stay on the card with the message that exists today. Wrong credentials: **Invalid email or password.** Too many attempts: **Too many attempts. Try again later.** Anything else: **Login failed. Please try again.**

Success closes the card, writes the new profile and role, and sets the corner name. The button becomes **LOG OUT**. The menu does not reload.

### Create account

Same fields as today: email, password, display name. Title **Create account**. Subtitle **Save this guest as a real player.** This is promote. The guest's games stay on this person.

| Control | Does |
|---|---|
| **CREATE ACCOUNT** | `POST /apiv2/external/promote`, then `GET /me`. |
| **BACK** | Returns to the choice. Fields are cleared. |

Validation stays as it is: email required and shaped like an email, password at least 12 characters with a letter and a number. Display name may be empty; the part before `@` is used.

| Result | Message |
|---|---|
| Email already registered | **This email already has an account.** A **LOG IN** link on that line opens the login form with the email filled in. |
| Already a regular user | **You are already a registered user.** The card closes and the button becomes **LOG OUT** if the role is `user` or `admin`. |
| Too many attempts | **Too many attempts. Try again later.** |
| Anything else | **Could not create the account. Please try again.** |

Success is the same as a successful login: close, update the name and role, button becomes **LOG OUT**.

A second tap while a request is in flight does nothing.

## Log-out confirmation

**LOG OUT** opens a short card. It does not log out on the first tap.

Title **Log out**. Body **Leave this account? The game starts again as a new guest. Games on this account stay on this account.**

| Control | Does |
|---|---|
| **STAY** | Closes the card. The account stays. |
| **LOG OUT** | Clears the game token and reloads. Boot mints a new guest. The button is **SIGN IN**. |

**LOG OUT** on the card is the filled button. **STAY** is the outline button. The overlay does not confirm.

Local admin uses the same card and the same reload. Boot then loads the local admin again, so the button is **LOG OUT** once more.

This is the game token in `localStorage`. It does not call the website's Cognito logout page.

## Cases

| # | Who | Action | Result |
|---|---|---|---|
| 1 | Guest | Opens the menu | Corner shows the guest name. Button is **SIGN IN**. |
| 2 | Guest | Taps **SIGN IN** | Choice card. **LOG IN**, **CREATE ACCOUNT**, **CANCEL**. |
| 3 | Guest | **CANCEL** on the choice | Card closes. Still a guest. Button stays **SIGN IN**. |
| 4 | Guest | **LOG IN** with a real account | Card closes. Corner shows that account's name. Button is **LOG OUT**. |
| 5 | Guest | **LOG IN** with a wrong password | Card stays. **Invalid email or password.** Still a guest. |
| 6 | Guest | **CREATE ACCOUNT** with a new email | Card closes. Corner shows the new name. Button is **LOG OUT**. Guest games remain on this person. |
| 7 | Guest | **CREATE ACCOUNT** with an email that exists | Card stays. **This email already has an account.** **LOG IN** on that line opens the login form with the email kept. |
| 8 | Guest | **BACK** from either form | Choice card. Typed fields are gone. |
| 9 | Regular user | Opens the menu | Button is **LOG OUT**. |
| 10 | Regular user | Taps **LOG OUT**, then **STAY** | Card closes. Still that user. |
| 11 | Regular user | Taps **LOG OUT**, then **LOG OUT** | Reload. New guest. Button is **SIGN IN**. The account's games are still on the account. |
| 12 | Admin | Same as 9–11 | Same card, same reload, same new guest. No extra admin action on this button. |
| 13 | No session (guest create failed) | Taps **SIGN IN** | Choice card offers **LOG IN** and **CANCEL**. No **CREATE ACCOUNT**. |
| 14 | No session | **LOG IN** succeeds | Same as case 4. |
| 15 | Local admin | **LOG OUT** approved | Reload. Boot loads the local admin. Button is **LOG OUT**. |
| 16 | Anyone | Taps the button while its card is open | The open card stays. A second card is not launched. |
| 17 | Anyone | Token says `user`, profile name is "Guest User" | Button is **LOG OUT**. The name is not the role. |

## Out of scope

Password rules, Cognito groups, and the guest-token bug where a guest can also land in the `user` group. The button trusts `role`. Fixing that claim is separate.

No logout from a match. The button is on the menu only.

`?layout=` and `?fx=` stay without menu chips.
