# VKP Consulting - Infrastructure Overview

## 📊 Complete Infrastructure Summary

This document provides a comprehensive overview of the VKP Consulting AWS infrastructure, now fully managed by Terraform.

---

## 🏗️ Architecture at a Glance

```
Internet Users
      ↓
Route53 DNS (vkp-consulting.fr)
      ↓
CloudFront CDN (d1kcdf4orzsjcw.cloudfront.net)
      ↓
   ┌──────────────────────┬──────────────────────┐
   ↓                      ↓                      ↓
S3 Static Site      API Gateway           CloudWatch Logs
(vkp-consulting.fr)  (wmrksdxxml)         (Monitoring)
                           ↓
                    JWT authorizer
                    (/apiv2/public/* open)
                           ↓
                    ┌──────┴──────┐
                    ↓             ↓
            Lambda Simple    Lambda API v2
            (vkp-simple)     (vkp-api2)
                    ↓             ↓
                    └──────┬──────┘
                           ↓
                    S3 Data Bucket
                  (data-1-088455116440)

Cognito User Pool (vkp-auth)
  groups: admin, user, guest
  triggers: pre-signup, post-confirmation, pre-token-generation
```

---

## 🌐 Live Endpoints

| Service | URL | Purpose |
|---------|-----|---------|
| **Main Website** | https://vkp-consulting.fr | Public website |
| **API portal** | https://vkp-consulting.fr/aval | VKP API management UI |
| **CloudFront** | https://d1kcdf4orzsjcw.cloudfront.net | CDN distribution |
| **API Gateway** | https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com | Direct API access |
| **API v1** | https://vkp-consulting.fr/api/* | Simple hello/echo Lambda |
| **API v2** | https://vkp-consulting.fr/apiv2/* | File / user / game management |
| **Cognito Hosted UI** | https://vkp-auth.auth.eu-north-1.amazoncognito.com | Login / logout / OAuth |

---

## 📦 AWS Resources

### Compute & Application

| Resource | Name/ID | Purpose | Managed By |
|----------|---------|---------|------------|
| **Lambda Function** | `vkp-api2-service` | Advanced REST API | Terraform |
| **Lambda Function** | `vkp-simple-service` | Simple REST API | Terraform |
| **Lambda Function** | `vkp-cognito-pre-signup` | Cognito pre-signup trigger | Terraform |
| **Lambda Function** | `vkp-cognito-post-confirmation` | Group assignment | Terraform |
| **Lambda Function** | `vkp-cognito-pre-token-generation` | JWT custom claims | Terraform |
| **API Gateway HTTP API** | `wmrksdxxml` | API routing | Terraform |
| **API Gateway Stage** | `$default` | Default stage | Terraform |
| **API Gateway JWT Authorizer** | `cognito-jwt-authorizer` | Cognito JWT on /apiv2 (not /public) | Terraform |

### Storage (9 resources)

| Resource | Name | Size | Purpose | Managed By |
|----------|------|------|---------|------------|
| **S3 Bucket** | `vkp-consulting.fr` | ~100MB | Static website hosting | Terraform |
| **S3 Bucket** | `data-1-088455116440` | ~50MB | API data storage | Terraform |
| **S3 Bucket** | `vkp-cloudfront-logs` | ~10MB | CloudFront access logs | Terraform |
| **S3 Bucket Policy** × 2 | - | - | Access control | Terraform |
| **S3 Public Access Block** × 3 | - | - | Security | Terraform |

### Content Delivery (2 resources)

| Resource | ID | Purpose | Managed By |
|----------|-----|---------|------------|
| **CloudFront Distribution** | `EJWBLACWDMFAZ` | Global CDN | Terraform |
| **CloudFront OAC** | `E3QY4UMB9YVA18` | S3 access control | Terraform |

### DNS (4 resources)

| Resource | Type | Name | Target | Managed By |
|----------|------|------|--------|------------|
| **Route53 Record** | A | vkp-consulting.fr | CloudFront | Terraform |
| **Route53 Record** | AAAA | vkp-consulting.fr | CloudFront | Terraform |
| **Route53 Record** | A | www.vkp-consulting.fr | CloudFront | Terraform |
| **Route53 Record** | AAAA | www.vkp-consulting.fr | CloudFront | Terraform |

### Security & IAM

