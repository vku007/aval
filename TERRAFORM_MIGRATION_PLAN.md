# Terraform Migration Plan - VKP AWS Infrastructure
## Based on Actual AWS Account Analysis

**Date**: October 24, 2025  
**AWS Account**: 088455116440  
**Primary Region**: eu-north-1

---

## 🔍 Current Infrastructure Discovery

### S3 Buckets (3)
1. **vkp-consulting.fr** - Static website hosting
   - Region: eu-north-1
   - Purpose: Static site content
   - Policy: CloudFront OAC access only

2. **data-1-088455116440** - API data storage
   - Region: eu-north-1
   - Purpose: JSON data storage for API
   - Policy: Lambda role access to json/* prefix
   - Enforce HTTPS only

3. **vkp-cloudfront-logs** - CloudFront access logs
   - Region: Not analyzed (logging disabled currently)

### Lambda Functions (2)
1. **vkp-api2-service** (Primary API)
   - Runtime: nodejs20.x
   - Architecture: arm64
   - Memory: 128 MB
   - Timeout: 3 seconds
   - Handler: index.handler
   - Role: vkp-api2-service-role
   - Environment Variables:
     - APP_TAG=vkp-api
     - MAX_BODY_BYTES=1048576
     - JSON_PREFIX=json/
     - ENVIRONMENT=prod
     - BUCKET_NAME=data-1-088455116440
     - CORS_ORIGIN=https://vkp-consulting.fr

2. **vkp-simple-service** (Legacy/Alternative API)
   - Runtime: nodejs20.x
   - Architecture: arm64
   - Memory: 128 MB
   - Timeout: 3 seconds
   - Handler: index.handler
   - Role: vkp-simple-service-role
   - Environment Variables:
     - MAX_BODY_BYTES=1048576
     - JSON_PREFIX=json/
     - BUCKET_NAME=vkp-consulting.fr
     - CORS_ORIGIN=https://vkp-consulting.fr

### IAM Roles
1. **vkp-api2-service-role**
   - Trust: Lambda service
   - Attached Policies: AWSLambdaBasicExecutionRole
   - Inline Policies: S3JsonAccess-data-1-088455116440
     - S3 ListBucket on data-1-088455116440 (json/* prefix)
     - S3 GetObject, PutObject, DeleteObject, HeadObject on json/* objects

### API Gateway HTTP API
- **Name**: vkp-http-api-4
- **API ID**: wmrksdxxml
- **Endpoint**: https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com
- **Protocol**: HTTP
- **CORS Configuration**:
  - AllowOrigins: "https://vkp-consulting.fr, https://www.vkp-consulting.fr"
  - AllowMethods: GET, POST, PATCH, PUT, DELETE, OPTIONS
  - MaxAge: 0

- **Routes**:
  1. ANY /api → vkp-simple-service (integration 7i5dlto)
  2. ANY /api/{proxy+} → vkp-simple-service (integration n4u3wc0)
  3. ANY /apiv2 → vkp-api2-service (integration 8ta0jlt)
  4. ANY /apiv2/{proxy+} → vkp-api2-service (integration 8ta0jlt)

### CloudFront Distribution
- **Distribution ID**: EJWBLACWDMFAZ
- **Domain**: d1kcdf4orzsjcw.cloudfront.net
- **Aliases**: vkp-consulting.fr, www.vkp-consulting.fr
- **Status**: Deployed
- **Certificate**: arn:aws:acm:us-east-1:088455116440:certificate/e3774345-7028-415a-ab57-bd1f8e02a021
- **Price Class**: PriceClass_100 (US, Canada, Europe)
- **HTTP Version**: http2
- **IPv6**: Enabled

**Origins**:
1. **s3-origin-vkp**: vkp-consulting.fr.s3.eu-north-1.amazonaws.com
   - OAC ID: E3QY4UMB9YVA18 (OAC-vkp)
   
2. **API Gateway**: wmrksdxxml.execute-api.eu-north-1.amazonaws.com
   - Protocol: HTTPS only (TLSv1.2)

**Cache Behaviors**:
1. **Default** (/) → S3 Origin
   - Methods: GET, HEAD
   - Cache Policy: 658327ea-f89d-4fab-a63d-7e88639e58f6 (CachingOptimized)
   - Compress: Yes

2. **/api/errors/*** → S3 Origin
   - Methods: GET, HEAD
   - Cache Policy: CachingOptimized

3. **/api/*** → API Gateway Origin
   - Methods: ALL (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD)
   - Cache Policy: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad (CachingDisabled)
   - Origin Request Policy: b689b0a8-53d0-40ab-baf2-68738e2966ac (AllViewer)

4. **/apiv2/*** → API Gateway Origin
   - Methods: ALL
   - Cache Policy: CachingDisabled
   - Origin Request Policy: AllViewer

**Custom Error Responses**:
- 400 → /api/errors/400.html (300s TTL)
- 403 → /api/errors/403.html (300s TTL)
- 404 → /api/errors/404.html (300s TTL)
- 500 → /api/errors/500.html (60s TTL)

### Route53
- **Hosted Zone**: Z094077718N53LUC7MTBL
- **Domain**: vkp-consulting.fr

**DNS Records**:
1. **vkp-consulting.fr** (A) → d1kcdf4orzsjcw.cloudfront.net (Alias)
2. **vkp-consulting.fr** (AAAA) → d1kcdf4orzsjcw.cloudfront.net (Alias)
3. **www.vkp-consulting.fr** (A) → d1kcdf4orzsjcw.cloudfront.net (Alias)
4. **www.vkp-consulting.fr** (AAAA) → d1kcdf4orzsjcw.cloudfront.net (Alias)
5. ACM validation CNAME records

### CloudFront Origin Access Control
- **OAC ID**: E3QY4UMB9YVA18
- **Name**: OAC-vkp
- **Signing Protocol**: sigv4
- **Signing Behavior**: always
- **Origin Type**: s3

---

## 📋 Terraform Migration Strategy

### Phase 1: Setup Terraform Backend (Week 1, Day 1)

```bash
# Create S3 bucket for Terraform state
aws s3api create-bucket \
  --bucket vkp-terraform-state-088455116440 \
  --region eu-north-1 \
  --create-bucket-configuration LocationConstraint=eu-north-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket vkp-terraform-state-088455116440 \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket vkp-terraform-state-088455116440 \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name vkp-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-north-1
```

### Phase 2: Create Terraform Project Structure (Week 1, Day 1-2)

```
terraform/
├── backend.tf                     # S3 backend configuration
├── versions.tf                    # Provider versions
├── variables.tf                   # Input variables
├── outputs.tf                     # Outputs
├── main.tf                        # Main orchestration
├── terraform.tfvars.example       # Example variables
├── .gitignore                     # Ignore sensitive files
│
├── modules/
│   ├── s3-bucket/                 # Reusable S3 bucket module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── lambda-function/           # Lambda function module
│   │   ├── main.tf
│   │   ├── iam.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── apigateway-http/           # API Gateway HTTP API module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── cloudfront/                # CloudFront distribution
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   └── route53/                   # Route53 DNS records
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
└── scripts/
    ├── import-resources.sh        # Import existing resources
    ├── plan.sh                    # Terraform plan wrapper
    └── apply.sh                   # Terraform apply wrapper
```

### Phase 3: Import Existing Resources (Week 1, Day 2-3)

**Resource Import Commands**:
```bash
# S3 Buckets
terraform import module.s3_static_site.aws_s3_bucket.main vkp-consulting.fr
terraform import module.s3_api_data.aws_s3_bucket.main data-1-088455116440
terraform import module.s3_cloudfront_logs.aws_s3_bucket.main vkp-cloudfront-logs

# Lambda Functions
terraform import module.lambda_api2.aws_lambda_function.main vkp-api2-service
terraform import module.lambda_simple.aws_lambda_function.main vkp-simple-service

# IAM Roles
terraform import module.lambda_api2.aws_iam_role.main vkp-api2-service-role
terraform import module.lambda_simple.aws_iam_role.main vkp-simple-service-role

# API Gateway
terraform import module.api_gateway.aws_apigatewayv2_api.main wmrksdxxml
terraform import module.api_gateway.aws_apigatewayv2_integration.api2 8ta0jlt
terraform import module.api_gateway.aws_apigatewayv2_integration.simple 7i5dlto
terraform import module.api_gateway.aws_apigatewayv2_route.apiv2_proxy lryw566
terraform import module.api_gateway.aws_apigatewayv2_route.api_proxy mknw9sn

# CloudFront
terraform import module.cloudfront.aws_cloudfront_distribution.main EJWBLACWDMFAZ
terraform import module.cloudfront.aws_cloudfront_origin_access_control.main E3QY4UMB9YVA18

# Route53
terraform import module.route53.aws_route53_zone.main Z094077718N53LUC7MTBL
terraform import 'module.route53.aws_route53_record.root_a' Z094077718N53LUC7MTBL_vkp-consulting.fr._A
terraform import 'module.route53.aws_route53_record.www_a' Z094077718N53LUC7MTBL_www.vkp-consulting.fr._A
```

### Phase 4: Deployment Workflow (Week 2)

**Update Build Script** (`apiv2/buildAndDeploy.sh`):
```bash
#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

echo "🔨 Building Lambda function..."
npm ci
npm run build
npm run zip

echo "🚀 Deploying with Terraform..."
cd ../terraform

terraform init
terraform plan -out=tfplan
terraform apply tfplan

echo "✅ Deployment complete!"
```

### Phase 5: CI/CD Integration (Week 2-3)

See `.github/workflows/terraform-deploy.yml` in the terraform directory.

---

## 🎯 Success Criteria

- [ ] All existing resources imported into Terraform state
- [ ] `terraform plan` shows no changes for current infrastructure
- [ ] Successful deployment of Lambda code updates via Terraform
- [ ] Documentation updated with Terraform workflow
- [ ] Legacy shell scripts moved to `legacy/` folder
- [ ] Team trained on Terraform workflow

---

## ⚠️ Migration Risks & Mitigation

### Risk 1: State Drift
**Mitigation**: Import all resources before making any changes

### Risk 2: Resource Recreation
**Mitigation**: Careful review of `terraform plan` output before apply

### Risk 3: Downtime During Migration
**Mitigation**: Import-only operations don't affect running resources

### Risk 4: Lost Manual Changes
**Mitigation**: Document all manual changes before migration

---

## 📚 Next Steps

1. Review this plan ✓ (COMPLETED - Real infrastructure analyzed)
2. Create Terraform backend (Run Phase 1 commands)
3. Create Terraform modules (See terraform/ directory)
4. Import existing resources (Run import scripts)
5. Validate with `terraform plan` (should show 0 changes)
6. Test with small change (e.g., add a tag)
7. Update deployment workflows
8. Document new processes
9. Train team
10. Decommission shell scripts

---

## 📖 Resources

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Terraform Import](https://www.terraform.io/docs/cli/import/index.html)
- [AWS Lambda with Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function)
- [API Gateway V2 with Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/apigatewayv2_api)

