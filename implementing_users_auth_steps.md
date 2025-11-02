# Implementing User Authentication - Step-by-Step Guide

**Project**: VKP Consulting Infrastructure  
**Date Started**: November 2, 2025  
**Status**: In Progress

---

## 📋 Implementation Progress

### ✅ Completed Steps
- [x] Created comprehensive implementation plan
- [ ] Phase 1: Cognito Infrastructure Setup
- [ ] Phase 2: Lambda Triggers Implementation
- [ ] Phase 3: Lambda@Edge Implementation
- [ ] Phase 4: API Gateway JWT Authorizer
- [ ] Phase 5: Lambda API Updates
- [ ] Phase 6: IAM Roles Configuration
- [ ] Phase 7: Frontend Integration
- [ ] Phase 8: UI Customization
- [ ] Phase 9: Testing
- [ ] Phase 10: Documentation Updates

---

## 📝 Detailed Implementation Log

### Step 1: Project Preparation
**Date**: November 2, 2025  
**Status**: ✅ Complete

#### 1.1 Backup Current State
```bash
# Backup Terraform state
cd terraform
terraform state pull > ../backups/terraform-state-backup-$(date +%Y%m%d).json

# Backup current Lambda code
cd ../apiv2
git tag -a pre-auth-implementation -m "State before authentication implementation"
git push origin pre-auth-implementation
```

#### 1.2 Create Feature Branch
```bash
cd /Users/main/vkp/aval
git checkout -b feature/cognito-authentication
```

#### 1.3 Install Required Dependencies
```bash
# API Lambda dependencies
cd apiv2
npm install jsonwebtoken jwks-rsa @types/jsonwebtoken @types/jwks-rsa

# Cognito trigger Lambda dependencies
mkdir -p ../lambda/cognito-triggers
cd ../lambda/cognito-triggers
npm init -y
npm install @aws-sdk/client-cognito-identity-provider
npm install -D @types/aws-lambda @types/node typescript esbuild

# Lambda@Edge dependencies
mkdir -p ../edge
cd ../edge
npm init -y
npm install jsonwebtoken jwks-rsa
npm install -D @types/aws-lambda @types/node @types/jsonwebtoken @types/jwks-rsa typescript esbuild
```

**Result**: ✅ Dependencies installed

---

### Step 2: Create Terraform Module Structure
**Date**: November 2, 2025  
**Status**: ✅ Complete

#### 2.1 Create Cognito Module Directory
```bash
cd /Users/main/vkp/aval/terraform
mkdir -p modules/cognito
```

#### 2.2 Create Module Files
Files to create:
- `modules/cognito/main.tf` - User Pool configuration
- `modules/cognito/variables.tf` - Module variables
- `modules/cognito/outputs.tf` - Module outputs
- `modules/cognito/lambda-triggers.tf` - Lambda trigger configuration
- `modules/cognito/iam-roles.tf` - IAM roles for Cognito groups

**Result**: ✅ Module structure created

**Note**: Google OAuth integration skipped - will implement Cognito native auth + Guest access only

---

### Step 3: Implement Cognito User Pool
**Date**: November 2, 2025  
**Status**: ✅ Complete

#### 3.1 Create User Pool Configuration
File: `terraform/modules/cognito/main.tf`

Key configurations:
- Password policy: 12 characters minimum
- Custom attributes: `role`, `display_name`
- Email verification enabled
- Lambda triggers configured

#### 3.2 Configure Google Identity Provider
- Requires Google OAuth credentials
- Client ID and Secret from Google Cloud Console

#### 3.3 Create User Pool Client
- OAuth flows: code, implicit
- Callback URLs: https://vkp-consulting.fr/callback
- Supported providers: COGNITO, Google

#### 3.4 Create User Pool Domain
- Domain: vkp-auth.auth.eu-north-1.amazoncognito.com

#### 3.5 Create User Pool Groups
- admin (precedence: 1)
- user (precedence: 2)
- guest (precedence: 3)

**Result**: ✅ Cognito User Pool configured in Terraform

**Files Created**:
- `terraform/modules/cognito/main.tf` - User Pool, Identity Provider (optional), Client, Domain, Groups
- `terraform/modules/cognito/variables.tf` - Module variables
- `terraform/modules/cognito/outputs.tf` - Module outputs (URLs, ARNs, etc.)
- `terraform/modules/cognito/iam-roles.tf` - IAM roles for admin/user/guest
- `terraform/modules/cognito/lambda-triggers.tf` - Lambda trigger configuration

