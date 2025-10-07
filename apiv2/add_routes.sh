#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="eu-north-1"
API_ID="wmrksdxxml"
FUNC_NAME="vkp-api2-service"

echo "== Resolve Lambda ARN =="
LAMBDA_ARN=$(aws lambda get-function --region "$AWS_REGION" --function-name "$FUNC_NAME" \
  --query 'Configuration.FunctionArn' --output text)
echo "LAMBDA_ARN=$LAMBDA_ARN"

echo "== Create Lambda integration for this API (payload v2.0) =="
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --region "$AWS_REGION" \
  --api-id "$API_ID" \
  --integration-type AWS_PROXY \
  --integration-uri "$LAMBDA_ARN" \
  --integration-method POST \
  --payload-format-version 2.0 \
  --query IntegrationId --output text)
echo "INTEGRATION_ID=$INTEGRATION_ID"

echo "== Create routes: ANY /apiv2 and ANY /apiv2/{proxy+} =="
aws apigatewayv2 create-route --region "$AWS_REGION" --api-id "$API_ID" \
  --route-key "ANY /apiv2" --target "integrations/$INTEGRATION_ID" >/dev/null

aws apigatewayv2 create-route --region "$AWS_REGION" --api-id "$API_ID" \
  --route-key "ANY /apiv2/{proxy+}" --target "integrations/$INTEGRATION_ID" >/dev/null

echo "== Ensure stage exists and auto-deploys =="
# Use $default (recommended). If it already exists, this will no-op.
STAGE_NAME='$default'
EXISTS=$(aws apigatewayv2 get-stages --region "$AWS_REGION" --api-id "$API_ID" \
  --query "length(Items[?StageName=='$STAGE_NAME'])" --output text)
if [ "$EXISTS" = "0" ]; then
  aws apigatewayv2 create-stage --region "$AWS_REGION" --api-id "$API_ID" \
    --stage-name "$STAGE_NAME" --auto-deploy >/dev/null
fi

echo "== Permit this API to invoke the Lambda on /apiv2* =="
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws lambda add-permission \
  --region "$AWS_REGION" \
  --function-name "$FUNC_NAME" \
  --action lambda:InvokeFunction \
  --statement-id "apigw-apiv2-$(date +%s)" \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT_ID}:${API_ID}/*/*/apiv2*" >/dev/null

echo "== Done =="
API_ENDPOINT=$(aws apigatewayv2 get-api --region "$AWS_REGION" --api-id "$API_ID" --query 'ApiEndpoint' --output text)
echo "Direct URL:  ${API_ENDPOINT}/apiv2"
echo "Proxy URL:   ${API_ENDPOINT}/apiv2/anything"
