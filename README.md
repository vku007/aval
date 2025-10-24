# VKP Consulting Infrastructure

A complete AWS-based web application infrastructure featuring static website hosting, REST APIs, Lambda functions, and CloudFront CDN - all managed with Terraform.

## 🏗️ Infrastructure Overview

This project provides a production-ready AWS infrastructure with:

- **Static Website Hosting**: S3 + CloudFront for `vkp-consulting.fr`
- **REST APIs**: Two Lambda-based microservices for file and game management
- **CDN & HTTPS**: CloudFront distribution with custom domain and SSL
- **DNS Management**: Route53 for domain routing
- **Infrastructure as Code**: Complete Terraform setup for reproducible deployments

### Live Endpoints

- **Website**: https://vkp-consulting.fr
- **CloudFront**: https://d1kcdf4orzsjcw.cloudfront.net
- **API Gateway**: https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com

## 📁 Project Structure

```
vkp/aval/
├── terraform/              # Infrastructure as Code (Terraform)
│   ├── modules/           # Reusable Terraform modules
│   │   ├── s3-bucket/    # S3 bucket configuration
│   │   ├── lambda-function/  # Lambda function setup
│   │   ├── apigateway-http/  # API Gateway HTTP API
│   │   ├── cloudfront/   # CloudFront distribution
│   │   └── route53/      # DNS records management
│   ├── scripts/          # Deployment and management scripts
│   ├── main.tf           # Main Terraform configuration
│   ├── variables.tf      # Input variables
│   ├── outputs.tf        # Output values
│   └── README.md         # Terraform documentation
│
├── apiv2/                 # REST API v2 (Advanced)
│   ├── src/              # TypeScript source code
│   │   ├── domain/       # Domain entities (User, Game, File)
│   │   ├── application/  # Business logic and DTOs
│   │   ├── infrastructure/  # S3 repositories, AWS SDK
│   │   ├── presentation/ # Controllers and routing
│   │   └── shared/       # Utilities and error handling
│   ├── dist/             # Compiled JavaScript
│   ├── lambda.zip        # Deployment package
│   ├── buildAndDeploy.sh # Build and deploy script
│   └── README.md         # API documentation
│
├── lambda/                # REST API v1 (Simple)
│   ├── src/              # TypeScript source code
│   ├── dist/             # Compiled JavaScript
│   ├── lambda.zip        # Deployment package
│   └── commands/         # AWS CLI deployment scripts
│
└── site/                  # Static website content
    ├── index.html        # Homepage
    ├── users/            # User management interface
    ├── games/            # Game management interface
    ├── entities/         # Entity management interface
    └── errors/           # Custom error pages (404, 500, etc.)
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

#### API v1 (Simple - Basic File Operations)

```bash
cd lambda

# Install dependencies
npm install

# Build and deploy
./commands/build.sh
./commands/update.sh
```

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
│  ┌──────────────────────────────────────────────┐  │
│  │  Origin 1: S3 Static Site (vkp-consulting.fr) │  │
│  │  Origin 2: API Gateway (wmrksdxxml)           │  │
│  └──────────────────────────────────────────────┘  │
└──────────┬───────────────────────┬──────────────────┘
           │                       │
┌──────────▼──────────┐   ┌───────▼─────────────────┐
│   S3 Static Site    │   │   API Gateway HTTP API   │
│ vkp-consulting.fr   │   │     wmrksdxxml          │
│                     │   │  ┌────────────────────┐ │
│ - HTML/CSS/JS       │   │  │ Routes:            │ │
│ - Error pages       │   │  │ /api/*  → λ simple │ │
│ - User interface    │   │  │ /apiv2/* → λ api2  │ │
└─────────────────────┘   │  └────────────────────┘ │
                          └──────┬──────────┬────────┘
                                 │          │
                     ┌───────────▼──┐   ┌──▼──────────────┐
                     │ Lambda Simple│   │  Lambda API v2  │
                     │ vkp-simple-  │   │  vkp-api2-      │
                     │ service      │   │  service        │
                     │              │   │                 │
                     │ - Basic CRUD │   │ - File mgmt     │
                     │ - JSON files │   │ - User mgmt     │
                     │              │   │ - Game mgmt     │
                     │              │   │ - ETag control  │
                     │              │   │ - Validation    │
                     └──────┬───────┘   └────┬────────────┘
                            │                │
                            └────────┬───────┘
                                     │
                          ┌──────────▼──────────────┐
                          │   S3 Data Bucket        │
                          │   data-1-088455116440   │
                          │                         │
                          │ - JSON documents        │
                          │ - User entities         │
                          │ - Game entities         │
                          └─────────────────────────┘
```