| Resource | Name | Purpose | Managed By |
|----------|------|---------|------------|
| **IAM Role** | `vkp-api2-service-role` | Lambda execution | Terraform |
| **IAM Role** | `vkp-simple-service-role` | Lambda execution | Terraform |
| **IAM Policy Attachment** × 2 | Basic execution | CloudWatch logs | Terraform |
| **IAM Inline Policy** × 2 | S3 access | Data bucket access | Terraform |
| **Lambda Permission** × 2 | API Gateway invoke | API integration | Terraform |
| **Cognito User Pool** | `eu-north-1_OxGtXG08i` | Authentication | Terraform |
| **Cognito App Client** | `77e2cmbthjul60ui7guh514u50` | Web OAuth client | Terraform |
| **Cognito Domain** | `vkp-auth` | Hosted UI | Terraform |
| **Cognito Groups** | `admin`, `user`, `guest` | Role mapping | Terraform |
| **Cognito Identity Pool** | `vkp_identity_pool` | IAM role assumption | Terraform |
| **IAM Policy** | `CognitoUserManagement` | API v2 guest/user admin APIs | Terraform |

### Monitoring (3 resources)

| Resource | Name | Retention | Purpose | Managed By |
|----------|------|-----------|---------|------------|
| **CloudWatch Log Group** | `/aws/lambda/vkp-api2-service` | 7 days | API v2 logs | Terraform |
| **CloudWatch Log Group** | `/aws/lambda/vkp-simple-service` | 7 days | API v1 logs | Terraform |
| **CloudWatch Log Group** | `/aws/lambda/vkp-cognito-*` | 7 days | Cognito trigger logs | Terraform |
| **CloudWatch Log Group** | `/aws/apigateway/vkp-http-api` | 7 days | API Gateway logs | Terraform |

### State Management (4 resources)

| Resource | Name | Purpose | Managed By |
|----------|------|---------|------------|
| **S3 Bucket** | `vkp-terraform-state-088455116440` | Terraform state | Manual |
| **DynamoDB Table** | `vkp-terraform-locks` | State locking | Manual |
| **S3 Versioning** | Enabled | State history | Manual |
| **S3 Encryption** | AES256 | State security | Manual |

---

## 🔄 Request Flow Scenarios

### 1. Static Website Access

```
User Browser
  ↓ HTTPS GET https://vkp-consulting.fr/
Route53
  ↓ DNS Resolution
CloudFront (EJWBLACWDMFAZ)
  ↓ Cache Miss/Hit
S3 Bucket (vkp-consulting.fr)
  ↓ Origin Access Control
Return: index.html
```

Page map and deploy: [site/README.md](site/README.md). Hub: `/aval/`. Game: `/html5Simple/`. CloudFront 400/403/404/500: `/api/errors/{code}.html`. Directory URLs (`/aval/`) are rewritten to `index.html` by CloudFront Function `vkp-rewrite-index` on the S3 behavior.

**Performance**: 
- Cache Hit: ~50ms
- Cache Miss: ~200ms

### 2. API v2 Request (via CloudFront)

```
User Browser
  ↓ HTTPS POST https://vkp-consulting.fr/apiv2/internal/users
Route53
  ↓ DNS Resolution
CloudFront (EJWBLACWDMFAZ)
  ↓ Forward to API Gateway
API Gateway (wmrksdxxml)
  ↓ Route: ANY /apiv2/{proxy+}
  ↓ Integration: api2_integration
Lambda (vkp-api2-service)
  ↓ Process Request
  ↓ Validate Input (Zod)
  ↓ Business Logic
S3 Bucket (data-1-088455116440)
  ↓ PutObject: json/users/user-123.json
Return: 201 Created
```

**Performance**: 
- Cold Start: ~800ms
- Warm: ~100-300ms

### 3. Direct API Gateway Request

```
API Client
  ↓ HTTPS GET https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/files
API Gateway (wmrksdxxml)
  ↓ Route: ANY /apiv2/{proxy+}
Lambda (vkp-api2-service)
  ↓ Process Request
S3 Bucket (data-1-088455116440)
  ↓ ListObjects: json/ prefix
Return: 200 OK with file list
```

**Performance**: 
- Direct API: ~150-400ms

### 4. Authenticated API Request

```
User Browser
  ↓ Login via Hosted UI (callback.html)
Cognito (vkp-auth)
  ↓ ID token (JWT with custom:role)
API Gateway JWT authorizer (skipped for /apiv2/public/*)
  ↓
Lambda API v2 (authMiddleware + requireRole)
  ↓
S3 Data Bucket
```

Groups: `admin` (full CRUD), `user` / `guest` (limited, e.g. `/apiv2/external/me`). Missing/invalid tokens on protected routes return 401 from API Gateway; role failures return 403 from Lambda.

---

## 🔐 Security Architecture

### Network Security

