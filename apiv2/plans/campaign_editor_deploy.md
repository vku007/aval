# Campaign editor — deployment plan

Status: implemented in the repo. Not applied to AWS. The signing private key is local only until `terraform/scripts/put-editor-signing-key.sh` stores it in SSM.

A missing signed cookie on `/editor/` redirects to `/login.html?next=/editor/session.html`. `session.html` is a more specific CloudFront behavior and stays public so it can call the API. An invalid cookie still receives the site-wide 403 page, because CloudFront custom errors are distribution-wide.

Design of the tool: [campaign_editor.md](./campaign_editor.md). How it runs on a laptop: [../../tools/campaign-editor/README.md](../../tools/campaign-editor/README.md). This plan is only how that tool is hosted. It does not change Chapter I rules.

## Decision

Host the editor as a static build at `https://vkp-consulting.fr/editor/`, readable only by an `admin` who holds CloudFront signed cookies. Publishing a chapter stays a Lambda release of `chapter-i.json`. The hosted page never writes the repo, S3 player data, or the running API.

Two releases stay separate:

| Release | What changes for players | How it ships |
|---|---|---|
| Editor shell | Nothing. Designers get Open, Bundled, routes, simulation, and Export. | `vite build`, then sync `dist/` to the `editor/` prefix |
| Chapter | The next campaign start uses the new numbers. Runs already started keep the copy they were given. | Commit `chapter-i.json`, `cd apiv2 && npm test`, zip, `terraform apply` the API v2 Lambda |

`ChapterI.ts` parses `chapter-i.json` at build time and exports `CHAPTER_I`. A file sitting in the editor, or in S3, does not reach the game.

## Why this shape

The production bundle already drops **Save to repo**. The button is rendered only when `import.meta.env.DEV` is true (`TopBar.tsx`). `saveToRepo` posts to `/__campaign-editor/save` only in that same branch (`files.ts`). The Vite plugin that writes `apiv2/src/domain/campaign/chapter-i.json` is `apply: 'serve'` (`savePlugin.ts`). A hosted build has nowhere to put that write: there is no git checkout on the CDN.

The editor is a Preact page plus a simulation worker. Battle runs in the browser. It needs no Lambda, no database, and no new bucket.

The built JavaScript contains `chapter-i.json`, because the page imports the apiv2 sources. That prefix must not be world-readable the way `/` and `/html5Simple/` are. A cookie-presence check is not enough: the admin HTML under `/users/` is already downloadable by anyone, and the API is what rejects them. The editor bundle is the sensitive object, so the CDN itself must refuse it.

## Preconditions

Do not publish `/editor/` until all of these are true:

1. `enable_cognito_auth` is true on the live stack. The variable defaults to false in `terraform/variables.tf`. A stack applied with the default has no JWT authorizer, so the cookie-signing route below would not be a control.
2. The signing route is `admin` only, using the existing `authMiddleware` and `requireRole('admin')` in `apiv2/src/app.ts`.
3. `cd tools/campaign-editor && npm test && npm run build` passes, and `dist/` contains neither `Save to repo` nor `/__campaign-editor/save`.

## Target request flow

```
admin browser
  → GET /editor/
  → CloudFront behavior /editor/*
       no signed cookies → 302 /login.html?next=/editor/session.html
  → Cognito Hosted UI → /callback.html (already in Terraform)
  → GET /editor/session.html          public, no chapter data
       script calls POST /apiv2/internal/editor-session with the admin JWT
  → API v2 checks the JWT and the admin role, sets CloudFront signed cookies
       Domain=vkp-consulting.fr  Path=/editor/  Max-Age=3600  Secure  HttpOnly  SameSite=Lax
  → GET /editor/ and /editor/assets/*
       behavior requires the key group
       rewrite function maps /editor/ to /editor/index.html
  → page runs entirely in the browser
  → Export downloads chapter-i.json
  → designer commits, tests, and deploys the API Lambda
```

`session.html` lives at `site/editor/session.html` and is served by the existing public S3 behavior, not by the signed `/editor/*` behavior. It holds no chapter JSON and no simulator.

## Terraform

All of this is one Terraform change. No console resources.

**S3.** Reuse `vkp-consulting.fr`. Prefix `editor/`. Do not add a bucket. The existing OAC policy already allows this distribution to `GetObject`. Do not make the prefix public.

**CloudFront behavior**, more specific than the default, path `/editor/*`:

