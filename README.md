# VKP Consulting Infrastructure

A complete AWS-based web application infrastructure featuring static website hosting, REST APIs, Lambda functions, and CloudFront CDN - all managed with Terraform.

## 🏗️ Infrastructure Overview

This project provides a production-ready AWS infrastructure with:

- **Static Website Hosting**: S3 + CloudFront for `vkp-consulting.fr`
- **REST APIs**: Two Lambda-based microservices for file and game management
- **Authentication**: Amazon Cognito (User Pool `vkp-auth`, API Gateway JWT + Lambda roles)
- **CDN & HTTPS**: CloudFront distribution with custom domain and SSL
- **DNS Management**: Route53 for domain routing
- **Infrastructure as Code**: Complete Terraform setup for reproducible deployments

### Live Endpoints

- **Website (Company Homepage)**: https://vkp-consulting.fr
- **Website (VKP API Management Portal)**: https://vkp-consulting.fr/aval
- **CloudFront**: https://d1kcdf4orzsjcw.cloudfront.net
- **API Gateway**: https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com
- **Cognito Hosted UI**: https://vkp-auth.auth.eu-north-1.amazoncognito.com

## 📁 Project Structure

```
vkp/aval/
├── terraform/              # Infrastructure as Code (Terraform)
│   ├── modules/           # Reusable Terraform modules
│   │   ├── s3-bucket/
│   │   ├── lambda-function/
│   │   ├── apigateway-http/
│   │   ├── cognito/       # User Pool, groups, JWT, Lambda triggers
│   │   ├── cloudfront/
│   │   └── route53/
│   ├── scripts/          # plan.sh, apply.sh, setup-backend.sh
│   ├── main.tf
│   └── README.md
│
├── apiv2/                 # REST API v2 (Advanced)
│   ├── src/              # Domain / application / infrastructure / presentation
│   ├── buildAndDeploy.sh
│   └── README.md
│
├── lambda/                # REST API v1 (simple) + Cognito triggers
│   ├── src/               # vkp-simple-service handler
│   ├── cognito-triggers/  # User Pool Lambda triggers
│   └── README.md
│
├── scripts/               # Cognito user helpers and integration tests
├── site/                  # Static website (see site/README.md)
└── obsolete/              # Historical docs (not current)
```

## 🚀 Quick Start

### Prerequisites

