# Terraform Environment Variables Fix

## Issue
After deploying the Lambda function with Terraform, the Cognito authentication environment variables (USER_POOL_ID, REGION, CLIENT_ID) were being removed. They had to be manually added back using AWS CLI after each deployment.

## Root Cause
The Terraform configuration for `module.lambda_api2` in `terraform/main.tf` only included the base environment variables and didn't include the Cognito-specific ones.

## Solution
Updated `terraform/main.tf` to conditionally add Cognito environment variables when `var.enable_cognito_auth` is true.

### Changes Made

**File**: `terraform/main.tf`

**Before**:
```hcl
environment_variables = {
  APP_TAG        = "vkp-api"
  MAX_BODY_BYTES = tostring(var.max_body_bytes)
  JSON_PREFIX    = var.json_prefix
  ENVIRONMENT    = var.environment
  BUCKET_NAME    = var.api_data_bucket_name
  CORS_ORIGIN    = "https://${var.domain_name}"
}
```

**After**:
```hcl
environment_variables = merge(
  {
    APP_TAG        = "vkp-api"
    MAX_BODY_BYTES = tostring(var.max_body_bytes)
    JSON_PREFIX    = var.json_prefix
    ENVIRONMENT    = var.environment
    BUCKET_NAME    = var.api_data_bucket_name
    CORS_ORIGIN    = "https://${var.domain_name}"
  },
  var.enable_cognito_auth ? {
    USER_POOL_ID = module.cognito[0].user_pool_id
    REGION       = var.aws_region
    CLIENT_ID    = module.cognito[0].user_pool_client_id
  } : {}
)
```

## How It Works

1. The `merge()` function combines two maps:
   - Base environment variables (always present)
   - Cognito variables (only when `enable_cognito_auth = true`)

2. When Cognito is enabled:
   - `USER_POOL_ID` is pulled from `module.cognito[0].user_pool_id`
   - `REGION` uses `var.aws_region`
   - `CLIENT_ID` is pulled from `module.cognito[0].user_pool_client_id`

3. When Cognito is disabled:
   - The conditional returns an empty map `{}`
   - Only base variables are included

## Verification

```bash
# Check Lambda environment variables
aws lambda get-function-configuration \
  --function-name vkp-api2-service \
  --region eu-north-1 \
  | jq '.Environment.Variables'
```

**Expected Output**:
```json
{
  "APP_TAG": "vkp-api",
  "MAX_BODY_BYTES": "1048576",
  "CLIENT_ID": "77e2cmbthjul60ui7guh514u50",
  "JSON_PREFIX": "json/",
  "ENVIRONMENT": "prod",
  "USER_POOL_ID": "eu-north-1_OxGtXG08i",
  "BUCKET_NAME": "data-1-088455116440",
  "CORS_ORIGIN": "https://vkp-consulting.fr",
  "REGION": "eu-north-1"
}
```

## Benefits

✅ Environment variables persist across Terraform deployments
✅ No manual AWS CLI commands needed after deployment
✅ Cognito variables are conditionally included based on feature flag
✅ Single source of truth for Lambda configuration
✅ Infrastructure as Code best practices

## Deployment

```bash
# Build and deploy Lambda
cd apiv2
npm run build && npm run zip

# Apply Terraform changes
cd ../terraform
terraform apply -target=module.lambda_api2.aws_lambda_function.main

# Environment variables are automatically set!
```

## Related Files

- `terraform/main.tf` - Lambda module configuration
- `terraform/variables.tf` - Variable definitions (enable_cognito_auth)
- `terraform/modules/cognito/outputs.tf` - Cognito module outputs
- `apiv2/src/presentation/middleware/auth.ts` - Uses these environment variables

## Testing

After deployment, test the authentication:

```bash
# Get a valid idToken from Cognito
# Then test the API
curl -H "Authorization: Bearer <idToken>" \
  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me
```

Should return your user profile successfully!

---

**Date**: November 3, 2025
**Status**: ✅ Complete
**Impact**: All future Lambda deployments will include Cognito environment variables automatically
