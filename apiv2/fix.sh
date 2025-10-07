#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="eu-north-1"
API_ID="wmrksdxxml"
FUNC_NAME="vkp-api2-service"

echo "== Resolve Lambda ARN =="
LAMBDA_ARN=$(aws lambda get-function --region "$AWS_REGION" --function-name "$FUNC_NAME" \
  --query 'Configuration.FunctionArn' --output text)
echo "LAMBDA_ARN=$LAMBDA_ARN"

echo "== Find or create Lambda integration =="
# Try to find an existing AWS_PROXY integration to this Lambda
INTEGRATION_ID=$(aws apigatewayv2 get-integrations --region "$AWS_REGION" --api-id "$API_ID" \
  --query "Items[?IntegrationType=='AWS_PROXY' && contains(IntegrationUri, \`$FUNC_NAME\`)].IntegrationId" \
  --output text | awk '{print $1}')
if [[ -z "${INTEGRATION_ID:-}" || "$INTEGRATION_ID" == "None" ]]; then
  INTEGRATION_ID=$(aws apigatewayv2 create-integration \
    --region "$AWS_REGION" \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "$LAMBDA_ARN" \
    --integration-method POST \
    --payload-format-version 2.0 \
    --query IntegrationId --output text)
  echo "Created INTEGRATION_ID=$INTEGRATION_ID"
else
  echo "Using existing INTEGRATION_ID=$INTEGRATION_ID"
fi

echo "== Create/repair routes =="
have_r1=$(aws apigatewayv2 get-routes --region "$AWS_REGION" --api-id "$API_ID" \
  --query "Items[?RouteKey=='ANY /apiv2'].RouteId" --output text || true)
if [[ -z "$have_r1" || "$have_r1" == "None" ]]; then
  aws apigatewayv2 create-route --region "$AWS_REGION" --api-id "$API_ID" \
    --route-key "ANY /apiv2" --target "integrations/$INTEGRATION_ID" >/dev/null
else
  # ensure route targets our integration
  RID=$(aws apigatewayv2 get-routes --region "$AWS_REGION" --api-id "$API_ID" \
    --query "Items[?RouteKey=='ANY /apiv2'].RouteId" --output text)
  aws apigatewayv2 update-route --region "$AWS_REGION" --api-id "$API_ID" \
    --route-id "$RID" --target "integrations/$INTEGRATION_ID" >/dev/null
fi

have_r2=$(aws apigatewayv2 get-routes --region "$AWS_REGION" --api-id "$API_ID" \
  --query "Items[?RouteKey=='ANY /apiv2/{proxy+}'].RouteId" --output text || true)
if [[ -z "$have_r2" || "$have_r2" == "None" ]]; then
  aws apigatewayv2 create-route --region "$AWS_REGION" --api-id "$API_ID" \
    --route-key "ANY /apiv2/{proxy+}" --target "integrations/$INTEGRATION_ID" >/dev/null
else
  RID=$(aws apigatewayv2 get-routes --region "$AWS_REGION" --api-id "$API_ID" \
    --query "Items[?RouteKey=='ANY /apiv2/{proxy+}'].RouteId" --output text)
  aws apigatewayv2 update-route --region "$AWS_REGION" --api-id "$API_ID" \
    --route-id "$RID" --target "integrations/$INTEGRATION_ID" >/dev/null
fi

echo "== Ensure stage exists and auto-deploy is ON =="
STAGE_NAME='$default'   # literal; do not let shell expand the $
exists=$(aws apigatewayv2 get-stages --region "$AWS_REGION" --api-id "$API_ID" \
  --query "length(Items[?StageName=='$STAGE_NAME'])" --output text)
if [[ "$exists" = "0" ]]; then
  aws apigatewayv2 create-stage --region "$AWS_REGION" --api-id "$API_ID" \
    --stage-name "$STAGE_NAME" --auto-deploy >/dev/null
else
  # make sure auto-deploy is on
  SID=$(aws apigatewayv2 get-stages --region "$AWS_REGION" --api-id "$API_ID" \
    --query "Items[?StageName=='$STAGE_NAME'].StageName" --output text)
  aws apigatewayv2 update-stage --region "$AWS_REGION" --api-id "$API_ID" \
    --stage-name "$SID" --auto-deploy >/dev/null
fi

echo "== Add Lambda permission for this API and path (/apiv2*) =="
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws lambda add-permission \
  --region "$AWS_REGION" \
  --function-name "$FUNC_NAME" \
  --action lambda:InvokeFunction \
  --statement-id "apigw-apiv2-$(date +%s)" \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT_ID}:${API_ID}/*/*/apiv2*" >/dev/null

echo "== Done. Test directly =="
API_ENDPOINT=$(aws apigatewayv2 get-api --region "$AWS_REGION" --api-id "$API_ID" --query 'ApiEndpoint' --output text)
echo "GET   : curl -i ${API_ENDPOINT}/apiv2"
echo "POST  : curl -i ${API_ENDPOINT}/apiv2/test -H 'content-type: application/json' --data '{\"hello\":\"VKP\"}'"