```
┌─────────────────────────────────────┐
│          Public Internet            │
└────────────┬────────────────────────┘
             │ HTTPS Only (TLS 1.2+)
┌────────────▼────────────────────────┐
│         CloudFront CDN              │
│  - WAF (optional)                   │
│  - DDoS Protection                  │
│  - Origin Access Control            │
└────────────┬────────────────────────┘
             │
    ┌────────┴────────┐
    ↓                 ↓
┌───────┐      ┌──────────────┐
│  S3   │      │ API Gateway  │
│ (OAC) │      │ JWT + CORS   │
└───────┘      └──────┬───────┘
                      │
              ┌───────▼────────┐
              │  Lambda        │
              │  requireRole   │
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │  S3 Data       │
              │  Cognito Pool  │
              └────────────────┘
```

### IAM Permissions Model

**Lambda Execution Roles** (Least Privilege):

```json
{
  "vkp-api2-service-role": {
    "CloudWatchLogs": ["CreateLogGroup", "CreateLogStream", "PutLogEvents"],
    "S3": {
      "Bucket": "data-1-088455116440",
      "Prefix": "json/*",
      "Actions": ["GetObject", "PutObject", "DeleteObject", "ListBucket"]
    }
  },
  "vkp-simple-service-role": {
    "CloudWatchLogs": ["CreateLogGroup", "CreateLogStream", "PutLogEvents"],
    "S3": {
      "Bucket": "vkp-consulting.fr",
      "Prefix": "json/*",
      "Actions": ["GetObject", "PutObject", "DeleteObject", "ListBucket"]
    }
  }
}
```

### CORS Configuration

```json
{
  "AllowedOrigins": ["https://vkp-consulting.fr", "https://www.vkp-consulting.fr"],
  "AllowedMethods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  "AllowedHeaders": ["content-type", "authorization", "if-match", "if-none-match"],
  "MaxAge": 0
}
```

---

## 💰 Cost Breakdown (Estimated)

### Monthly Costs (Moderate Usage: 100K requests/month)

| Service | Usage | Cost | Details |
|---------|-------|------|---------|
| **Lambda** | 100K invocations<br>200ms avg duration | $0.20 | 20M GB-seconds |
| **API Gateway** | 100K requests | $0.10 | HTTP API pricing |
| **CloudFront** | 10GB data transfer<br>100K requests | $1.20 | $0.085/GB + $0.01/10K |
| **S3 Storage** | 1GB storage<br>150K requests | $0.30 | Standard storage |
| **Route53** | 1 hosted zone | $0.50 | Fixed cost |
| **Cognito** | User Pool MAU | $0–5 | Free tier covers typical usage |
| **CloudWatch Logs** | 1GB logs | $0.50 | 7 days retention |
| **Data Transfer** | 5GB out | $0.45 | S3 → Internet |
| **Total** | - | **~$3–8/month** | Low traffic |

### High Traffic Scenario (1M requests/month)

| Service | Monthly Cost |
|---------|--------------|
| Lambda | $2.00 |
| API Gateway | $1.00 |
| CloudFront | $10.00 |
| S3 | $2.00 |
| Route53 | $0.50 |
| CloudWatch | $2.00 |
| Data Transfer | $4.00 |
| **Total** | **~$21.50/month** |

---

## 📊 Performance Metrics

### Lambda Performance

| Metric | API v1 (Simple) | API v2 (Advanced) |
|--------|-----------------|-------------------|
| **Cold Start** | ~400ms | ~800ms |
| **Warm Execution** | ~50-100ms | ~100-300ms |
| **Memory** | 128MB | 128MB |
| **Timeout** | 3s | 3s |
| **Concurrent Executions** | 10 | 10 (reserved) |

### API Gateway

| Metric | Value |
|--------|-------|
| **Request Timeout** | 30s |
| **Payload Limit** | 10MB |
| **Throttle Limit** | 10,000/second (account) |
| **Burst Limit** | 5,000 (account) |

### CloudFront

| Metric | Value |
|--------|-------|
| **Cache Hit Ratio** | ~85% (typical) |
| **TTL** | 86400s (1 day) |
| **Edge Locations** | Global (225+) |
| **HTTPS Support** | TLS 1.2+ |

---

## 🔄 Deployment Workflow

### Infrastructure Changes

```bash
# 1. Modify Terraform files
cd terraform
vim main.tf

# 2. Plan changes
terraform plan -out=tfplan

# 3. Review plan
less tfplan

# 4. Apply changes
terraform apply tfplan

# 5. Verify
terraform state list
```

### Application Code Updates

