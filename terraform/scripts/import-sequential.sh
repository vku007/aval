#!/bin/bash
# Sequential import of existing AWS resources (avoids state lock issues)

set -euo pipefail

cd "$(dirname "$0")/.."

echo "🔍 Sequential import of AWS resources..."
echo "⚠️  This will import resources one at a time to avoid lock conflicts"
echo

# S3 Buckets (most important - avoid duplicates!)
echo "📦 Importing S3 buckets..."
terraform import -input=false 'module.s3_static_site.aws_s3_bucket.main' vkp-consulting.fr 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

terraform import -input=false 'module.s3_api_data.aws_s3_bucket.main' data-1-088455116440 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

terraform import -input=false 'module.s3_cloudfront_logs.aws_s3_bucket.main' vkp-cloudfront-logs 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

# Lambda Functions
echo "⚡ Importing Lambda functions..."
terraform import -input=false 'module.lambda_api2.aws_lambda_function.main' vkp-api2-service 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

terraform import -input=false 'module.lambda_simple.aws_lambda_function.main' vkp-simple-service 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

# IAM Roles
echo "👤 Importing IAM roles..."
terraform import -input=false 'module.lambda_api2.aws_iam_role.main' vkp-api2-service-role 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

terraform import -input=false 'module.lambda_simple.aws_iam_role.main' vkp-simple-service-role 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

# CloudFront
echo "☁️  Importing CloudFront..."
terraform import -input=false 'module.cloudfront.aws_cloudfront_origin_access_control.main' E3QY4UMB9YVA18 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

terraform import -input=false 'module.cloudfront.aws_cloudfront_distribution.main' EJWBLACWDMFAZ 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 2

# Route53 DNS Records
echo "🌍 Importing Route53 records..."
terraform import -input=false 'module.route53.aws_route53_record.root_a' Z094077718N53LUC7MTBL_vkp-consulting.fr_A 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

terraform import -input=false 'module.route53.aws_route53_record.root_aaaa' Z094077718N53LUC7MTBL_vkp-consulting.fr_AAAA 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

terraform import -input=false 'module.route53.aws_route53_record.www_a' Z094077718N53LUC7MTBL_www.vkp-consulting.fr_A 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

terraform import -input=false 'module.route53.aws_route53_record.www_aaaa' Z094077718N53LUC7MTBL_www.vkp-consulting.fr_AAAA 2>&1 | grep -E "(Import successful|already managed|Error:)" || true

echo
echo "✅ Sequential import complete!"
echo
echo "Run 'terraform plan' to see remaining resources to be created"

