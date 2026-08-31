# Authentication and authorization

How identity and access work today: Cognito issues tokens, API Gateway checks they are valid JWTs, API v2 Lambda enforces roles.

## Layers

```
Browser / game client
        │
        ├─ Hosted UI (OAuth code) ──► callback.html ──► cookies (idToken)
        ├─ POST /apiv2/public/login ──► Cognito USER_PASSWORD_AUTH ──► tokens in JSON
        └─ POST /apiv2/public/create-guest ──► AdminCreateUser + tokens in JSON
                    │
                    ▼
           Authorization: Bearer <ID token>
                    │
CloudFront ──► API Gateway HTTP API (wmrksdxxml)
                    │
     ┌──────────────┼──────────────┐
     │              │              │
 /api/*      /apiv2/public/*   /apiv2/* (rest)
 no JWT          no JWT         JWT authorizer
     │              │              │
     ▼              ▼              ▼
 λ simple      λ api2          λ api2
               (open)     authMiddleware + requireRole
```

| Layer | What it checks | Failure |
|-------|----------------|---------|
| API Gateway JWT | Token present, signature, issuer, audience (`CLIENT_ID`) | `401 Unauthorized` (gateway body) |
| `authMiddleware` | Same JWT via JWKS; attaches `request.user` | `401` RFC 7807 from Lambda |
| `requireRole` | `request.user.role` is in the allowed list | `403 Forbidden` |

`/api/*` (simple Lambda) has **no** Cognito check.

## Identity (Cognito)

| Item | Value |
|------|--------|
| User Pool | `eu-north-1_OxGtXG08i` (`vkp-user-pool`) |
| App client | `77e2cmbthjul60ui7guh514u50` (public, no secret) |
| Domain | `https://vkp-auth.auth.eu-north-1.amazoncognito.com` |
| Groups | `admin` (precedence 1), `user` (2), `guest` (3) |
| OAuth | authorization code + implicit; scopes email, openid, profile, `aws.cognito.signin.user.admin` |
| Auth flows | `USER_PASSWORD_AUTH`, `USER_SRP_AUTH`, refresh |
| Callbacks | `https://vkp-consulting.fr/callback.html`, `/` |
| Logout | `https://vkp-consulting.fr/`, `/logout.html` |
| Token TTL | ID/access 60 minutes, refresh 30 days |

An **Identity Pool** (`vkp_identity_pool`) maps groups to IAM roles. HTTP API routes use JWT, not IAM `execute-api` auth, so those roles are not what the REST API uses.

`obsolete/lambda/edge/` (CloudFront viewer-request) was never attached to CloudFront.

### Triggers

Must stay attached on the user pool (circular dependency with Terraform; re-attach after trigger deploys — see [terraform/README.md](terraform/README.md)).

1. **Pre-signup** (`vkp-cognito-pre-signup`) — `@vkp.local` / `@guest.vkp` emails are auto-confirmed and auto-verified; other emails are not auto-confirmed.
2. **Post-confirmation** (`vkp-cognito-post-confirmation`) — adds the user to `guest` if there is **no** email, otherwise `user`. Admins are assigned to `admin` by hand (`scripts/create-test-user.sh` or console).
3. **Pre-token-generation** (`vkp-cognito-pre-token-generation`) — puts `role`, `display_name`, and `email` on the ID token. Role pick: `admin` > `user` > `guest`.

API v2 reads `custom:role` first, then `role`.

Guest users created via `POST /apiv2/public/create-guest` get a dummy `@vkp.local` email. The controller also `AdminAddUserToGroup(guest)`. Post-confirmation still sees an email and may add `user` as well. If both groups are present, the token **role is `user`**.

## How clients get a token

**Hosted UI (admin / regular users on the site)**  
1. Redirect to Cognito `/login` with `response_type=code` and `redirect_uri=.../callback.html`.  
2. [`site/callback.html`](site/callback.html) exchanges the code at `/oauth2/token`.  
3. Stores `idToken` / `accessToken` cookies (`Secure; SameSite=Strict`).  
4. API calls send `Authorization: Bearer <idToken>` (see [`site/users/index.html`](site/users/index.html), [`site/profile.html`](site/profile.html)).  
5. Logout: clear cookies, Hosted UI `/logout`, then [`site/logout.html`](site/logout.html) or `/`.

**Password API (game client)**  
[`site/html5Simple/js/api.js`](site/html5Simple/js/api.js) calls:

- `POST /apiv2/public/create-guest` — `AdminCreateUser` + permanent password + `InitiateAuth`; returns ID/access/refresh in JSON.
- `POST /apiv2/public/login` — `{ email, password }` → `USER_PASSWORD_AUTH`.
- `POST /apiv2/external/promote` — authenticated; guest → regular user (Cognito attributes/groups + new tokens).

Lambda needs IAM `CognitoUserManagement` on `vkp-api2-service-role` for those admin Cognito APIs.

## API v2 authorization

Router: [`apiv2/src/index.ts`](apiv2/src/index.ts). Middleware: [`auth.ts`](apiv2/src/presentation/middleware/auth.ts), [`requireRole.ts`](apiv2/src/presentation/middleware/requireRole.ts).

| Prefix | Gateway JWT | Lambda | Who |
|--------|-------------|--------|-----|
| `/apiv2/public/*` | no | none | anyone |
| `/apiv2/external/*` | yes | `authMiddleware` (any role) | guest, user, admin |
| `/apiv2/internal/*` | yes | `authMiddleware` + `requireRole('admin')` | admin only |

`requireGroup` and `requireOwnership` exist but are unused on the live router. `SKIP_AUTH=true` (tests) skips JWT and injects a fake admin.

### External vs internal

- **External** — the signed-in player: `/me`, promote, create/get/update own games.
- **Internal** — CRUD for files, users, games, rounds, moves.

API Gateway JWT does not look at groups. A guest with a valid token can call `/apiv2/internal/files` at the gateway and still gets **403** from Lambda.

## Simple API v1

`ANY /api` and `ANY /api/{proxy+}` → `vkp-simple-service`. No authorizer, no Cognito env vars.

## Status codes

| Situation | Source | Typical body |
|-----------|--------|----------------|
| No/invalid/expired token on `/apiv2` except `/public` | API Gateway | `{ "message": "Unauthorized" }` |
| Missing/invalid token if the request reached Lambda | Lambda | RFC 7807 `UnauthorizedError` |
| Authenticated but wrong role | Lambda | RFC 7807 `ForbiddenError` |
| Public login with bad credentials | Lambda | 401 `INVALID_CREDENTIALS` |

## Tests and ops

- Walkthrough: [scripts/INTEGRATION_TEST_QUICKSTART.md](scripts/INTEGRATION_TEST_QUICKSTART.md)
- Cognito helpers: [scripts/README.md](scripts/README.md)
- Static site: [site/README.md](site/README.md)
- Resource IDs: [terraform/INFRASTRUCTURE_DATA.md](terraform/INFRASTRUCTURE_DATA.md)
- Terraform auth wiring: [terraform/README.md](terraform/README.md)

---

**Last updated**: August 2026
