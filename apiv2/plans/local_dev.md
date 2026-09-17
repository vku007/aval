# Local API host

Run apiv2 on localhost with filesystem persistence. Not a Cloud/LocalStack emulator: Node HTTP + JSON files that match the S3 key layout and ETag contract.

## Run

```bash
cd apiv2
npm ci
npm run dev
```

Listens on `http://localhost:3000` (override with `PORT`). Data files go in `apiv2/.local-data/` (`DATA_DIR`). Auth is skipped (`SKIP_AUTH=true`). CORS origin defaults to `*`.

```bash
curl http://localhost:3000/apiv2/internal/games
curl -s -X POST http://localhost:3000/apiv2/internal/games \
  -H 'content-type: application/json' \
  -d '{"id":"game-1","usersIds":["user-1"],"rounds":[]}'
```

Protected `/apiv2/external/*` and `/apiv2/internal/*` routes do not need a Bearer token. Public `create-guest` / `login` still call Cognito; do not use them for local load tests.

## Env

| Variable | `npm run dev` | Meaning |
|----------|----------------|---------|
| `SKIP_AUTH` | `true` | Existing middleware bypass; fake admin `test-admin`. Never set on the deployed Lambda. |
| `DATA_DIR` | `./.local-data` | If set, filesystem repos. If unset, S3 (production). |
| `CORS_ORIGIN` | `*` | CORS allow origin |
| `PORT` | `3000` | Listen port |
| `JSON_PREFIX` | `json/` | Same prefix as S3 keys |

## Layout

```
$DATA_DIR/json/games/{id}.json
$DATA_DIR/json/users/{encodedId}.json
$DATA_DIR/json/{encodedId}.json
```

JSON bodies omit `id` (it is the filename). ETag is MD5 of the body. `If-Match` / `If-None-Match: *` match production errors.

## Wiring

- [`src/app.ts`](../src/app.ts) — shared composition (`createRouter`). `DATA_DIR` selects File vs S3 repos.
- [`src/local.ts`](../src/local.ts) — Node `http` server.
- [`src/index.ts`](../src/index.ts) — Lambda handler only. esbuild still bundles this entry; local.ts is not in `lambda.zip`.
