# Cognito user admin API and table UI

Working design for admin identity management. Ops reference: [API_DOCUMENTATION.md](../API_DOCUMENTATION.md), [AUTH.md](../../AUTH.md).

## Goal

Admins manage Cognito pool users, see the linked S3 game profile (`id` = Cognito `sub`), inspect that user’s games, and read an audit trail of admin actions. Delete is Cognito-only (S3 profile and games stay).

## Auth

All routes are `/apiv2/internal/*`: API Gateway JWT + `authMiddleware` + `requireRole('admin')`. Existing `/apiv2/internal/users` S3 CRUD is unchanged.

## Endpoints

Path param `username` is the Cognito username (email), URL-encoded.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/apiv2/internal/cognito-users` | Paginated list joined with game profile + group |
| POST | `/apiv2/internal/cognito-users` | Create pool user (optional S3 profile) |
| GET | `/apiv2/internal/cognito-users/:username` | Detail: Cognito + profile + recent audit |
| PATCH | `/apiv2/internal/cognito-users/:username` | Update display name, group, password, enabled |
| DELETE | `/apiv2/internal/cognito-users/:username` | Cognito only |
| PUT | `/apiv2/internal/cognito-users/:username/game-profile` | Create or replace S3 profile (`id` = `sub`) |
| PATCH | `/apiv2/internal/cognito-users/:username/game-profile` | Update `name` / `externalId` |
| GET | `/apiv2/internal/cognito-users/:username/games` | Games whose `usersIds` contain this `sub` |
| GET | `/apiv2/internal/audit-logs` | Global admin audit (`targetSub` / `cursor` / `limit`) |

### List query

`limit` (max 60), `cursor` (Cognito pagination token), `emailPrefix`, `group` (`admin` \| `user` \| `guest`).

Join: `ListUsers` (or `ListUsersInGroup` when `group` is set) + membership of `admin`/`user`/`guest` + S3 `json/users/` ids, then `getUser` for matching `sub`s on the current page.

### Create body

`email`, `password` (min 12, letter + number), `displayName`, `group`, `createGameProfile`, optional `gameName` / `externalId`.

### PATCH body

Any of `displayName`, `group`, `password`, `enabled`. Group change removes the user from `admin`/`user`/`guest` then adds the chosen group.

### Guards

403 if the actor deletes, disables, or demotes themselves (group away from `admin`). Compare by Cognito `sub`.

### Games

Scan `IGameRepository.findAll` up to 100 objects, filter `usersIds`. Response `{ games, truncated }`.

### Audit

S3/file keys `json/audit-logs/{targetSub}/{timestamp}-{id}.json`. Actions: `create`, `update`, `delete`, `set-group`, `set-password`, `enable`, `disable`, `upsert-game-profile`.

## UI

[`site/users/index.html`](../../site/users/index.html): table of Cognito users, create form, detail panel (profile, games, audit), orphans tab (S3 ids not in the pool), global audit tab. Cookie `idToken`, `Authorization: Bearer`.

## Infra

Lambda IAM `CognitoUserManagement` includes delete/disable/enable/list-groups. `vkp-api2-service` timeout 15s.

## Out of scope

CloudWatch viewer, Advanced Security auth events, email/username change, cascade delete, React rewrite.
