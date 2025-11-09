# VKP Consulting - Terraform Infrastructure

This directory contains Terraform configuration to manage the VKP Consulting AWS infrastructure.

## 📁 Directory Structure

```
terraform/
├── backend.tf                     # S3 backend configuration
├── versions.tf                    # Provider versions and configuration
├── variables.tf                   # Input variables
├── outputs.tf                     # Output values
├── main.tf                        # Main orchestration
├── terraform.tfvars.example       # Example variable values
│
├── modules/                       # Reusable modules
│   ├── s3-bucket/                 # S3 bucket module
│   ├── lambda-function/           # Lambda function module
│   ├── apigateway-http/           # API Gateway HTTP API module
│   ├── cloudfront/                # CloudFront distribution module
│   └── route53/                   # Route53 DNS records module
│
└── scripts/                       # Helper scripts
    ├── setup-backend.sh           # Setup Terraform backend
    ├── import-resources.sh        # Import existing resources
    ├── plan.sh                    # Run terraform plan
    └── apply.sh                   # Run terraform apply
```

## 🚀 Quick Start

### 1. Prerequisites

- Terraform >= 1.5.0
- AWS CLI configured with appropriate credentials
- Access to AWS account 088455116440

```bash
# Install Terraform (macOS)
brew install terraform

# Verify installation
terraform version

# Verify AWS credentials
aws sts get-caller-identity
```

### 2. Setup Terraform Backend

First time only - create S3 bucket and DynamoDB table for state management:

```bash
./scripts/setup-backend.sh
```

This creates:
- S3 bucket: `vkp-terraform-state-088455116440`
- DynamoDB table: `vkp-terraform-locks`

### 3. Initialize Terraform

```bash
terraform init
```

### 4. Import Existing Resources

Import your existing AWS resources into Terraform state:

```bash
./scripts/import-resources.sh
```

### 5. Verify Configuration

```bash
terraform plan
```

**Expected result**: After successful import, `terraform plan` should show 0 changes.

If it shows changes, review them carefully and adjust the Terraform configuration to match your actual infrastructure.

## 📋 Common Operations

### Planning Changes

```bash
# Generate and save execution plan
./scripts/plan.sh

# Or manually
terraform plan -out=tfplan
```

### Applying Changes

```bash
# Apply saved plan
./scripts/apply.sh

# Or manually
terraform apply tfplan
```

### Deploying Lambda Updates

```bash
# Build and deploy Lambda functions
cd ../apiv2
npm ci
npm run build
npm run zip

# Update Lambda via Terraform
cd ../terraform
terraform apply -target=module.lambda_api2.aws_lambda_function.main
```

### Managing Cognito Users

```bash
# List all users
../scripts/list-cognito-users.sh

# Create test user
../scripts/create-test-user.sh admin "Admin User" "SecurePass123!"

# Reset user password
../scripts/reset-user-password.sh user@example.com "NewPass123!"

# Delete test users
../scripts/delete-test-users.sh
```

### Updating Cognito Lambda Triggers

```bash
# Build trigger functions
cd ../lambda/cognito-triggers
npm ci
npm run build
npm run zip

# Deploy via Terraform
cd ../../terraform
terraform apply \
  -target='module.cognito[0].aws_lambda_function.pre_signup' \
  -target='module.cognito[0].aws_lambda_function.post_confirmation' \
  -target='module.cognito[0].aws_lambda_function.pre_token_generation'

# Re-attach triggers to user pool (required after updates)
aws cognito-idp update-user-pool \
  --user-pool-id eu-north-1_OxGtXG08i \
  --lambda-config \
    PreSignUp=arn:aws:lambda:eu-north-1:088455116440:function:vkp-cognito-pre-signup \
    PostConfirmation=arn:aws:lambda:eu-north-1:088455116440:function:vkp-cognito-post-confirmation \
    PreTokenGeneration=arn:aws:lambda:eu-north-1:088455116440:function:vkp-cognito-pre-token-generation
```

### Viewing Current State

```bash
# List all resources
terraform state list

# Show specific resource
terraform state show module.lambda_api2.aws_lambda_function.main
```

### Destroying Resources (CAREFUL!)

