# Cognito Authentication Deployment Guide

**Status**: 80% Complete - Ready for Deployment  
**Date**: November 2, 2025

## 📋 Overview

This guide provides step-by-step instructions for deploying the Cognito authentication system to AWS.

## ✅ What's Been Implemented

### Phase 1-8 Complete (80%)

- ✅ **Terraform Cognito Module** - User Pool, Identity Pool, Groups, IAM Roles
- ✅ **Lambda Triggers** - Pre-signup, Post-confirmation, Pre-token-generation
- ✅ **Lambda@Edge** - CloudFront authentication check
- ✅ **API Gateway JWT Authorizer** - Token validation
- ✅ **Lambda API Auth Middleware** - Role-based authorization
- ✅ **Frontend Integration** - OAuth callback, logout

## 🚀 Deployment Steps

### Prerequisites

1. **AWS CLI configured** with appropriate credentials
2. **Terraform** installed (v1.0+)
3. **Node.js** installed (v18+)
4. **Git** repository up to date

### Step 1: Update Terraform Variables

Edit `terraform/terraform.tfvars` (create from `terraform.tfvars.example` if needed):

```hcl
# Existing variables
project_name = "vkp"
environment  = "production"
region       = "eu-north-1"
domain_name  = "vkp-consulting.fr"

# New Cognito variables
enable_cognito_auth = true
cognito_domain_prefix = "vkp-auth"  # Must be globally unique

# Optional: Enable Google OAuth later
enable_google_oauth = false
google_client_id = ""
google_client_secret = ""
```

### Step 2: Update Main Terraform Configuration

Add the Cognito module to `terraform/main.tf`:

```hcl
# Cognito Authentication Module
module "cognito" {
  source = "./modules/cognito"
  
  project_name = var.project_name
  environment  = var.environment
  region       = var.region
  
  # Domain configuration
  domain_prefix = var.cognito_domain_prefix
  
  # OAuth configuration
  callback_urls = [
    "https://${var.domain_name}/callback",
    "https://${var.domain_name}"
  ]
  logout_urls = [
    "https://${var.domain_name}/logout",
    "https://${var.domain_name}"
  ]
  
  # Google OAuth (optional)
  enable_google_oauth = var.enable_google_oauth
  google_client_id    = var.google_client_id
  google_client_secret = var.google_client_secret
  
  # API Gateway ARN for IAM policies
  api_gateway_arn = module.apigateway.api_arn
  
  tags = local.common_tags
}

# Update API Gateway module to use JWT authorizer
module "apigateway" {
  source = "./modules/apigateway-http"
  
  # ... existing configuration ...
  
  # Add Cognito configuration
  enable_jwt_authorizer = true
  cognito_client_id     = module.cognito.user_pool_client_id
  cognito_issuer_url    = module.cognito.issuer_url
}
```

### Step 3: Build Lambda Triggers

```bash
cd /Users/main/vkp/aval/lambda/cognito-triggers

# Install dependencies
npm install

# Build all triggers
npm run build

# Create deployment packages
npm run zip

# Verify zip files exist
ls -lh dist/*.zip
```

Expected output:
```
dist/pre-signup.zip
dist/post-confirmation.zip
dist/pre-token-generation.zip
```

### Step 4: Build Lambda@Edge

```bash
cd /Users/main/vkp/aval/lambda/edge

# Install dependencies
npm install

# Build function
npm run build

# Create deployment package
npm run zip

# Verify zip file
ls -lh dist/viewer-request.zip
```

### Step 5: Update Lambda API

```bash
cd /Users/main/vkp/aval/apiv2

# Install new dependencies
npm install

# Replace index.ts with auth-enabled version
cp src/index-with-auth.ts src/index.ts

# Build
npm run build

# Create deployment package
npm run zip

# Verify
ls -lh lambda.zip
```

### Step 6: Deploy Infrastructure with Terraform

```bash
cd /Users/main/vkp/aval/terraform

# Initialize (if needed)
terraform init

# Plan deployment
terraform plan -out=cognito-deployment.tfplan

# Review the plan carefully
# Expected new resources:
# - aws_cognito_user_pool.main
# - aws_cognito_user_pool_client.web_client
# - aws_cognito_user_pool_domain.main
# - aws_cognito_identity_pool.main
# - aws_cognito_user_pool_group.admin
# - aws_cognito_user_pool_group.user
# - aws_cognito_user_pool_group.guest
# - aws_iam_role.cognito_* (multiple)
# - aws_lambda_function.pre_signup
# - aws_lambda_function.post_confirmation
# - aws_lambda_function.pre_token_generation
# - aws_apigatewayv2_authorizer.cognito_jwt

# Apply deployment
terraform apply cognito-deployment.tfplan
```

### Step 7: Deploy Static Site Updates

```bash
cd /Users/main/vkp/aval

# Sync callback and logout pages
aws s3 sync site/ s3://vkp-consulting.fr/ \
  --exclude "*" \
  --include "callback.html" \
  --include "logout.html"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id EJWBLACWDMFAZ \
  --paths "/callback.html" "/logout.html"
```

### Step 8: Configure Environment Variables

After Terraform deployment, update Lambda function environment variables:

```bash
# Get Cognito outputs from Terraform
USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
CLIENT_ID=$(terraform output -raw cognito_client_id)
REGION="eu-north-1"

# Update Lambda API environment variables
aws lambda update-function-configuration \
  --function-name vkp-api2 \
  --environment "Variables={
    USER_POOL_ID=$USER_POOL_ID,
    CLIENT_ID=$CLIENT_ID,
    AWS_REGION=$REGION
  }"

# Update Lambda@Edge environment variables
# Note: Lambda@Edge has limitations on environment variables
# Consider using Lambda function code configuration instead
```

