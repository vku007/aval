# VKP AWS Infrastructure - Current State
**Last reviewed**: August 2026  
**AWS Account**: 088455116440  
**Primary Region**: eu-north-1

Live IDs for operators. Prefer `terraform output` when in doubt.

---

## 📊 Resource Inventory

### S3 Buckets (3)

| Bucket Name | Region | Purpose | Access |
|-------------|--------|---------|--------|
| vkp-consulting.fr | eu-north-1 | Static website | CloudFront OAC only |
| data-1-088455116440 | eu-north-1 | API data storage | Lambda role (json/*) |
| vkp-cloudfront-logs | eu-north-1 | CloudFront logs | Currently unused |

### Lambda Functions

| Function Name | Runtime | Memory | Timeout | Architecture | Role |
|---------------|---------|--------|---------|--------------|------|
| vkp-api2-service | nodejs20.x | 128 MB | 3s | arm64 | vkp-api2-service-role |
| vkp-simple-service | nodejs20.x | 128 MB | 3s | arm64 | vkp-simple-service-role |
| vkp-cognito-pre-signup | nodejs18.x | 256 MB | 10s | - | Cognito trigger role |
| vkp-cognito-post-confirmation | nodejs18.x | 256 MB | 10s | - | Cognito trigger role |
| vkp-cognito-pre-token-generation | nodejs18.x | 256 MB | 10s | - | Cognito trigger role |

**vkp-api2-service Environment Variables**:
```
APP_TAG=vkp-api
MAX_BODY_BYTES=1048576
JSON_PREFIX=json/
ENVIRONMENT=prod
BUCKET_NAME=data-1-088455116440
CORS_ORIGIN=https://vkp-consulting.fr
USER_POOL_ID=eu-north-1_OxGtXG08i
CLIENT_ID=77e2cmbthjul60ui7guh514u50
REGION=eu-north-1
```

**vkp-simple-service Environment Variables**:
```
MAX_BODY_BYTES=1048576
JSON_PREFIX=json/
BUCKET_NAME=vkp-consulting.fr
CORS_ORIGIN=https://vkp-consulting.fr
```

### API Gateway HTTP API

| Property | Value |
|----------|-------|
| Name | vkp-http-api-4 |
| API ID | wmrksdxxml |
| Endpoint | https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com |
| Protocol | HTTP |

**CORS Configuration**:
- AllowOrigins: `https://vkp-consulting.fr, https://www.vkp-consulting.fr`
- AllowMethods: GET, POST, PATCH, PUT, DELETE, OPTIONS
- MaxAge: 0

**Routes**:
| Route | Target Lambda | Auth |
|-------|---------------|------|
| ANY /api | vkp-simple-service | none |
| ANY /api/{proxy+} | vkp-simple-service | none |
| ANY /apiv2/public | vkp-api2-service | none |
| ANY /apiv2/public/{proxy+} | vkp-api2-service | none |
| ANY /apiv2 | vkp-api2-service | JWT |
| ANY /apiv2/{proxy+} | vkp-api2-service | JWT |

**JWT Authorizer**: `cognito-jwt-authorizer` when `enable_cognito_auth` is true (issuer `https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_OxGtXG08i`, audience = app client ID). API v2 Lambda still checks roles.

### Cognito

| Property | Value |
|----------|-------|
| User Pool ID | eu-north-1_OxGtXG08i |
| App Client ID | 77e2cmbthjul60ui7guh514u50 |
| Domain prefix | vkp-auth |
| Hosted UI | https://vkp-auth.auth.eu-north-1.amazoncognito.com |
| Issuer | https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_OxGtXG08i |
| JWKS | https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_OxGtXG08i/.well-known/jwks.json |
| Groups | admin, user, guest |
| Identity Pool | vkp_identity_pool (allow unauthenticated identities) |
| Callback URLs | https://vkp-consulting.fr/callback.html, https://vkp-consulting.fr/ |
| Logout URLs | https://vkp-consulting.fr/, https://vkp-consulting.fr/logout.html |
| Token validity | ID/access 60 min, refresh 30 days |

Use `terraform output` for the full URL set (`cognito_login_url`, `cognito_logout_url`, etc.).

### CloudFront Distribution

| Property | Value |
|----------|-------|
| Distribution ID | EJWBLACWDMFAZ |
| Domain Name | d1kcdf4orzsjcw.cloudfront.net |
| Aliases | vkp-consulting.fr, www.vkp-consulting.fr |
| Status | Deployed |
| Price Class | PriceClass_100 (US, Canada, Europe) |
| HTTP Version | http2 |
| IPv6 | Enabled |

**Certificate**:
- ARN: `arn:aws:acm:us-east-1:088455116440:certificate/e3774345-7028-415a-ab57-bd1f8e02a021`
- Region: us-east-1 (required for CloudFront)
- Protocol: TLSv1.2_2021

**Origins**:
1. **s3-origin-vkp**: vkp-consulting.fr.s3.eu-north-1.amazonaws.com
   - OAC ID: E3QY4UMB9YVA18 (OAC-vkp)
   
2. **API Gateway**: wmrksdxxml.execute-api.eu-north-1.amazonaws.com
   - Protocol: HTTPS only (TLSv1.2)
   - Timeout: 30s

**Cache Behaviors**:
| Path Pattern | Origin | Allowed Methods | Cache Policy |
|--------------|--------|-----------------|--------------|
| / (default) | S3 | GET, HEAD | CachingOptimized + rewrite-index |
| /api/errors/* | S3 | GET, HEAD | CachingOptimized |
| /api/* | API Gateway | ALL | CachingDisabled + AllViewer |
| /apiv2/* | API Gateway | ALL | CachingDisabled + AllViewer |

**Custom Error Responses**:
| Error Code | Response Page | TTL |
|------------|---------------|-----|
| 400 | /api/errors/400.html | 300s |
| 403 | /api/errors/403.html | 300s |
| 404 | /api/errors/404.html | 300s |
| 500 | /api/errors/500.html | 60s |

### Route53

| Property | Value |
|----------|-------|
| Hosted Zone ID | Z094077718N53LUC7MTBL |
| Domain | vkp-consulting.fr |

**DNS Records**:
| Name | Type | Target |
|------|------|--------|
| vkp-consulting.fr | A (Alias) | d1kcdf4orzsjcw.cloudfront.net |
| vkp-consulting.fr | AAAA (Alias) | d1kcdf4orzsjcw.cloudfront.net |
| www.vkp-consulting.fr | A (Alias) | d1kcdf4orzsjcw.cloudfront.net |
| www.vkp-consulting.fr | AAAA (Alias) | d1kcdf4orzsjcw.cloudfront.net |

Plus ACM validation CNAME records.

### IAM Roles

**vkp-api2-service-role**:
- Trust Policy: Lambda service
- Managed Policies: AWSLambdaBasicExecutionRole
- Inline Policy: S3JsonAccess-data-1-088455116440 (`json/*`)
- Inline Policy: CognitoUserManagement (when Cognito enabled) — AdminCreateUser, AdminSetUserPassword, group add/remove, AdminGetUser, ListUsers, InitiateAuth

**vkp-simple-service-role**:
- Same S3 pattern against `vkp-consulting.fr/json/*`

### CloudWatch Log Groups

| Log Group | Retention |
|-----------|-----------|
| /aws/lambda/vkp-api2-service | 7 days |
| /aws/lambda/vkp-simple-service | 7 days |
| /aws/lambda/vkp-cognito-pre-signup | 7 days |
| /aws/lambda/vkp-cognito-post-confirmation | 7 days |
| /aws/lambda/vkp-cognito-pre-token-generation | 7 days |
| /aws/apigateway/vkp-http-api | 7 days |

---

## 🔄 Resource Dependencies

```
Route53 (DNS)
    ↓
CloudFront Distribution
    ├─→ S3 Bucket (vkp-consulting.fr) [via OAC]
    └─→ API Gateway (wmrksdxxml)
            ├─ JWT authorizer (except /apiv2/public/*)
            ├─→ Lambda (vkp-api2-service)  # roles in-app
            │       ↓
            │   S3 Bucket (data-1-088455116440)
            └─→ Lambda (vkp-simple-service)
                    ↓
                S3 Bucket (vkp-consulting.fr)

Cognito triggers: pre-signup, post-confirmation, pre-token-generation
```

---

## Resource ID reference

```
# S3
vkp-consulting.fr
data-1-088455116440
vkp-cloudfront-logs

# Lambda
vkp-api2-service
vkp-simple-service
vkp-cognito-pre-signup
vkp-cognito-post-confirmation
vkp-cognito-pre-token-generation

# IAM
vkp-api2-service-role
vkp-simple-service-role

# API Gateway
API_ID: wmrksdxxml
Integration IDs: 7i5dlto, 8ta0jlt, n4u3wc0
Route IDs: 7jbign5, lryw566, mknw9sn, t0i0jku

# CloudFront
Distribution ID: EJWBLACWDMFAZ
OAC ID: E3QY4UMB9YVA18

# Route53
Zone ID: Z094077718N53LUC7MTBL
CloudFront hosted zone: Z2FDTNDATAQYW2

# ACM
arn:aws:acm:us-east-1:088455116440:certificate/e3774345-7028-415a-ab57-bd1f8e02a021

# Identity Pool
vkp_identity_pool

# Cognito
User Pool: eu-north-1_OxGtXG08i
Client: 77e2cmbthjul60ui7guh514u50
Domain: vkp-auth
```

---

**Note**: Core IDs were collected from AWS CLI (October 2025) and Cognito values from Terraform outputs. Re-check with `terraform output` after applies.

