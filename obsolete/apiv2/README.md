# Archived API v2 files

Not used by the live Lambda. Current package: [apiv2/README.md](../../apiv2/README.md).

**commands/** and **commands.txt** — AWS CLI that created the bucket, Lambda, IAM snippets, and HTTP API routes before Terraform. Same for `role-policy.json`, `trust.json`, `update_lambda_config.sh`.

**scripts/update-cloudfront-error-handling.sh** — one-off CloudFront error-page apply. Error pages and CloudFront are Terraform + `site/api/errors/`.

**openapi.yaml**, **commands/COMPLETE_OPENAPI.yaml**, **commands/COMPLETE_API_DOCUMENTATION.md** — specs for unauthenticated `/apiv2/files` (no `/internal`, no Cognito). Living reference: [apiv2/API_DOCUMENTATION.md](../../apiv2/API_DOCUMENTATION.md).

**test-game-api.sh**, **test-user-integration.sh**, **quick-test-commands.txt**, **test-data.json** — curl against `/apiv2/games` and `/apiv2/users` without JWT. Those routes 401 now. Live checks: [scripts/README.md](../../scripts/README.md).

**src/** — pre-DDD handler (`app.ts.old`, `s3.ts`, `errors.ts`, …) and unused duplicate entry `index-with-auth.ts`. Build entry is `apiv2/src/index.ts`.
