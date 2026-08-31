# VKP Consulting - Terraform Infrastructure

This directory manages the production AWS stack for `vkp-consulting.fr`. Resources are already imported; daily work is `plan` then `apply`.

## Directory Structure

```
terraform/
├── backend.tf                     # S3 backend configuration
├── versions.tf                    # Provider versions
├── variables.tf                   # Input variables
├── outputs.tf                     # Output values
├── main.tf                        # Main orchestration
├── terraform.tfvars.example       # Example variable values (copy to terraform.tfvars)
│
├── modules/
│   ├── s3-bucket/
│   ├── lambda-function/
│   ├── apigateway-http/           # HTTP API + Cognito JWT authorizer
│   ├── cognito/                   # User Pool, groups, Hosted UI, Lambda triggers
│   ├── cloudfront/
│   └── route53/
│
└── scripts/
    ├── setup-backend.sh           # One-time S3 + DynamoDB state backend
    ├── plan.sh
    └── apply.sh
```

One-time import scripts from the 2025 migration are archived under [`../obsolete/terraform/scripts/`](../obsolete/terraform/scripts/).

## Prerequisites

- Terraform >= 1.5.0 (project has used 1.13.x)
- AWS CLI with credentials for account `088455116440`
- `terraform.tfvars` present (gitignored; copy from `terraform.tfvars.example`)

```bash
terraform version
aws sts get-caller-identity
```

## Daily workflow

```bash
cd terraform
terraform init          # first clone or after provider/module changes
terraform plan
terraform apply
terraform output
```

Or use the helpers:

```bash
./scripts/plan.sh
./scripts/apply.sh
```

Backend (already created):

- S3: `vkp-terraform-state-088455116440`
- DynamoDB: `vkp-terraform-locks`

Re-run `./scripts/setup-backend.sh` only if the backend was destroyed.

## Common operations

### Deploy API v2 Lambda

```bash
cd ../apiv2
npm ci && npm test && npm run build && npm run zip
cd ../terraform
terraform apply -target=module.lambda_api2.aws_lambda_function.main
```

Root helper: [`../deployUpdate.sh`](../deployUpdate.sh).

### Cognito users

```bash
../scripts/list-cognito-users.sh
../scripts/create-test-user.sh admin test-admin@vkp-test.local "Test Admin" TestAdmin123!
../scripts/reset-user-password.sh user@example.com "NewPass123!"
../scripts/delete-test-users.sh
```

See [`../scripts/README.md`](../scripts/README.md).

### Update Cognito Lambda triggers

```bash
cd ../lambda/cognito-triggers
npm ci && npm run build && npm run zip
cd ../../terraform
terraform apply \
  -target='module.cognito[0].aws_lambda_function.pre_signup' \
  -target='module.cognito[0].aws_lambda_function.post_confirmation' \
  -target='module.cognito[0].aws_lambda_function.pre_token_generation'
```

If signup or roles stop working, re-attach triggers (circular dependency with the User Pool):

```bash
aws cognito-idp update-user-pool \
  --user-pool-id eu-north-1_OxGtXG08i \
  --lambda-config \
    PreSignUp=arn:aws:lambda:eu-north-1:088455116440:function:vkp-cognito-pre-signup \
    PostConfirmation=arn:aws:lambda:eu-north-1:088455116440:function:vkp-cognito-post-confirmation \
    PreTokenGeneration=arn:aws:lambda:eu-north-1:088455116440:function:vkp-cognito-pre-token-generation

aws cognito-idp describe-user-pool \
  --user-pool-id eu-north-1_OxGtXG08i \
  --query 'UserPool.LambdaConfig'
```

### State inspection

```bash
terraform state list
terraform state show module.lambda_api2.aws_lambda_function.main
terraform output
```

Do not run `terraform destroy` against production unless you intend to take the site down.

## Components

### S3

| Bucket | Purpose |
|--------|---------|
| `vkp-consulting.fr` | Static site (CloudFront OAC only) |
| `data-1-088455116440` | API JSON (`json/*`, HTTPS-only policy) |
| `vkp-cloudfront-logs` | Log bucket (logging currently unused) |

### Lambda

| Function | Runtime | Notes |
|----------|---------|--------|
| `vkp-api2-service` | nodejs20.x, arm64, 128 MB, 3s | Data bucket `json/*` |
| `vkp-simple-service` | nodejs20.x, arm64, 128 MB, 3s | Site bucket `json/*` |
| `vkp-cognito-pre-signup` | nodejs18.x | Validate / auto-confirm guests |
| `vkp-cognito-post-confirmation` | nodejs18.x | Assign `user` or `guest` group |
| `vkp-cognito-pre-token-generation` | nodejs18.x | JWT claims: role, display_name, email |

