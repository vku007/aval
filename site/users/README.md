# User Manager

Admin UI at https://vkp-consulting.fr/users/. Hub: [../README.md](../README.md).

Table UI (shared [`../js/admin-common.js`](../js/admin-common.js)) for Cognito pool users (`/apiv2/internal/cognito-users`) with `Authorization: Bearer` from the `idToken` cookie. Needs Cognito role `admin`. Rows that cannot be normalized stay in the table as `unreadable` and do not stop listing.

- Browse: email, display name, group, status, enabled, linked game profile, created
- Create: email, password, display name, group, optional S3 game profile
- Detail: update Cognito fields, enable/disable, set password, upsert game profile, games scan, recent audit. Games fetch failure is a warning, not a blocked user panel.
- Delete: Cognito account only (S3 profile and games remain; they show on the Orphans tab)
- Audit: global `/apiv2/internal/audit-logs`

S3-only user entities are still at `/apiv2/internal/users` (used for orphans). Same table chrome as Entity Manager (`/entities/`) and Game Manager (`/games/`).
