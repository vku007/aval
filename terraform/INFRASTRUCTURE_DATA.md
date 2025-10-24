# VKP AWS Infrastructure - Current State
**Collected**: October 24, 2025  
**AWS Account**: 088455116440  
**Primary Region**: eu-north-1

---

## 📊 Resource Inventory

### S3 Buckets (3)

| Bucket Name | Region | Purpose | Access |
|-------------|--------|---------|--------|
| vkp-consulting.fr | eu-north-1 | Static website | CloudFront OAC only |
| data-1-088455116440 | eu-north-1 | API data storage | Lambda role (json/*) |
| vkp-cloudfront-logs | eu-north-1 | CloudFront logs | Currently unused |

### Lambda Functions (2)

| Function Name | Runtime | Memory | Timeout | Architecture | Role |
|---------------|---------|--------|---------|--------------|------|
| vkp-api2-service | nodejs20.x | 128 MB | 3s | arm64 | vkp-api2-service-role |
| vkp-simple-service | nodejs20.x | 128 MB | 3s | arm64 | vkp-simple-service-role |

**vkp-api2-service Environment Variables**:
```
APP_TAG=vkp-api
MAX_BODY_BYTES=1048576
JSON_PREFIX=json/
ENVIRONMENT=prod
BUCKET_NAME=data-1-088455116440
CORS_ORIGIN=https://vkp-consulting.fr
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
| Route | Target Lambda | Integration ID |
|-------|---------------|----------------|
| ANY /api | vkp-simple-service | n4u3wc0 |
| ANY /api/{proxy+} | vkp-simple-service | 7i5dlto |
| ANY /apiv2 | vkp-api2-service | 8ta0jlt |
| ANY /apiv2/{proxy+} | vkp-api2-service | 8ta0jlt |

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
| / (default) | S3 | GET, HEAD | CachingOptimized |
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
- Inline Policy: S3JsonAccess-data-1-088455116440
  - S3 ListBucket (json/* prefix)
  - S3 GetObject, PutObject, DeleteObject, HeadObject (json/* objects)

**vkp-simple-service-role**:
- Similar structure to vkp-api2-service-role
- Access to different S3 bucket

### CloudWatch Log Groups

| Log Group | Retention |
|-----------|-----------|
| /aws/lambda/vkp-api2-service | 7 days |
| /aws/lambda/vkp-simple-service | 7 days |
| /aws/apigateway/vkp-http-api | 7 days |

---

## 🔄 Resource Dependencies

```
Route53 (DNS)
    ↓
CloudFront Distribution
    ├─→ S3 Bucket (vkp-consulting.fr) [via OAC]
    └─→ API Gateway (wmrksdxxml)
            ├─→ Lambda (vkp-api2-service)
            │       ↓
            │   S3 Bucket (data-1-088455116440)
            └─→ Lambda (vkp-simple-service)
                    ↓
                S3 Bucket (vkp-consulting.fr)
```

---

## 📋 Resource IDs Reference

Quick reference for import commands:

```bash
# S3 Buckets
vkp-consulting.fr
data-1-088455116440
vkp-cloudfront-logs

# Lambda Functions
vkp-api2-service
vkp-simple-service

# IAM Roles
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
Hosted Zone CloudFront: Z2FDTNDATAQYW2 (global)

# ACM Certificate
arn:aws:acm:us-east-1:088455116440:certificate/e3774345-7028-415a-ab57-bd1f8e02a021
```

---

**Note**: This data was collected directly from AWS using AWS CLI. It represents the actual state of your infrastructure as of October 24, 2025.

