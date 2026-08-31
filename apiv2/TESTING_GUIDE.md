# API v2 testing

## Unit and integration (Vitest)

From `apiv2/`:

```bash
npm test
```

Coverage is the `src/**/*.test.ts` suite (controllers, services, entities, `src/integration/`). There is no `npm run test:coverage` or `npm run test:integration` script.

Handler tests mock S3 and send HTTP API v2 events at `src/index.ts`. They do not call AWS.

## Live API (Cognito)

Internal CRUD needs an **admin** ID token. Public/guest does not.

```bash
# Guest create + GET /apiv2/external/me
./scripts/test-guest-user.sh

# Internal files: admin → 200/201/204, user/guest → 403
./scripts/test-entity-endpoints.sh "$ID_TOKEN" admin
```

How to mint a token: [scripts/README.md](../scripts/README.md). Full walkthrough: [scripts/INTEGRATION_TEST_QUICKSTART.md](../scripts/INTEGRATION_TEST_QUICKSTART.md).

Unauthenticated `GET /apiv2/external/me` and `GET /apiv2/internal/files` must be **401** from API Gateway.

## Paths

Use `/apiv2/internal/...` for admin resources, not `/apiv2/files` or `/apiv2/games`. Those old curl scripts (`test-game-api.sh`, `test-user-integration.sh`) are in [`obsolete/apiv2/`](../obsolete/apiv2/).

---

**Last updated**: August 2026
