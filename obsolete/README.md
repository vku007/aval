# Obsolete documentation archive

These files are historical snapshots from 2025 (Terraform migration, API refactor, Cognito rollout). They are **not current** and must not be used as operational documentation.

Current docs live at:

- [README.md](../README.md) — project overview
- [DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md) — navigation
- [INFRASTRUCTURE_OVERVIEW.md](../INFRASTRUCTURE_OVERVIEW.md) — architecture
- [terraform/README.md](../terraform/README.md) — Terraform operations

## What is here

**Root snapshots** — completed feature status, refactor summaries, Cognito implementation plans, and original AWS CLI bootstrap notes (`commands.txt`, `changes.json`, `getCertificat.sh`).

**terraform/** — one-time state import scripts and the Oct 2025 migration checklist. For current resource IDs use `terraform output` or [terraform/INFRASTRUCTURE_DATA.md](../terraform/INFRASTRUCTURE_DATA.md).

**lambda/** — AWS CLI scripts that created the simple Lambda and HTTP API before Terraform (`commands/`, `commands.txt`); original “CreateDataService” plans (`tasks/`); unused Lambda@Edge viewer-request (`edge/`, never attached to CloudFront). Live packages: [lambda/README.md](../lambda/README.md).

**scripts/** — browser token helpers (`get-token.js`, `get-token-from-browser.sh`). Token copy-paste lives in [scripts/README.md](../scripts/README.md). Live Cognito/API scripts: same folder.

**apiv2/** — AWS CLI that created the API v2 Lambda, bucket policy, and HTTP API routes (`commands/`, `commands.txt`, IAM JSON); unused pre-DDD sources (`src/app.ts.old`, `s3.ts`, `index-with-auth.ts`); unauthenticated curl tests and OpenAPI for `/apiv2/files`. Live package: [apiv2/README.md](../apiv2/README.md).

**site/** — S3 path probes (`inroot.html`, `folder/`); auth debug (`test-auth.html`, `simple/`); unused Phaser+Box2D prototype (`html5/`). Live tree: [site/README.md](../site/README.md).
