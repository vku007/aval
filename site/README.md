# Static site (`vkp-consulting.fr`)

S3 + CloudFront. Source is this folder; there is no build step.

```
site/
├── index.html              # company homepage
├── aval/index.html         # API management hub
├── login.html              # Hosted UI + create-guest
├── callback.html           # OAuth code → cookies
├── logout.html
├── profile.html            # GET /apiv2/external/me
├── entities/ users/ games/ # admin CRUD (JWT + admin)
├── html5Simple/            # Phaser game (public login / guest)
├── errors/                 # browsable error gallery
├── api/errors/             # CloudFront custom error pages
└── assets/
```

Auth: [AUTH.md](../AUTH.md). Deploy: sync this folder to S3, then invalidate CloudFront. Archived pages: [`../obsolete/site/`](../obsolete/site/).

## Public URLs

| URL | What |
|-----|------|
| https://vkp-consulting.fr/ | Marketing homepage |
| https://vkp-consulting.fr/aval/ | Managers + login/profile |
| https://vkp-consulting.fr/login.html | Sign-in (Cognito Hosted UI) or guest (`POST /apiv2/public/create-guest`) |
| https://vkp-consulting.fr/callback.html | OAuth `redirect_uri` (Terraform) |
| https://vkp-consulting.fr/logout.html | After Hosted UI logout |
| https://vkp-consulting.fr/profile.html | Current user |
| https://vkp-consulting.fr/entities/ | Admin JSON files (`/apiv2/internal/files`) |
| https://vkp-consulting.fr/users/ | Admin users |
| https://vkp-consulting.fr/games/ | Admin games |
| https://vkp-consulting.fr/html5Simple/ | Game client (`/apiv2/public` + `/apiv2/external/games`) |
| https://vkp-consulting.fr/errors/ | Preview of branded HTTP error pages |

CloudFront maps 400/403/404/500 to `/api/errors/{code}.html` (see [terraform/main.tf](../terraform/main.tf)). Folder URLs (`/aval/`, `/users/`, …) are rewritten to `index.html` by CloudFront Function `vkp-rewrite-index` (S3 behavior only). `errors/` is the same family of pages for humans; CloudFront does not serve 429/502/503/504 from that gallery.

## Auth in the browser

- **Managers** (`entities/`, `users/`, `games/`, `profile.html`): `idToken` cookie, `Authorization: Bearer`. Missing token → `/login.html`. Admin APIs return 403 for `user` / `guest`.
- **login.html**: Hosted UI (`redirect_uri=.../callback.html`) or guest create. After guest success it currently sends the browser to `/` (homepage), not `/aval/`.
- **html5Simple**: tokens in `localStorage` (`aval_auth_token`); login/register modals call `/apiv2/public/login` and `/apiv2/public/create-guest`.

Mint a token for curl: [scripts/README.md](../scripts/README.md).

## Deploy

```bash
aws s3 sync site/ s3://vkp-consulting.fr/ --exclude ".DS_Store"
aws cloudfront create-invalidation --distribution-id EJWBLACWDMFAZ --paths "/*"
```

`--delete` removes S3 keys that are not in `site/` (including anything still live that was moved to `obsolete/`).

## Admin UIs

Vanilla HTML/JS. Paths are `/apiv2/internal/{files|users|games}` with ETags. User manager notes: [users/README.md](users/README.md).