| Setting | Value |
|---|---|
| Origin | The existing S3 origin |
| Viewer protocol | Redirect to HTTPS |
| Methods | GET, HEAD |
| Cache policy | CachingOptimized |
| Compress | true |
| Function | The existing `vkp-rewrite-index` on viewer-request. A new behavior does not inherit the default association. Without it, `/editor/` looks up a key named `editor` and 403s. |
| Trusted key group | New key group, this behavior only |
| Response headers | HSTS, `X-Content-Type-Options`, `Referrer-Policy`. `Content-Security-Policy` must allow the Vite worker: `worker-src 'self' blob:`. A later site-wide policy that omits `blob:` breaks simulation. |

**Signed cookies.**

- `aws_cloudfront_public_key` and `aws_cloudfront_key_group`.
- The private key is an SSM `SecureString` parameter created outside the repo. Terraform reads it as a data source into the Lambda environment. It is not a tfvars value and not a file in git.
- Cookie resource is `https://vkp-consulting.fr/editor/*` only. TTL 1 hour.
- Custom error response on this behavior only: 403 from a missing signature redirects to `/login.html?next=/editor/`. Do not change the distribution's existing 403 page for the public site.

**API.** One route, `POST /apiv2/internal/editor-session`, on the existing JWT authorizer and `adminOnly()`. It returns `204` and `Set-Cookie` for the three CloudFront cookies. It does not accept a chapter body. No S3 write, no Cognito admin call.

## Build and sync

Vite `base` becomes `/editor/`. Asset URLs in `index.html` must start with `/editor/assets/`.

The built tree is not committed under `site/`. `aws s3 sync site/` must not be the thing that publishes the editor, and it must not delete `editor/` either. Two commands, two prefixes:

```bash
cd tools/campaign-editor
npm ci
npm test
npm run build

aws s3 sync dist/ s3://vkp-consulting.fr/editor/ \
  --exclude ".DS_Store" \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html"

aws s3 cp dist/index.html s3://vkp-consulting.fr/editor/index.html \
  --cache-control "no-cache"

aws cloudfront create-invalidation \
  --distribution-id EJWBLACWDMFAZ \
  --paths "/editor/*"
```

Hashed assets stay immutable. `index.html` is not cached, so a new shell is visible without waiting a day. Invalidation is `/editor/*`, not `/*`.

`site/` sync stays as it is, with one extra exclude once `editor/` exists in the bucket: `--exclude "editor/*"`. Otherwise `--delete` removes the shell.

## What the hosted page can do

| Control | Hosted |
|---|---|
| Bundled, Open, drag-and-drop | Yes. Bundled is the chapter compiled into that shell. |
| Undo, Redo, routes, problems, simulation | Yes. Simulation stays in the worker. |
| Export | Yes. That file is the input to the Lambda release. |
| Resume draft | Yes. `localStorage` on that browser only. |
| Save to repo | No. The control is absent. |
| Publish to players | No. |

After Export, the release is the one already in the editor README: review the diff, `cd apiv2 && npm test`, playtest, zip, apply the API v2 Lambda. Bump `rulesetVersion` when anything but the title, the goal, or a label changes. Update the golden `chapter-i.definition.json` in the same change.

A shell deploy does not deploy a chapter. A chapter deploy does not deploy the shell. If both changed, ship the Lambda first, then rebuild the shell so **Bundled** matches production.

## Explicitly not in this plan

- A `PUT` that stores the chapter in the data bucket and makes Lambda read it on each start. That skips the test gate `ChapterI.ts` runs at startup, and it mixes designer files with player JSON. Revisit only with versioning, an admin route, and the same schema checks.
- Turning `/__campaign-editor/save` into an API route. That handler writes a path on the machine running Vite.
- Copying `dist/` into `site/` and syncing the whole site.
- A public editor, a second hostname, a new bucket, or a new CloudFront distribution.
- WAF on this behavior. The signed cookies are the access control. WAF stays the later, account-wide item from the deployment review.

## Rollout

1. Confirm the live stack has Cognito auth on. If a plan shows the authorizer removed, stop.
2. Add `base: '/editor/'`. Build. Confirm the save URL and the save button are absent from `dist/`.
3. Add the key group, the `/editor/*` behavior, the 403 redirect, and `POST /apiv2/internal/editor-session`. `terraform plan` before apply. The private key stays in SSM.
4. Add `site/editor/session.html` and the `/editor/*` exclude on the site sync.
5. Sync `dist/` with the cache headers above. Invalidate `/editor/*` only.
6. As an admin: login, session page sets cookies, `/editor/` loads, simulation runs, Export downloads. As a guest and signed out: `/editor/` and `/editor/assets/*` return the login redirect, and the asset body is not the bundle.
7. Publish one chapter only through the Lambda path, and confirm a new campaign start picks it up while an already started run does not.

## Rollback

Remove the `/editor/*` behavior and the signing route, invalidate `/editor/*`, and delete the prefix. The public site and the API are unchanged by that removal. Chapter content rolls back by redeploying the previous Lambda zip, not by redeploying the shell.