### Step 9: Update Frontend Configuration

Update `site/callback.html` with actual Cognito values:

```javascript
// Replace placeholders in callback.html
const COGNITO_DOMAIN = 'vkp-auth.auth.eu-north-1.amazoncognito.com';
const CLIENT_ID = '<actual-client-id-from-terraform>';
const REDIRECT_URI = 'https://vkp-consulting.fr/callback';
```

You can automate this with Terraform:

```hcl
# In terraform/main.tf
resource "local_file" "callback_html" {
  content = templatefile("${path.module}/../site/callback.html.tpl", {
    cognito_domain = module.cognito.user_pool_domain
    client_id      = module.cognito.user_pool_client_id
    region         = var.region
  })
  filename = "${path.module}/../site/callback.html"
}
```

### Step 10: Create First Admin User

```bash
# Get User Pool ID
USER_POOL_ID=$(cd terraform && terraform output -raw cognito_user_pool_id)

# Create admin user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin \
  --user-attributes \
    Name=email,Value=admin@vkp-consulting.fr \
    Name=custom:display_name,Value=Administrator \
    Name=custom:role,Value=admin \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS

# Add to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username admin \
  --group-name admin

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin \
  --password "YourSecurePassword123!" \
  --permanent
```

## 🧪 Testing

### Test 1: Cognito Hosted UI

```bash
# Get login URL
cd terraform
terraform output cognito_login_url

# Open in browser and test:
# 1. Sign up as new user
# 2. Login with existing user
# 3. Guest login (skip email)
```

### Test 2: API Authentication

```bash
# Get access token after login
ACCESS_TOKEN="<token-from-cookie>"

# Test authenticated request
curl -X GET "https://vkp-consulting.fr/apiv2/internal/users" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Should return 200 for admin, 403 for user/guest
```

### Test 3: Lambda@Edge

```bash
# Test unauthenticated request (should redirect to login)
curl -i "https://vkp-consulting.fr/"

# Should return 302 redirect to Cognito login
```

### Test 4: Role-Based Access

```bash
# Login as admin
# Try accessing /apiv2/internal/users - Should work

# Login as regular user
# Try accessing /apiv2/internal/users - Should return 403

# Login as guest
# Try accessing /apiv2/internal/users - Should return 403
```

## 📊 Verification Checklist

- [ ] Cognito User Pool created
- [ ] User Pool Client configured
- [ ] Identity Pool created
- [ ] Three user groups exist (admin, user, guest)
- [ ] IAM roles created for each group
- [ ] Lambda triggers deployed and attached
- [ ] Lambda@Edge deployed to us-east-1
- [ ] API Gateway JWT authorizer configured
- [ ] Lambda API updated with auth middleware
- [ ] Callback page accessible
- [ ] Logout page accessible
- [ ] Admin user created
- [ ] Can sign up new user
- [ ] Can login with existing user
- [ ] Can create guest user
- [ ] Admin can access /internal/* endpoints
- [ ] Users/guests cannot access /internal/* endpoints
- [ ] JWT tokens stored in cookies
- [ ] Logout clears cookies

## 🔧 Troubleshooting

### Issue: Lambda triggers not firing

**Solution**:
```bash
# Check Lambda permissions
aws lambda get-policy --function-name vkp-cognito-pre-signup

# Verify Cognito trigger configuration
aws cognito-idp describe-user-pool --user-pool-id <pool-id>
```

### Issue: JWT verification fails

**Solution**:
```bash
# Verify JWKS endpoint is accessible
curl https://cognito-idp.eu-north-1.amazonaws.com/<pool-id>/.well-known/jwks.json

# Check Lambda environment variables
aws lambda get-function-configuration --function-name vkp-api2
```

### Issue: Lambda@Edge not intercepting requests

**Solution**:
```bash
# Verify Lambda@Edge association
aws cloudfront get-distribution-config --id EJWBLACWDMFAZ

# Check Lambda@Edge logs in us-east-1
aws logs tail /aws/lambda/us-east-1.vkp-edge-auth --region us-east-1 --follow
```

### Issue: CORS errors

**Solution**:
- Ensure callback URL is in Cognito allowed callbacks
- Check API Gateway CORS configuration
- Verify Lambda CORS headers

## 📝 Post-Deployment Tasks

1. **Monitor CloudWatch Logs**
   ```bash
   # Lambda API logs
   aws logs tail /aws/lambda/vkp-api2 --follow
   
   # Lambda triggers logs
   aws logs tail /aws/lambda/vkp-cognito-pre-signup --follow
   ```

2. **Set up CloudWatch Alarms**
   - Authentication failures
   - Lambda errors
   - API Gateway 4xx/5xx errors

3. **Document Admin Procedures**
   - How to create new admin users
   - How to reset user passwords
   - How to remove users

4. **Update API Documentation**
   - Add authentication section
   - Document JWT token usage
   - Explain role-based access

## 🎯 Next Steps (Phase 9-10)

- [ ] Comprehensive end-to-end testing
- [ ] Load testing
- [ ] Security audit
- [ ] Documentation updates
- [ ] User training materials
- [ ] Monitoring and alerting setup

## 📞 Support

For issues or questions:
- Check CloudWatch Logs
- Review Terraform state
- Consult AWS Cognito documentation
- Check Lambda function logs

---

**Deployment Status**: Ready for deployment  
**Estimated Time**: 2-3 hours  
**Risk Level**: Medium (new authentication system)  
**Rollback Plan**: Terraform destroy Cognito resources, revert Lambda code