- **Terraform** 1.13+ ([Install](https://www.terraform.io/downloads))
- **AWS CLI** configured with appropriate credentials
- **Node.js** 20.x or later (for Lambda development)
- **AWS Account** with appropriate permissions

### 1. Infrastructure Setup (Terraform)

```bash
# Navigate to Terraform directory
cd terraform

# Initialize Terraform (first time only)
terraform init

# Review infrastructure changes
terraform plan

# Apply infrastructure
terraform apply

# Get infrastructure outputs
terraform output
```

For detailed Terraform documentation, see [`terraform/README.md`](terraform/README.md).

### 2. Deploy Lambda Functions

#### API v2 (Advanced - File, User, Game Management)

```bash
cd apiv2

# Install dependencies
npm install

# Run tests
npm test

# Build and deploy
./buildAndDeploy.sh
```

#### API v1 (Simple)

```bash
cd lambda
npm ci && npm test && npm run build && npm run zip
cd ../terraform
terraform apply -target=module.lambda_simple.aws_lambda_function.main
```

See [`lambda/README.md`](lambda/README.md).

### 3. Deploy Static Website

```bash
# Sync site content to S3
aws s3 sync site/ s3://vkp-consulting.fr/

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id EJWBLACWDMFAZ \
  --paths "/*"
```

## 🌐 Architecture

### Infrastructure Components

```
┌─────────────────────────────────────────────────────┐
│                    Route53 DNS                       │
│           vkp-consulting.fr → CloudFront            │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│                CloudFront CDN                        │
│  Origin 1: S3 Static Site  |  Origin 2: API Gateway │
└──────────┬───────────────────────┬──────────────────┘
           │                       │
┌──────────▼──────────┐   ┌───────▼─────────────────┐
│   S3 Static Site    │   │   API Gateway HTTP API   │
│ vkp-consulting.fr   │   │     wmrksdxxml          │
│                     │   │  JWT on /apiv2 (not /public) │
│ - HTML/CSS/JS       │   │  /api/*  → λ simple     │
│ - Error pages       │   │  /apiv2/* → λ api2      │
└─────────────────────┘   └──────┬──────────┬────────┘
                                 │          │
                     ┌───────────▼──┐   ┌──▼──────────────┐
                     │ Lambda Simple│   │  Lambda API v2  │
                     │              │   │  + auth middleware│
                     └──────┬───────┘   └────┬────────────┘
                            │                │
                            └────────┬───────┘
                                     │
                          ┌──────────▼──────────────┐
                          │   S3 Data Bucket        │
                          │   data-1-088455116440   │
                          └─────────────────────────┘

Cognito User Pool (vkp-auth / eu-north-1_OxGtXG08i)
  groups: admin, user, guest
  triggers: pre-signup, post-confirmation, pre-token-generation
```

### Request Flow

1. **Static Content**: `vkp-consulting.fr` → CloudFront → S3 Static Bucket
2. **Login**: Hosted UI → Cognito → `callback.html` with JWT
3. **API Requests**: `vkp-consulting.fr/apiv2/*` → CloudFront → API Gateway (JWT except `/public`) → Lambda (roles) → S3 Data
4. **Direct API**: API Gateway URL → Lambda → S3 Data

## 🔧 Infrastructure Management

### Terraform Commands

```bash
cd terraform

# View current infrastructure state
terraform state list

# Show specific resource details
terraform state show module.cloudfront.aws_cloudfront_distribution.main

# Plan changes before applying
terraform plan

# Apply changes
terraform apply

# Destroy specific resource
terraform destroy -target=module.s3_static_site.aws_s3_bucket_policy.main

# Format Terraform files
terraform fmt -recursive

# Validate configuration
terraform validate
```

### Common Operations

#### Update Lambda Code

```bash
# Update API v2
cd apiv2
npm run build
./buildAndDeploy.sh

# Or use Terraform (preferred)
cd ../terraform
terraform apply -target=module.lambda_api2.aws_lambda_function.main
```

#### Cognito users

```bash
./scripts/list-cognito-users.sh
./scripts/create-test-user.sh admin test-admin@vkp-test.local "Test Admin" TestAdmin123!
```

See [scripts/README.md](scripts/README.md) and [scripts/INTEGRATION_TEST_QUICKSTART.md](scripts/INTEGRATION_TEST_QUICKSTART.md).

#### Update Static Website

```bash
# Sync new content
aws s3 sync site/ s3://vkp-consulting.fr/ --delete

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id $(terraform output -raw cloudfront_distribution_id) \
  --paths "/*"
```

#### View Logs

```bash
# API v2 logs
aws logs tail /aws/lambda/vkp-api2-service --follow

# API v1 logs
aws logs tail /aws/lambda/vkp-simple-service --follow

# API Gateway logs
aws logs tail /aws/apigateway/vkp-http-api --follow
```

## 📚 API Documentation

### API v2 (Advanced) - `/apiv2/*`

Complete REST API with file, user, and game management.

**Base URL**: `https://vkp-consulting.fr/apiv2` or `https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2`

JWT on `/apiv2` except `/apiv2/public/*`. Admin CRUD is under `/apiv2/internal/*`.

| Prefix | Who | Purpose |
|--------|-----|---------|
| `/apiv2/public` | open | create-guest, login |
| `/apiv2/external` | any JWT | me, promote, player games |
| `/apiv2/internal` | admin JWT | files / users / games CRUD |

**Full documentation**: [`apiv2/README.md`](apiv2/README.md), [`apiv2/API_DOCUMENTATION.md`](apiv2/API_DOCUMENTATION.md), [`AUTH.md`](AUTH.md).

### API v1 (Simple) - `/api/*`

Hello/echo demo on `vkp-simple-service`. No Cognito, no S3 CRUD.

**Base URL**: `https://vkp-consulting.fr/api` or `https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/api`

- `GET /api` (or `/api/*`) — `{ ok, message, time }`
- `POST /api` — echoes JSON body
- `OPTIONS` — CORS preflight

See [`lambda/README.md`](lambda/README.md).

## 🧪 Testing

### Unit & Integration Tests

```bash
cd apiv2
npm test

# Live Cognito checks (from repo root)
./scripts/test-guest-user.sh
./scripts/test-entity-endpoints.sh "$ID_TOKEN" admin
```

See [`apiv2/TESTING_GUIDE.md`](apiv2/TESTING_GUIDE.md) and [`scripts/README.md`](scripts/README.md).

### Load Testing

```bash
# Using Apache Bench
ab -n 1000 -c 10 https://vkp-consulting.fr/apiv2/public/login

# Using curl in loop
for i in {1..100}; do
  curl -w "%{time_total}\n" -o /dev/null -s \
    https://vkp-consulting.fr/apiv2/public/login
done
```

## 🔒 Security

### Current Setup

- ✅ **HTTPS Only**: CloudFront enforces HTTPS
- ✅ **Cognito JWT**: API Gateway authorizer on `/apiv2` (not `/apiv2/public`); Lambda `requireRole` for `admin` / `user` / `guest`
- ✅ **CORS**: Configured for `vkp-consulting.fr`
- ✅ **S3 Access**: Bucket policies restrict access
- ✅ **IAM Roles**: Least privilege for Lambda functions
- ✅ **Input Validation**: Zod schemas in API v2
- ✅ **Concurrency Control**: ETag-based optimistic locking

### Best Practices

```bash
# Rotate CloudFront signing keys (if using signed URLs)
aws cloudfront update-distribution --id EJWBLACWDMFAZ

# Review IAM policies
terraform state show module.lambda_api2.aws_iam_role_policy.s3_access

# Enable S3 versioning (if needed)
aws s3api put-bucket-versioning \
  --bucket data-1-088455116440 \
  --versioning-configuration Status=Enabled
```

## 📊 Monitoring & Observability

### CloudWatch Dashboards

```bash
# View Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=vkp-api2-service \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### Key Metrics

- **Lambda Duration**: p50, p95, p99 latencies
- **API Gateway Requests**: Count, 4xx, 5xx rates
- **CloudFront**: Cache hit ratio, error rates
- **S3**: Request count, data transfer

### Alarms (Optional)

```bash
# Create CloudWatch alarm for Lambda errors
aws cloudwatch put-metric-alarm \
  --alarm-name vkp-api2-errors \
  --alarm-description "API v2 Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 60 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

## 💰 Cost Management

### Current Infrastructure

Estimated monthly costs (assuming moderate usage):

- **Lambda**: ~$5-20/month (1M requests)
- **API Gateway**: ~$3-10/month (1M requests)
- **CloudFront**: ~$5-50/month (depends on traffic)
- **S3**: ~$1-5/month (depends on storage)
- **Route53**: ~$0.50/month (hosted zone)
- **Cognito**: ~$0-5/month (MAU; free tier covers typical usage)
- **Total**: ~$15-90/month

### Cost Optimization

```bash
# View current costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost

# Enable S3 Intelligent-Tiering (optional)
aws s3api put-bucket-intelligent-tiering-configuration \
  --bucket data-1-088455116440 \
  --id intelligent-tiering \
  --intelligent-tiering-configuration file://tiering.json
```

## 🔄 Disaster Recovery

### Backup Strategy

```bash
# Enable S3 versioning
aws s3api put-bucket-versioning \
  --bucket data-1-088455116440 \
  --versioning-configuration Status=Enabled

# Create snapshot of current state
terraform state pull > terraform-state-backup-$(date +%Y%m%d).json

# Backup Lambda code
aws lambda get-function --function-name vkp-api2-service \
  --query 'Code.Location' | xargs curl -o lambda-backup.zip
```

### Restore Procedure

1. **Infrastructure**: `terraform apply` to recreate
2. **Data**: Restore from S3 versioning or backups
3. **Code**: Redeploy Lambda functions
4. **DNS**: Update Route53 if needed

## 🚢 CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy Infrastructure

on:
  push:
    branches: [main]

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: hashicorp/setup-terraform@v2
      
      - name: Terraform Init
        run: cd terraform && terraform init
      
      - name: Terraform Plan
        run: cd terraform && terraform plan
      
      - name: Terraform Apply
        if: github.ref == 'refs/heads/main'
        run: cd terraform && terraform apply -auto-approve

  deploy-api:
    runs-on: ubuntu-latest
    needs: terraform
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Build and Deploy API v2
        run: cd apiv2 && npm install && ./buildAndDeploy.sh
```

## 📖 Additional Documentation

See [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) for the full map.

- **Auth**: [`AUTH.md`](AUTH.md) — Cognito, API Gateway JWT, Lambda roles
- **Terraform**: [`terraform/README.md`](terraform/README.md), [`terraform/QUICK_START.md`](terraform/QUICK_START.md)
- **API v2**: [`apiv2/README.md`](apiv2/README.md), [`apiv2/API_DOCUMENTATION.md`](apiv2/API_DOCUMENTATION.md)
- **Site**: [`site/README.md`](site/README.md)
- **Testing**: [`apiv2/TESTING_GUIDE.md`](apiv2/TESTING_GUIDE.md), [`scripts/INTEGRATION_TEST_QUICKSTART.md`](scripts/INTEGRATION_TEST_QUICKSTART.md)
- **Resource IDs**: [`terraform/INFRASTRUCTURE_DATA.md`](terraform/INFRASTRUCTURE_DATA.md)

## 🤝 Contributing

### Development Workflow

1. Create feature branch from `main`
2. Make changes to infrastructure or code
3. Test locally (Terraform plan, npm test)
4. Create pull request with detailed description
5. Review and merge after approval

### Code Standards

- **Terraform**: Follow [HashiCorp style guide](https://www.terraform.io/docs/language/syntax/style.html)
- **TypeScript**: Use ESLint and Prettier configurations
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/)

## 🆘 Troubleshooting

### Common Issues

**Issue**: Terraform state lock error
```bash
# Solution: Force unlock
terraform force-unlock <LOCK_ID>
```

**Issue**: CloudFront serving stale content
```bash
# Solution: Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id EJWBLACWDMFAZ \
  --paths "/*"
```

**Issue**: Lambda timeout errors
```bash
# Solution: Increase timeout in Terraform
# Edit terraform/main.tf (module.lambda_api2 timeout, currently 3 seconds)
```

**Issue**: CORS errors
```bash
# Solution: Verify CORS configuration
terraform state show module.api_gateway.aws_apigatewayv2_api.main
```

### Getting Help

- **Documentation**: Check relevant README files
- **Logs**: Review CloudWatch logs for errors
- **State**: Use `terraform state show` to inspect resources
- **AWS Console**: Verify resources match Terraform state

## 📄 License

MIT License - See LICENSE file for details.

## 👥 Authors

- **VKP Consulting Team**

## 🔗 Links

- **Website**: https://vkp-consulting.fr
- **API Documentation**: [API Docs](apiv2/API_DOCUMENTATION.md)
- **Auth**: [AUTH.md](AUTH.md)
- **Terraform Guide**: [Infrastructure Guide](terraform/README.md)

---

**Last Updated**: August 2026  
**Terraform Version**: 1.13.4  
**AWS Region**: eu-north-1  
**Node Version**: 20.x