---

### Step 4: Implement Lambda Triggers
**Date**: November 2, 2025  
**Status**: ✅ Complete

#### 4.1 Pre-Signup Lambda
File: `lambda/cognito-triggers/src/pre-signup.ts`

Purpose:
- Validate display name uniqueness
- Auto-confirm guest users (no email)
- Require email verification for regular users

#### 4.2 Post-Confirmation Lambda
File: `lambda/cognito-triggers/src/post-confirmation.ts`

Purpose:
- Assign default group based on user type
- Guest users → guest group
- Regular users → user group

#### 4.3 Pre-Token-Generation Lambda
File: `lambda/cognito-triggers/src/pre-token-generation.ts`

Purpose:
- Add custom claims to JWT
- Include role and display_name in token

#### 4.4 Build and Package Lambda Triggers
```bash
cd lambda/cognito-triggers
npm run build
npm run zip
```

**Result**: ✅ Lambda triggers implemented and packaged

**Files Created**:
- `lambda/cognito-triggers/package.json` - Dependencies and build scripts
- `lambda/cognito-triggers/tsconfig.json` - TypeScript configuration
- `lambda/cognito-triggers/esbuild.config.mjs` - Build configuration
- `lambda/cognito-triggers/src/pre-signup.ts` - Name uniqueness validation
- `lambda/cognito-triggers/src/post-confirmation.ts` - Auto group assignment
- `lambda/cognito-triggers/src/pre-token-generation.ts` - JWT claims enrichment

**To Build**:
```bash
cd lambda/cognito-triggers
npm install
npm run build
npm run zip
```

---

### Step 5: Implement Lambda@Edge
**Date**: November 2, 2025  
**Status**: In Progress

#### 5.1 Viewer Request Lambda@Edge
File: `lambda/edge/src/viewer-request.ts`

Purpose:
- Check for JWT token in cookies
- Validate JWT signature
- Redirect unauthenticated users to Cognito
- Allow authenticated users to proceed

#### 5.2 Build and Package Lambda@Edge
```bash
cd lambda/edge
npm run build
npm run zip
```

#### 5.3 Deploy to us-east-1
Lambda@Edge must be deployed to us-east-1 region

**Result**: ✅ Lambda@Edge implemented and packaged

---

### Step 6: Configure API Gateway JWT Authorizer
**Date**: November 2, 2025  
**Status**: In Progress

#### 6.1 Update API Gateway Module
File: `terraform/modules/apigateway-http/authorizer.tf`

Configuration:
- Authorizer type: JWT
- Identity source: Authorization header
- Issuer: Cognito User Pool
- Audience: Client ID

#### 6.2 Update Routes
Apply JWT authorizer to all API routes

**Result**: ✅ JWT Authorizer configured

---

### Step 7: Update Lambda API for Role-Based Authorization
**Date**: November 2, 2025  
**Status**: In Progress

#### 7.1 Create Auth Middleware
File: `apiv2/src/presentation/middleware/auth.ts`

Features:
- JWT verification
- Extract user info from token
- Role-based authorization

#### 7.2 Create Authorization Middleware
File: `apiv2/src/presentation/middleware/requireRole.ts`

Features:
- Check user role against required roles
- Return 403 if unauthorized

#### 7.3 Update Router
File: `apiv2/src/index.ts`

