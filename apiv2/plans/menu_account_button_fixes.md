# Fixes from the live menu test

Three failures on https://vkp-consulting.fr/html5Simple/. The guest path, the choice card, validation, **BACK**, and **CANCEL** already work. This plan covers the rest.

## 1. A bad login comes back as an HTML 500

`POST /apiv2/public/login` for an unknown account returned status 500 and the HTML page `site/api/errors/500.html`. The card only says **Invalid email or password.** when the status is 401, so it showed **Login failed. Please try again.**

`ApplicationError` is `(message, statusCode, code)`. `AuthController.login` constructs it as `(status, message, code)`:

```ts
new ApplicationError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
```

The status that leaves the handler is the sentence, not `401`. API Gateway turns that into 500. CloudFront then replaces every 500 with `/api/errors/500.html` (`terraform/main.tf` `custom_error_responses`). The JSON never reaches the game.

The same swapped call is used for the other throws in `AuthController`, including promote.

### Change

Throw the typed errors, which already pass `(message, status)` into `ApplicationError`:

| Case | Throw |
|---|---|
| Missing email or password, bad email shape, password rules, display name | `ValidationError` |
| Unknown user, wrong password | `UnauthorizedError` with detail **Invalid email or password** and code `INVALID_CREDENTIALS` |
| Too many attempts | Keep 429. Add a small error class with that status, or a `ValidationError` sibling whose `super` sets 429 and `RATE_LIMIT`. Do not pass the status as the message. |
| Email not verified | `ForbiddenError`, code `EMAIL_NOT_VERIFIED` |
| Email already registered | `ConflictError` only if its code can be `EMAIL_EXISTS`. Otherwise a 409 subclass with that code. The card looks for 409 or `EMAIL_EXISTS`. |
| Already a regular user | `ValidationError` is 400 and the card looks for 400 plus `ALREADY_REGULAR`. A 400 subclass with that code, message **You are already a registered user.** |

No `new ApplicationError(...)` remains in `AuthController`.

Add `AuthController` tests with a fake Cognito client. `NotAuthorizedException` and `UserNotFoundException` return 401, `content-type` `application/problem+json`, and a numeric status. A missing password returns 400 with a numeric status.

### CloudFront

401 is not in `custom_error_responses`, so the fixed login response reaches the card. 400 and 500 are in that list, so promote validation and a real server failure are still replaced with HTML.

Remove the 400 and 500 entries from `custom_error_responses`. Leave 403 and 404 so a missing site object still shows the HTML page. API 403 and 404 stay HTML until those two entries go too. That is outside this fix.

After `terraform apply`, a bad login on the live menu shows **Invalid email or password.** and the guest stays signed in.

## 2. The menu never sees a role, so LOG OUT does not appear

The live guest ID token has `cognito:groups: ["guest"]` and no `role` claim. `tokenRole` returns null unless `payload.role` is `guest`, `user`, or `admin`. Null is **SIGN IN**, which is right for this guest and wrong for a `user` or `admin` token issued the same way. The log-out card could not be opened.

`authMiddleware` already reads `custom:role`, then `role`, then defaults to `guest`. It does not read groups. The pre-token trigger is supposed to write `role`, and the pool comment says the trigger is attached by hand. Live tokens do not have the claim, so the menu cannot wait for that trigger.

### Change

`tokenRole` in `site/html5Simple/js/authRole.js`:

1. `custom:role` or `role`, when the value is `guest`, `user`, or `admin`.
2. Otherwise `cognito:groups`, first match in order `admin`, `user`, `guest`.
3. Otherwise null. A display name is still not a role.

`accountButtonLabel` stays as it is. Boot, login, and promote already store `tokenRole(gameAPI.token)`.

Extend `authRole.test.js` with a token shaped like the live guest (`cognito:groups: ['guest']`, no `role`) and one with `cognito:groups: ['user']`. The labels are **SIGN IN** and **LOG OUT**. A token with both `role: 'guest'` and `cognito:groups: ['admin']` stays `guest`, because the claim wins.

On the live menu, a guest still sees **SIGN IN**. Signing in as a regular user or an admin, with a token that only has groups, shows **LOG OUT**, and the confirm card opens. **STAY** closes it. **LOG OUT** clears the game token and reloads into a new guest.

The pre-token Lambda is unchanged here. Attaching it so new tokens carry `role` is a separate deploy.

## 3. The create-account subtitle sits on the email field

The login card places the email field at `top + 96`. The create card places it at `top + 88` with height 54, so the white input covers **Save this guest as a real player.** The login card has a gap and does not do this.

The long email looked cut off because the box is narrower than the string and a filled value does not scroll. Typing scrolls the caret. No CSS change.

### Change

In `drawCreate`, start the fields lower so the email box clears the subtitle by the same gap the login card uses. `fieldStart` moves from `top + 88` to `top + 112`. The card is already 520 tall with empty space above the buttons, so the height stays. Error text moves with the fields and stays above **BACK** and **CREATE ACCOUNT**.

Reload the live create-account step. The subtitle is fully above the email box. An empty submit still says **Email is required.**

## Check

1. `node --test site/html5Simple/js/authRole.test.js`
2. AuthController unit test for 401 and 400.
3. On https://vkp-consulting.fr/html5Simple/ after the static deploy and the API deploy: guest **SIGN IN**, bad login shows **Invalid email or password.**, create-account subtitle is clear of the email field. Log-out still needs an account whose token group is `user` or `admin`.