```bash
# API v2 Update
cd apiv2
npm test                    # Run tests
npm run build              # Build TypeScript
./buildAndDeploy.sh        # Deploy to Lambda

# Verify deployment
aws lambda get-function --function-name vkp-api2-service

# Test live endpoint
curl https://vkp-consulting.fr/apiv2/internal/files
```

### Static Website Updates

```bash
# Update site content
cd site
vim index.html

# Deploy to S3
aws s3 sync . s3://vkp-consulting.fr/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id EJWBLACWDMFAZ \
  --paths "/*"
```

---

## 🧪 Testing Strategy

### 1. Infrastructure Testing

```bash
cd terraform

# Validate syntax
terraform validate

# Check formatting
terraform fmt -check -recursive

# Plan (dry run)
terraform plan -detailed-exitcode

# Test imports
terraform import test_resource test_id
```

### 2. API Testing

```bash
cd apiv2

# Unit tests
npm test

# Live checks (repo root)
../scripts/test-guest-user.sh
```

### 3. End-to-End Testing

```bash
# Test static site
curl -I https://vkp-consulting.fr/

# Test API v1
curl https://vkp-consulting.fr/api/

# Test API v2 (JWT required except /public)
curl -i https://vkp-consulting.fr/apiv2/external/me
# 401 without Authorization: Bearer <idToken>

# Test CORS
curl -H "Origin: https://vkp-consulting.fr" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS https://vkp-consulting.fr/apiv2/internal/files
```

---

## 📈 Monitoring & Alerting

### Key Metrics to Monitor

1. **Lambda Metrics**
   - Invocations
   - Errors
   - Duration (p50, p95, p99)
   - Throttles
   - Concurrent Executions

2. **API Gateway Metrics**
   - Count (requests)
   - 4xxError
   - 5xxError
   - Latency
   - IntegrationLatency

3. **CloudFront Metrics**
   - Requests
   - BytesDownloaded
   - ErrorRate
   - CacheHitRate

4. **S3 Metrics**
   - BucketSizeBytes
   - NumberOfObjects
   - AllRequests

### CloudWatch Dashboard

```bash
# Create custom dashboard
aws cloudwatch put-dashboard \
  --dashboard-name VKP-Infrastructure \
  --dashboard-body file://dashboard.json
```

---

## 🚨 Incident Response

### Common Issues & Solutions

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| **Lambda Cold Starts** | Slow first requests | Enable provisioned concurrency |
| **API Throttling** | 429 errors | Increase throttle limits |
| **CloudFront Cache Issues** | Stale content | Create invalidation |
| **S3 Access Denied** | 403 errors | Check bucket policy |
| **CORS Errors** | Browser blocks | Verify CORS config |
| **High Costs** | Bill spike | Check CloudWatch metrics |

### Rollback Procedure

```bash
# Rollback Terraform changes
cd terraform
terraform state pull > backup.tfstate
terraform apply -target=<resource> -var="old_value"

# Rollback Lambda code
aws lambda update-function-code \
  --function-name vkp-api2-service \
  --s3-bucket backups \
  --s3-key lambda-backup-v1.0.0.zip

# Rollback static site
aws s3 sync s3://backups/site-v1/ s3://vkp-consulting.fr/
```

---

## 📚 Additional Resources

### Documentation

- [Main README](README.md)
- [Authentication and authorization](AUTH.md)
- [Documentation index](DOCUMENTATION_INDEX.md)
- [Terraform Guide](terraform/README.md)
- [Terraform Quick Start](terraform/QUICK_START.md)
- [Infrastructure data](terraform/INFRASTRUCTURE_DATA.md)
- [API v2 Documentation](apiv2/API_DOCUMENTATION.md)
- [Testing Guide](apiv2/TESTING_GUIDE.md)
- [Static site](site/README.md)

### Terraform State

- **Backend**: S3 (`vkp-terraform-state-088455116440`)
- **Locking**: DynamoDB (`vkp-terraform-locks`)
- **Region**: eu-north-1
- **Workspace**: default

### External Links

- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [API Gateway HTTP APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)

---

## 🔮 Future Enhancements

### Planned Improvements

- [ ] Add WAF to CloudFront for enhanced security
- [ ] Add Lambda layers for shared dependencies
- [ ] Set up X-Ray tracing for distributed tracing
- [ ] Implement S3 lifecycle policies for log archival
- [ ] Add CloudWatch alarms for critical metrics
- [ ] Set up SNS topics for alerting
- [ ] Implement blue-green deployments
- [ ] Add automated backups with lifecycle policies
- [ ] Create disaster recovery runbook

---

**Document Version**: 1.2  
**Last Updated**: August 2026  
**Infrastructure Status**: Operational (Terraform + Cognito)

