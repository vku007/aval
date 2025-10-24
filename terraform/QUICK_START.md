# Terraform Quick Start Guide

## 🎯 Goal
Manage your AWS infrastructure as code using Terraform.

## ⚡ 5-Minute Setup

### Step 1: Setup Backend (One-time)
```bash
cd terraform
./scripts/setup-backend.sh
```

### Step 2: Initialize Terraform
```bash
terraform init
```

### Step 3: Import Existing Resources
```bash
./scripts/import-resources.sh
```

### Step 4: Verify Configuration
```bash
terraform plan
```

Expected: **0 changes** (infrastructure already matches code)

## 🚀 Daily Workflow

### Deploying Lambda Updates

```bash
# 1. Build Lambda
cd apiv2
npm ci && npm run build && npm run zip

# 2. Deploy with Terraform
cd ../terraform
terraform apply -target=module.lambda_api2.aws_lambda_function.main -auto-approve
```

### Making Infrastructure Changes

```bash
# 1. Edit Terraform files
vim main.tf

# 2. Plan changes
./scripts/plan.sh

# 3. Review the plan carefully

# 4. Apply changes
./scripts/apply.sh
```

## 📝 Common Commands

```bash
# See all resources
terraform state list

# Check specific resource
terraform show module.lambda_api2.aws_lambda_function.main

# Format code
terraform fmt -recursive

# Validate syntax
terraform validate

# Refresh state from AWS
terraform refresh
```

## 🔍 Viewing Outputs

```bash
# All outputs
terraform output

# Specific output
terraform output api_gateway_url
terraform output website_url
```

## ⚠️ Important Notes

1. **Always run `terraform plan` before `apply`**
2. **Never commit `terraform.tfvars`** (contains sensitive data)
3. **State is stored in S3** (shared across team)
4. **DynamoDB provides state locking** (prevents conflicts)

## 🆘 Need Help?

- Full documentation: `terraform/README.md`
- Migration plan: `TERRAFORM_MIGRATION_PLAN.md`
- Terraform docs: https://www.terraform.io/docs

## 📞 Emergency Rollback

```bash
# If something goes wrong, rollback Lambda:
cd apiv2
aws lambda update-function-code \
  --function-name vkp-api2-service \
  --zip-file fileb://lambda.zip \
  --region eu-north-1
```

---

**Pro Tip**: Alias common commands in your shell:

```bash
# Add to ~/.zshrc or ~/.bashrc
alias tfp='terraform plan'
alias tfa='terraform apply'
alias tfo='terraform output'
alias tfs='terraform state list'
```