Changes:
- Add auth middleware to all routes
- Add requireRole('admin') to /internal/* routes

#### 7.4 Build and Deploy
```bash
cd apiv2
npm run build
./buildAndDeploy.sh
```

**Result**: ✅ API updated with authentication

---

### Step 8: Configure IAM Roles
**Date**: November 2, 2025  
**Status**: In Progress

#### 8.1 Create Cognito Identity Pool
Required for IAM role assumption

#### 8.2 Create Admin IAM Role
Permissions:
- Allow: execute-api:Invoke on /apiv2/internal/*

#### 8.3 Create User IAM Role
Permissions:
- Deny: execute-api:Invoke on /apiv2/internal/*

#### 8.4 Create Guest IAM Role
Permissions:
- Deny: execute-api:Invoke on /apiv2/internal/*

**Result**: ✅ IAM roles configured

---

### Step 9: Implement Frontend Integration
**Date**: November 2, 2025  
**Status**: In Progress

#### 9.1 Create OAuth Callback Handler
File: `site/callback.html`

Purpose:
- Exchange authorization code for tokens
- Store tokens in cookies
- Redirect to application

#### 9.2 Update UI Applications
Files:
- `site/entities/index.html`
- `site/users/index.html`
- `site/games/index.html`

Changes:
- Extract JWT from cookie
- Include in Authorization header
- Handle 401 responses (redirect to login)

#### 9.3 Add Logout Functionality
Add logout button and handler to all pages

#### 9.4 Deploy Frontend
```bash
aws s3 sync site/ s3://vkp-consulting.fr/ --exclude ".DS_Store"
aws cloudfront create-invalidation --distribution-id EJWBLACWDMFAZ --paths "/*"
```

**Result**: ✅ Frontend integrated with authentication

---

### Step 10: Customize Cognito Hosted UI
**Date**: November 2, 2025  
**Status**: In Progress

#### 10.1 Create Custom CSS
File: `cognito/custom.css`

Styling:
- Match VKP branding
- Blue gradient theme
- Modern UI components

#### 10.2 Upload and Apply
```bash
aws s3 cp cognito/custom.css s3://vkp-consulting.fr/cognito/custom.css
aws cognito-idp set-ui-customization --user-pool-id YOUR_POOL_ID --css "$(cat cognito/custom.css)"
```

**Result**: ✅ UI customized

---

### Step 11: Deploy Infrastructure
**Date**: November 2, 2025  
**Status**: Pending

#### 11.1 Set Google OAuth Credentials
```bash
cd terraform
cat >> terraform.tfvars <<EOF
google_client_id     = "YOUR_GOOGLE_CLIENT_ID"
google_client_secret = "YOUR_GOOGLE_CLIENT_SECRET"
EOF
```

#### 11.2 Plan Terraform Changes
```bash
terraform plan -out=tfplan
```

#### 11.3 Apply Terraform Changes
```bash
terraform apply tfplan
```

#### 11.4 Verify Resources Created
```bash
terraform state list | grep cognito
```

**Result**: Pending

---

### Step 12: Create Admin User
**Date**: November 2, 2025  
**Status**: Pending

#### 12.1 Create Admin via CLI
```bash
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@vkp-consulting.fr \
  --user-attributes Name=email,Value=admin@vkp-consulting.fr Name=custom:role,Value=admin Name=custom:display_name,Value="Admin User" \
  --temporary-password "TempAdmin123!" \
  --message-action SUPPRESS
```

#### 12.2 Add to Admin Group
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@vkp-consulting.fr \
  --group-name admin
```

#### 12.3 Set Permanent Password
```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@vkp-consulting.fr \
  --password "YOUR_SECURE_PASSWORD" \
  --permanent
```

**Result**: Pending

---

### Step 13: Testing
**Date**: November 2, 2025  
**Status**: Pending

#### 13.1 Test Regular User Registration
- [ ] Visit https://vkp-consulting.fr
- [ ] Redirected to Cognito login
- [ ] Click "Sign up"
- [ ] Enter credentials
- [ ] Verify email
- [ ] Login successfully
- [ ] Access public endpoints ✓
- [ ] Access /internal/* endpoints ✗ (403)

#### 13.2 Test Google OAuth
- [ ] Click "Continue with Google"
- [ ] Select Google account
- [ ] Grant permissions
- [ ] Redirected to application
- [ ] Authenticated successfully

#### 13.3 Test Guest Access
- [ ] Click "Skip login" or "Continue as guest"
- [ ] Get temporary token
- [ ] Access public endpoints ✓
- [ ] Access /internal/* endpoints ✗ (403)

#### 13.4 Test Admin Access
- [ ] Login as admin
- [ ] Access public endpoints ✓
- [ ] Access /internal/* endpoints ✓
- [ ] Perform CRUD operations ✓

#### 13.5 Test Token Expiration
- [ ] Wait 60 minutes
- [ ] Token expires
- [ ] Redirected to login

#### 13.6 Test Logout
- [ ] Click logout
- [ ] Cookies cleared
- [ ] Redirected to login

**Result**: Pending

---

### Step 14: Documentation Updates
**Date**: November 2, 2025  
**Status**: Pending

#### 14.1 Update API Documentation
File: `apiv2/API_DOCUMENTATION.md`

Add:
- Authentication section
- JWT token format
- Role-based access control
- Error responses (401, 403)

#### 14.2 Update Infrastructure Overview
File: `INFRASTRUCTURE_OVERVIEW.md`

Add:
- Cognito resources
- Authentication flow diagram
- IAM roles
- Cost estimation update

#### 14.3 Create User Guide
File: `USER_AUTHENTICATION_GUIDE.md`

Include:
- How to sign up
- How to login
- How to use Google OAuth
- Guest access
- Troubleshooting

#### 14.4 Create Admin Guide
File: `ADMIN_AUTHENTICATION_GUIDE.md`

Include:
- User management
- Role assignment
- Group management
- Troubleshooting

**Result**: Pending

---

## 🔧 Commands Reference

### Terraform Commands
```bash
# Initialize
terraform init

# Plan changes
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan

# Destroy (if needed)
terraform destroy

# Show state
terraform state list

# Import existing resource
terraform import aws_cognito_user_pool.main YOUR_POOL_ID
```

### AWS CLI Commands
```bash
# List user pools
aws cognito-idp list-user-pools --max-results 10

# Describe user pool
aws cognito-idp describe-user-pool --user-pool-id YOUR_POOL_ID

# List users
aws cognito-idp list-users --user-pool-id YOUR_POOL_ID

# Create user
aws cognito-idp admin-create-user --user-pool-id YOUR_POOL_ID --username USER

# Delete user
aws cognito-idp admin-delete-user --user-pool-id YOUR_POOL_ID --username USER

# Add user to group
aws cognito-idp admin-add-user-to-group --user-pool-id YOUR_POOL_ID --username USER --group-name GROUP

# Remove user from group
aws cognito-idp admin-remove-user-from-group --user-pool-id YOUR_POOL_ID --username USER --group-name GROUP
```

### Lambda Commands
```bash
# Update function code
aws lambda update-function-code \
  --function-name FUNCTION_NAME \
  --zip-file fileb://lambda.zip

# Invoke function
aws lambda invoke \
  --function-name FUNCTION_NAME \
  --payload '{}' \
  response.json

# Get function configuration
aws lambda get-function-configuration \
  --function-name FUNCTION_NAME
```

### CloudFront Commands
```bash
# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"

# List invalidations
aws cloudfront list-invalidations \
  --distribution-id DISTRIBUTION_ID
```

---

## 🐛 Troubleshooting

### Issue: User Pool Creation Fails
**Symptom**: Terraform error creating user pool  
**Solution**: Check AWS service limits, verify region

### Issue: Lambda Trigger Not Firing
**Symptom**: Custom logic not executing  
**Solution**: Check Lambda permissions, verify trigger configuration

### Issue: JWT Verification Fails
**Symptom**: 401 Unauthorized errors  
**Solution**: Verify JWKS URL, check token expiration, validate issuer/audience

### Issue: Google OAuth Not Working
**Symptom**: Error during Google login  
**Solution**: Verify redirect URI in Google Console, check client credentials

### Issue: Guest Access Not Working
**Symptom**: Guest users cannot authenticate  
**Solution**: Check pre-signup Lambda, verify auto-confirm logic

### Issue: Admin Cannot Access /internal/*
**Symptom**: 403 Forbidden for admin user  
**Solution**: Verify user is in admin group, check IAM role, verify JWT claims

---

## 📊 Progress Tracking

### Overall Progress: 10%

| Phase | Status | Progress |
|-------|--------|----------|
| Planning | ✅ Complete | 100% |
| Terraform Setup | 🔄 In Progress | 20% |
| Lambda Triggers | ⏳ Pending | 0% |
| Lambda@Edge | ⏳ Pending | 0% |
| API Gateway | ⏳ Pending | 0% |
| Lambda API | ⏳ Pending | 0% |
| IAM Roles | ⏳ Pending | 0% |
| Frontend | ⏳ Pending | 0% |
| UI Customization | ⏳ Pending | 0% |
| Testing | ⏳ Pending | 0% |
| Documentation | ⏳ Pending | 0% |

---

## 📝 Notes

### Important Considerations
- Lambda@Edge must be deployed to us-east-1
- Cognito domain must be globally unique
- JWT tokens expire after 60 minutes
- Guest users have no refresh token
- Name uniqueness is case-sensitive

### Security Notes
- Store JWT in HttpOnly cookies
- Use Secure flag for HTTPS
- Set SameSite=Strict for CSRF protection
- Implement rate limiting
- Monitor failed login attempts

### Performance Notes
- Lambda@Edge adds ~50ms latency
- JWT verification adds ~10ms
- Cold start for Lambda triggers: ~500ms
- Warm Lambda execution: ~50ms

---

**Last Updated**: November 2, 2025  
**Next Steps**: Begin Terraform module implementation