```bash
# Destroy specific resource
terraform destroy -target=module.cloudfront.aws_cloudfront_distribution.main

# Destroy everything (VERY DANGEROUS!)
terraform destroy
```

## 🏗️ Infrastructure Components

### S3 Buckets

1. **vkp-consulting.fr** - Static website
   - CloudFront OAC access
   - Public access blocked

2. **data-1-088455116440** - API data storage
   - Lambda role access to `json/*` prefix
   - HTTPS only (enforced via bucket policy)

3. **vkp-cloudfront-logs** - CloudFront access logs
   - Currently logging is disabled

### Lambda Functions

1. **vkp-api2-service** - Primary REST API
   - Runtime: Node.js 20.x
   - Architecture: ARM64
   - Memory: 128 MB
   - Timeout: 3 seconds
   - S3 access: data-1-088455116440/json/*

2. **vkp-simple-service** - Legacy/Alternative API
   - Runtime: Node.js 20.x
   - Architecture: ARM64
   - Memory: 128 MB
   - Timeout: 3 seconds
   - S3 access: vkp-consulting.fr/json/*

### API Gateway

- **Name**: vkp-http-api-4
- **Type**: HTTP API
- **CORS**: Enabled for vkp-consulting.fr
- **Routes**:
  - `ANY /api` → vkp-simple-service
  - `ANY /api/{proxy+}` → vkp-simple-service
  - `ANY /apiv2` → vkp-api2-service
  - `ANY /apiv2/{proxy+}` → vkp-api2-service

### CloudFront Distribution

- **Aliases**: vkp-consulting.fr, www.vkp-consulting.fr
- **Origins**:
  1. S3: vkp-consulting.fr (via OAC)
  2. API Gateway: wmrksdxxml.execute-api.eu-north-1.amazonaws.com
- **Cache Behaviors**:
  - `/` (default) → S3, cached
  - `/api/errors/*` → S3, cached
  - `/api/*` → API Gateway, not cached
  - `/apiv2/*` → API Gateway, not cached
- **Custom Errors**: 400, 403, 404, 500 → S3 error pages

### Route53

- **Zone**: vkp-consulting.fr (Z094077718N53LUC7MTBL)
- **Records**:
  - `vkp-consulting.fr` (A/AAAA) → CloudFront
  - `www.vkp-consulting.fr` (A/AAAA) → CloudFront

### Cognito Authentication

- **User Pool**: vkp-user-pool (eu-north-1_OxGtXG08i)
- **Client ID**: 77e2cmbthjul60ui7guh514u50
- **Domain**: vkp-auth.auth.eu-north-1.amazoncognito.com
- **Groups**: admin, user, guest
- **Lambda Triggers**: Pre-signup, Post-confirmation, Pre-token-generation
  - ⚠️ **Note**: Triggers must be manually attached (see below)

#### Attaching Cognito Lambda Triggers

Due to Terraform circular dependency limitations, Lambda triggers must be manually attached after initial deployment.

**Step 1: Get Lambda Function ARNs**

```bash
# Get trigger function ARNs
aws lambda get-function --function-name vkp-cognito-pre-signup \
  --query 'Configuration.FunctionArn' --output text

aws lambda get-function --function-name vkp-cognito-post-confirmation \
  --query 'Configuration.FunctionArn' --output text

aws lambda get-function --function-name vkp-cognito-pre-token-generation \
  --query 'Configuration.FunctionArn' --output text
```

**Step 2: Attach Triggers to User Pool**

```bash
# Attach all triggers at once
aws cognito-idp update-user-pool \
  --user-pool-id eu-north-1_OxGtXG08i \
  --lambda-config \
    PreSignUp=arn:aws:lambda:eu-north-1:088455116440:function:vkp-cognito-pre-signup \
    PostConfirmation=arn:aws:lambda:eu-north-1:088455116440:function:vkp-cognito-post-confirmation \
    PreTokenGeneration=arn:aws:lambda:eu-north-1:088455116440:function:vkp-cognito-pre-token-generation
```

**Step 3: Verify Attachment**

```bash
# Check if triggers are attached
aws cognito-idp describe-user-pool \
  --user-pool-id eu-north-1_OxGtXG08i \
  --query 'UserPool.LambdaConfig' \
  --output json
```

**Expected Output:**

```json
{
  "PreSignUp": "arn:aws:lambda:eu-north-1:088455116440:function:vkp-cognito-pre-signup",
  "PostConfirmation": "arn:aws:lambda:eu-north-1:088455116440:function:vkp-cognito-post-confirmation",
  "PreTokenGeneration": "arn:aws:lambda:eu-north-1:088455116440:function:vkp-cognito-pre-token-generation"
}
```

**What Each Trigger Does:**

1. **Pre-Signup** (`vkp-cognito-pre-signup`)
   - Validates display name
   - Auto-confirms guest users (no email)
   - Requires email verification for regular users

2. **Post-Confirmation** (`vkp-cognito-post-confirmation`)
   - Assigns default group based on user type
   - Guest users → `guest` group
   - Regular users → `user` group
   - Admins must be manually assigned

3. **Pre-Token-Generation** (`vkp-cognito-pre-token-generation`)
   - Adds custom claims to JWT tokens
   - Includes: role, display_name, email
   - Based on group membership (admin > user > guest)

**When to Re-attach:**

- After initial Cognito deployment
- After updating Lambda trigger code
- If authentication stops working (triggers may have been detached)

## 🔧 Configuration

### Variables

Key variables defined in `variables.tf`:

```hcl
aws_region              = "eu-north-1"
aws_account_id          = "088455116440"
domain_name             = "vkp-consulting.fr"
api_data_bucket_name    = "data-1-088455116440"
acm_certificate_arn     = "arn:aws:acm:us-east-1:..."
route53_zone_id         = "Z094077718N53LUC7MTBL"
```

### Customization

Copy the example file and customize:

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars (git-ignored)
```

## 🔒 Security

### State Management

- **Backend**: S3 with encryption
- **Locking**: DynamoDB
- **Versioning**: Enabled on state bucket

### Access Control

- Terraform state contains sensitive data
- Keep `terraform.tfvars` out of version control
- Use IAM roles with least privilege

### Secrets

Never commit:
- `terraform.tfvars` (contains sensitive values)
- `*.tfstate` files
- AWS credentials

## 🐛 Troubleshooting

### Import Fails

```bash
# Check if resource exists
aws lambda get-function --function-name vkp-api2-service --region eu-north-1

# Try importing manually
terraform import 'module.lambda_api2.aws_lambda_function.main' vkp-api2-service
```

### Plan Shows Unexpected Changes

```bash
# Compare with AWS console
# Review Terraform resource definition
# Check for drift

# Refresh state
terraform refresh
```

### State Lock Issues

```bash
# Check DynamoDB for stuck locks
aws dynamodb scan --table-name vkp-terraform-locks

# Force unlock (use carefully!)
terraform force-unlock <LOCK_ID>
```

### Lambda Deployment Issues

```bash
# Ensure lambda.zip is built
ls -lh ../apiv2/lambda.zip

# Check function exists
aws lambda get-function --function-name vkp-api2-service --region eu-north-1

# Manually update if needed
aws lambda update-function-code \
  --function-name vkp-api2-service \
  --zip-file fileb://../apiv2/lambda.zip \
  --region eu-north-1
```

### Cognito Lambda Triggers Not Attached

If Cognito authentication isn't working (users can't sign up, roles not assigned):

```bash
# Check if triggers are attached
aws cognito-idp describe-user-pool \
  --user-pool-id eu-north-1_OxGtXG08i \
  --query 'UserPool.LambdaConfig'

# If empty, attach triggers manually (see Cognito section below)
```

## 📚 Additional Resources

- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)
- [AWS Lambda with Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function)
- [CloudFront with Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_distribution)

## 🤝 Contributing

1. Make changes in a feature branch
2. Run `terraform fmt` to format code
3. Run `terraform validate` to validate syntax
4. Run `terraform plan` to preview changes
5. Submit pull request for review

## 📞 Support

For issues or questions:
- Review the main [TERRAFORM_MIGRATION_PLAN.md](../TERRAFORM_MIGRATION_PLAN.md)
- Check AWS console for actual resource state
- Review CloudWatch logs for Lambda errors

---

**Last Updated**: October 24, 2025  
**Terraform Version**: >= 1.5.0  
**AWS Provider Version**: ~> 5.0