### Request Flow

1. **Static Content**: `vkp-consulting.fr` → CloudFront → S3 Static Bucket
2. **API Requests**: `vkp-consulting.fr/api/*` → CloudFront → API Gateway → Lambda → S3 Data
3. **Direct API**: API Gateway URL → Lambda → S3 Data

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

# Or use Terraform
cd ../terraform
terraform apply -target=module.lambda_api2.aws_lambda_function.main
```

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

**Quick Reference**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/files` | GET | List all files |
| `/files` | POST | Create file |
| `/files/{id}` | GET/PUT/PATCH/DELETE | Manage file |
| `/users` | GET/POST | User management |
| `/users/{id}` | GET/PUT/PATCH/DELETE | User operations |
| `/games` | GET/POST | Game management |
| `/games/{id}` | GET/PUT/PATCH/DELETE | Game operations |
| `/games/{id}/rounds` | POST | Add game round |
| `/games/{gid}/rounds/{rid}/moves` | POST | Add move |

**Full Documentation**: See [`apiv2/README.md`](apiv2/README.md) and [`apiv2/COMPLETE_API_DOCUMENTATION.md`](apiv2/COMPLETE_API_DOCUMENTATION.md)

### API v1 (Simple) - `/api/*`

Basic JSON file CRUD operations.

**Base URL**: `https://vkp-consulting.fr/api` or `https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/api`

**Endpoints**:
- `GET /api/files` - List files
- `POST /api/files` - Create file
- `GET /api/files/{name}` - Get file
- `PUT /api/files/{name}` - Update file
- `DELETE /api/files/{name}` - Delete file

## 🧪 Testing

### Unit & Integration Tests

```bash
# API v2 tests
cd apiv2
npm test                    # Run all tests
npm run test:coverage       # With coverage report

# Manual API testing
./test-game-api.sh         # Comprehensive game API test
./test-user-integration.sh # User API test
```

### Load Testing

```bash
# Using Apache Bench
ab -n 1000 -c 10 https://vkp-consulting.fr/apiv2/files

# Using curl in loop
for i in {1..100}; do
  curl -w "%{time_total}\n" -o /dev/null -s \
    https://vkp-consulting.fr/apiv2/files
done
```

## 🔒 Security

### Current Setup

- ✅ **HTTPS Only**: CloudFront enforces HTTPS
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
- **Total**: ~$15-85/month

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

- **Terraform Setup**: [`terraform/README.md`](terraform/README.md)
- **Terraform Quick Start**: [`terraform/QUICK_START.md`](terraform/QUICK_START.md)
- **API v2 Documentation**: [`apiv2/COMPLETE_API_DOCUMENTATION.md`](apiv2/COMPLETE_API_DOCUMENTATION.md)
- **Testing Guide**: [`apiv2/TESTING_GUIDE.md`](apiv2/TESTING_GUIDE.md)
- **Infrastructure Data**: [`terraform/INFRASTRUCTURE_DATA.md`](terraform/INFRASTRUCTURE_DATA.md)
- **Migration Checklist**: [`terraform/MIGRATION_CHECKLIST.md`](terraform/MIGRATION_CHECKLIST.md)

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
# Edit terraform/modules/lambda-function/main.tf
# Change timeout from 30 to 60 seconds
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
- **API Documentation**: [Complete API Docs](apiv2/COMPLETE_API_DOCUMENTATION.md)
- **Terraform Guide**: [Infrastructure Guide](terraform/README.md)
- **OpenAPI Spec**: [OpenAPI YAML](apiv2/COMPLETE_OPENAPI.yaml)

---

**Last Updated**: October 2024  
**Terraform Version**: 1.13.4  
**AWS Region**: eu-north-1  
**Node Version**: 20.x

