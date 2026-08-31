# API v2 — `vkp-api2-service`

Lambda on API Gateway HTTP API. Routes: `ANY /apiv2`, `ANY /apiv2/{proxy+}`. Persistence is S3 (`data-1-088455116440`, prefix `json/`). Auth is Cognito JWT + Lambda roles — [AUTH.md](../AUTH.md).

```
apiv2/
├── src/                   # domain / application / infrastructure / presentation
├── plans/                 # design notes (not ops docs)
├── package.json
├── esbuild.config.mjs
├── buildAndDeploy.sh
├── API_DOCUMENTATION.md   # endpoint reference
├── TESTING_GUIDE.md
└── README.md
```

CLI bootstrap, pre-DDD sources, and unauthenticated curl tests live in [`../obsolete/apiv2/`](../obsolete/apiv2/).

## Routes (from `src/index.ts`)

| Prefix | Auth | Role |
|--------|------|------|
| `/apiv2/public/*` | none (Gateway + Lambda) | create-guest, login |
| `/apiv2/external/*` | JWT | any authenticated |
| `/apiv2/internal/*` | JWT | `admin` only |

Internal resources: `files`, `users`, `games` (CRUD + ETag). Games also have rounds/moves/finish. External: `me`, `promote`, `games`. Details: [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

## Local

```bash
cd apiv2
npm ci
npm test
npm run build
npm run zip
```

There is no `npm run deploy`. Tests: Vitest (`index.test.ts` plus unit/integration under `src/`). Live checks: [../scripts/README.md](../scripts/README.md).

## Deploy

```bash
cd apiv2
npm ci && npm test && npm run build && npm run zip
cd ../terraform
terraform apply -target=module.lambda_api2.aws_lambda_function.main
```

Shortcut (skips Terraform): `./buildAndDeploy.sh` after tests. Zip path expected by Terraform: `apiv2/lambda.zip`.

Env on the function (set in Terraform, not `update_lambda_config.sh`): `BUCKET_NAME`, `JSON_PREFIX`, `CORS_ORIGIN`, `APP_TAG`, `ENVIRONMENT`, `MAX_BODY_BYTES`. Region `eu-north-1`.

## Logs

```bash
aws logs tail /aws/lambda/vkp-api2-service --follow --region eu-north-1
```