### API Gateway (`vkp-http-api-4`, ID `wmrksdxxml`)

- `ANY /api` and `ANY /api/{proxy+}` → simple Lambda (no JWT)
- `ANY /apiv2/public` and `ANY /apiv2/public/{proxy+}` → API v2, no JWT (guest create / login)
- `ANY /apiv2` and `ANY /apiv2/{proxy+}` → API v2, JWT authorizer when `enable_cognito_auth` is true
- CORS from `var.cors_allowed_origins` (example: `vkp-consulting.fr` and `www`), methods GET/POST/PATCH/PUT/DELETE/OPTIONS, MaxAge 0
- Lambda still enforces roles (`authMiddleware`, `requireRole`) after the gateway has validated the token

### CloudFront (`EJWBLACWDMFAZ`)

- Aliases: `vkp-consulting.fr`, `www.vkp-consulting.fr`
- Origins: S3 (OAC) and API Gateway
- `/api/*` and `/apiv2/*` uncached; default and `/api/errors/*` cached
- Viewer-request CloudFront Function `vkp-rewrite-index` on the default (S3) behavior: `/aval/` → `/aval/index.html` (and the same for other folders). Not attached to `/api/*` or `/apiv2/*`.
- Custom errors: 400, 403, 404, 500 → `/api/errors/{code}.html` on the S3 origin

### Route53

Zone `Z094077718N53LUC7MTBL`: apex and `www` A/AAAA aliases to CloudFront.

### Cognito

- User Pool: `eu-north-1_OxGtXG08i` (`vkp-user-pool`)
- Client: `77e2cmbthjul60ui7guh514u50` (public, no secret; password, SRP, refresh)
- Domain: `vkp-auth.auth.eu-north-1.amazoncognito.com`
- Groups: `admin`, `user`, `guest`
- Identity Pool: `vkp_identity_pool` (authenticated / unauthenticated roles; group → IAM role mapping)
- OAuth callbacks: `https://vkp-consulting.fr/callback.html`, `https://vkp-consulting.fr/`
- Logout URLs: `https://vkp-consulting.fr/`, `https://vkp-consulting.fr/logout.html`
- API v2 Lambda also has inline policy `CognitoUserManagement` (AdminCreateUser, groups, InitiateAuth) when `enable_cognito_auth` is true

Trigger behavior:

1. **Pre-signup** — validate display name; auto-confirm guests; email verify for others
2. **Post-confirmation** — `guest` or `user` group (admins are assigned manually)
3. **Pre-token-generation** — `custom:role` from group (admin > user > guest)

## Variables

Copy and edit locally (never commit `terraform.tfvars`):

```bash
cp terraform.tfvars.example terraform.tfvars
```

Cognito is gated by `enable_cognito_auth` (default `false` in `variables.tf`; `terraform.tfvars.example` sets `true`). Resource IDs: [INFRASTRUCTURE_DATA.md](INFRASTRUCTURE_DATA.md).

`obsolete/lambda/edge/` (CloudFront viewer-request) is not attached in Terraform.

## Security

- State in S3 (encrypted, versioned) with DynamoDB lock
- Keep `terraform.tfvars` and `*.tfstate` out of git
- Least-privilege IAM on Lambda roles

## Troubleshooting

**Unexpected plan drift**

```bash
terraform refresh
terraform plan
```

**State lock**

```bash
aws dynamodb scan --table-name vkp-terraform-locks
terraform force-unlock <LOCK_ID>   # only after confirming no other apply
```

**Lambda zip missing**

```bash
ls -lh ../apiv2/lambda.zip
aws lambda update-function-code \
  --function-name vkp-api2-service \
  --zip-file fileb://../apiv2/lambda.zip \
  --region eu-north-1
```

**Cognito triggers empty** — re-attach as in “Update Cognito Lambda triggers” above.

## Related docs

- [QUICK_START.md](QUICK_START.md)
- [INFRASTRUCTURE_DATA.md](INFRASTRUCTURE_DATA.md)
- [../INFRASTRUCTURE_OVERVIEW.md](../INFRASTRUCTURE_OVERVIEW.md)
- [../DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)

---

**Last updated**: August 2026  
**Terraform**: >= 1.5.0  
**AWS provider**: ~> 5.0
