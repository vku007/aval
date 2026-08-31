#!/bin/bash
# Import existing AWS resources into Terraform state

set -euo pipefail

cd "$(dirname "$0")/.."

echo "🔍 Importing existing AWS resources into Terraform..."
echo "⚠️  This will NOT modify any resources, only import them into state"
echo

read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

echo

# S3 Buckets
echo "📦 Importing S3 buckets..."
terraform import 'module.s3_static_site.aws_s3_bucket.main' vkp-consulting.fr || true
terraform import 'module.s3_api_data.aws_s3_bucket.main' data-1-088455116440 || true
terraform import 'module.s3_cloudfront_logs.aws_s3_bucket.main' vkp-cloudfront-logs || true

terraform import 'module.s3_static_site.aws_s3_bucket_public_access_block.main' vkp-consulting.fr || true
terraform import 'module.s3_api_data.aws_s3_bucket_public_access_block.main' data-1-088455116440 || true
terraform import 'module.s3_cloudfront_logs.aws_s3_bucket_public_access_block.main' vkp-cloudfront-logs || true

# Lambda Functions
echo "⚡ Importing Lambda functions..."
terraform import 'module.lambda_api2.aws_lambda_function.main' vkp-api2-service || true
terraform import 'module.lambda_simple.aws_lambda_function.main' vkp-simple-service || true

# CloudWatch Log Groups
echo "📊 Importing CloudWatch Log Groups..."
terraform import 'module.lambda_api2.aws_cloudwatch_log_group.main' /aws/lambda/vkp-api2-service || true
terraform import 'module.lambda_simple.aws_cloudwatch_log_group.main' /aws/lambda/vkp-simple-service || true
terraform import 'aws_cloudwatch_log_group.api_gateway' /aws/apigateway/vkp-http-api || true

# IAM Roles
echo "👤 Importing IAM roles..."
terraform import 'module.lambda_api2.aws_iam_role.main' vkp-api2-service-role || true
terraform import 'module.lambda_simple.aws_iam_role.main' vkp-simple-service-role || true

# IAM Role Policy Attachments
echo "📜 Importing IAM policy attachments..."
terraform import 'module.lambda_api2.aws_iam_role_policy_attachment.lambda_basic' \
  vkp-api2-service-role/arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole || true
terraform import 'module.lambda_simple.aws_iam_role_policy_attachment.lambda_basic' \
  vkp-simple-service-role/arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole || true

# IAM Inline Policies
echo "📝 Importing IAM inline policies..."
terraform import 'module.lambda_api2.aws_iam_role_policy.s3_access[0]' \
  vkp-api2-service-role:S3JsonAccess-data-1-088455116440 || true

# API Gateway
echo "🌐 Importing API Gateway..."
terraform import 'module.api_gateway.aws_apigatewayv2_api.main' wmrksdxxml || true
terraform import 'module.api_gateway.aws_apigatewayv2_stage.default' 'wmrksdxxml/$default' || true

# Note: Integrations and routes will need manual import with their IDs
# Get integration IDs: aws apigatewayv2 get-integrations --api-id wmrksdxxml --region eu-north-1
# Get route IDs: aws apigatewayv2 get-routes --api-id wmrksdxxml --region eu-north-1

echo "⚠️  API Gateway integrations and routes require manual import with their IDs"
echo "   Run these commands to get the IDs:"
echo "   aws apigatewayv2 get-integrations --api-id wmrksdxxml --region eu-north-1"
echo "   aws apigatewayv2 get-routes --api-id wmrksdxxml --region eu-north-1"
echo

# Lambda Permissions
echo "🔑 Importing Lambda permissions..."
terraform import 'module.lambda_api2.aws_lambda_permission.api_gateway[0]' \
  vkp-api2-service/AllowAPIGatewayInvoke || true
terraform import 'module.lambda_simple.aws_lambda_permission.api_gateway[0]' \
  vkp-simple-service/AllowAPIGatewayInvoke || true

# CloudFront
echo "☁️  Importing CloudFront distribution..."
terraform import 'module.cloudfront.aws_cloudfront_origin_access_control.main' E3QY4UMB9YVA18 || true
terraform import 'module.cloudfront.aws_cloudfront_distribution.main' EJWBLACWDMFAZ || true

# Route53
echo "🌍 Importing Route53 records..."
# Note: Route53 zone is imported via data source, only records need import
terraform import 'module.route53.aws_route53_record.root_a' \
  Z094077718N53LUC7MTBL_vkp-consulting.fr_A || true
terraform import 'module.route53.aws_route53_record.root_aaaa' \
  Z094077718N53LUC7MTBL_vkp-consulting.fr_AAAA || true
terraform import 'module.route53.aws_route53_record.www_a' \
  Z094077718N53LUC7MTBL_www.vkp-consulting.fr_A || true
terraform import 'module.route53.aws_route53_record.www_aaaa' \
  Z094077718N53LUC7MTBL_www.vkp-consulting.fr_AAAA || true

echo
echo "✅ Import complete!"
echo
echo "Next steps:"
echo "  1. Run: terraform plan"
echo "  2. Review the plan carefully"
echo "  3. If there are changes, review and adjust the Terraform config"
echo "  4. Goal: terraform plan should show 0 changes"

