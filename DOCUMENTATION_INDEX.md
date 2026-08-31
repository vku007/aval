# Documentation Index

Living documentation for the VKP Consulting infrastructure and APIs.

## Project

- [README.md](README.md) — overview, endpoints, deploy, operations
- [INFRASTRUCTURE_OVERVIEW.md](INFRASTRUCTURE_OVERVIEW.md) — architecture, resources, request flows
- [AUTH.md](AUTH.md) — authentication and authorization (Cognito, JWT, roles)

## Infrastructure (Terraform)

- [terraform/README.md](terraform/README.md) — setup and day-to-day Terraform
- [terraform/QUICK_START.md](terraform/QUICK_START.md) — plan / apply / Lambda deploy
- [terraform/INFRASTRUCTURE_DATA.md](terraform/INFRASTRUCTURE_DATA.md) — current AWS resource IDs

## API v1 and Cognito triggers

- [lambda/README.md](lambda/README.md) — simple Lambda + trigger build/deploy

## API v2

- [apiv2/README.md](apiv2/README.md) — package layout, test, deploy
- [apiv2/API_DOCUMENTATION.md](apiv2/API_DOCUMENTATION.md) — endpoint reference (public / external / internal)
- [apiv2/TESTING_GUIDE.md](apiv2/TESTING_GUIDE.md) — Vitest and live Cognito checks
- [apiv2/plans/](apiv2/plans/) — design notes, not ops docs

## Operations

- [scripts/README.md](scripts/README.md) — Cognito user and test helpers
- [scripts/INTEGRATION_TEST_QUICKSTART.md](scripts/INTEGRATION_TEST_QUICKSTART.md) — auth/authorization test walkthrough
- [site/README.md](site/README.md) — static site map, auth pages, deploy

## Historical notes

Completed migration and feature snapshots live in [obsolete/](obsolete/). Do not treat them as current docs.

---

**Last updated**: August 2026
