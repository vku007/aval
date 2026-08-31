#!/bin/bash
# Import the remaining resources that failed during terraform apply

set -euo pipefail

cd "$(dirname "$0")/.."

echo "🔍 Importing remaining existing AWS resources..."
echo

# CloudWatch Log Groups (already exist)
echo "📊 Importing CloudWatch Log Groups..."
terraform import -input=false 'module.lambda_api2.aws_cloudwatch_log_group.main' /aws/lambda/vkp-api2-service 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

terraform import -input=false 'module.lambda_simple.aws_cloudwatch_log_group.main' /aws/lambda/vkp-simple-service 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

terraform import -input=false 'aws_cloudwatch_log_group.api_gateway' /aws/apigateway/vkp-http-api 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

# API Gateway Stage
echo "🌐 Importing API Gateway Stage..."
terraform import -input=false 'module.api_gateway.aws_apigatewayv2_stage.default' 'wmrksdxxml/$default' 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
sleep 1

# Get route IDs first
echo "📋 Getting API Gateway route IDs..."
ROUTE_IDS=$(aws apigatewayv2 get-routes --api-id wmrksdxxml --region eu-north-1 --query 'Items[].{RouteKey:RouteKey,RouteId:RouteId}' --output json)

# Extract specific route IDs
API_ROOT_ID=$(echo "$ROUTE_IDS" | jq -r '.[] | select(.RouteKey=="ANY /api") | .RouteId')
API_PROXY_ID=$(echo "$ROUTE_IDS" | jq -r '.[] | select(.RouteKey=="ANY /api/{proxy+}") | .RouteId')
APIV2_ROOT_ID=$(echo "$ROUTE_IDS" | jq -r '.[] | select(.RouteKey=="ANY /apiv2") | .RouteId')
APIV2_PROXY_ID=$(echo "$ROUTE_IDS" | jq -r '.[] | select(.RouteKey=="ANY /apiv2/{proxy+}") | .RouteId')

echo "   Found route IDs:"
echo "   - ANY /api: $API_ROOT_ID"
echo "   - ANY /api/{proxy+}: $API_PROXY_ID"
echo "   - ANY /apiv2: $APIV2_ROOT_ID"
echo "   - ANY /apiv2/{proxy+}: $APIV2_PROXY_ID"
echo

# Import API Gateway Routes
echo "🛣️  Importing API Gateway routes..."
if [ -n "$API_ROOT_ID" ]; then
  terraform import -input=false "module.api_gateway.aws_apigatewayv2_route.routes[\"api_root\"]" "wmrksdxxml/$API_ROOT_ID" 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
  sleep 1
fi

if [ -n "$API_PROXY_ID" ]; then
  terraform import -input=false "module.api_gateway.aws_apigatewayv2_route.routes[\"api_proxy\"]" "wmrksdxxml/$API_PROXY_ID" 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
  sleep 1
fi

if [ -n "$APIV2_ROOT_ID" ]; then
  terraform import -input=false "module.api_gateway.aws_apigatewayv2_route.routes[\"apiv2_root\"]" "wmrksdxxml/$APIV2_ROOT_ID" 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
  sleep 1
fi

if [ -n "$APIV2_PROXY_ID" ]; then
  terraform import -input=false "module.api_gateway.aws_apigatewayv2_route.routes[\"apiv2_proxy\"]" "wmrksdxxml/$APIV2_PROXY_ID" 2>&1 | grep -E "(Import successful|already managed|Error:)" || true
  sleep 1
fi

echo
echo "✅ Import of remaining resources complete!"
echo
echo "Run 'terraform plan' to verify all resources are now managed"

