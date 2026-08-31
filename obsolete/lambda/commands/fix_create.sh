#!/usr/bin/env bash
set -euo pipefail

DIST_ID="EJWBLACWDMFAZ"


# ====== FILL THIS ONE ======
# ===========================

AWS_REGION="eu-north-1"
API_ID="jgf7bin67j"
FUNC_NAME="vkp-simple-service"

echo "== Resolve Lambda ARN =="
LAMBDA_ARN=$(aws lambda get-function --region "$AWS_REGION" --function-name "$FUNC_NAME" \
  --query 'Configuration.FunctionArn' --output text)
echo "LAMBDA_ARN=$LAMBDA_ARN"

echo "== Ensure HTTP API integration to Lambda =="
INTEGRATION_ID=$(aws apigatewayv2 get-integrations --region "$AWS_REGION" --api-id "$API_ID" \
  --query 'Items[?IntegrationType==`AWS_PROXY` && contains(IntegrationUri, `lambda`) == `true`].IntegrationId' --output text | awk '{print $1}')
if [[ -z "${INTEGRATION_ID:-}" || "$INTEGRATION_ID" == "None" ]]; then
  INTEGRATION_ID=$(aws apigatewayv2 create-integration --region "$AWS_REGION" --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "$LAMBDA_ARN" \
    --payload-format-version 2.0 \
    --integration-method POST \
    --query IntegrationId --output text)
fi
echo "INTEGRATION_ID=$INTEGRATION_ID"

echo "== Ensure routes ANY /api and ANY /api/{proxy+} =="
have_api_route=$(aws apigatewayv2 get-routes --region "$AWS_REGION" --api-id "$API_ID" \
  --query 'Items[?RouteKey==`ANY /api`].RouteId' --output text || true)
if [[ -z "$have_api_route" || "$have_api_route" == "None" ]]; then
  aws apigatewayv2 create-route --region "$AWS_REGION" --api-id "$API_ID" \
    --route-key "ANY /api" \
    --target "integrations/$INTEGRATION_ID" >/dev/null
fi

have_proxy_route=$(aws apigatewayv2 get-routes --region "$AWS_REGION" --api-id "$API_ID" \
  --query 'Items[?RouteKey==`ANY /api/{proxy+}`].RouteId' --output text || true)
if [[ -z "$have_proxy_route" || "$have_proxy_route" == "None" ]]; then
  aws apigatewayv2 create-route --region "$AWS_REGION" --api-id "$API_ID" \
    --route-key "ANY /api/{proxy+}" \
    --target "integrations/$INTEGRATION_ID" >/dev/null
fi

echo "== Ensure \$default stage with auto-deploy =="
# If $default exists this will error; we ignore it.
aws apigatewayv2 create-stage --region "$AWS_REGION" --api-id "$API_ID" \
  --stage-name '$default' --auto-deploy >/dev/null 2>&1 || true

echo "== Allow API Gateway jgf7bin67j to invoke the Lambda =="
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
# Add a fresh permission statement (unique Sid via timestamp)
aws lambda add-permission --region "$AWS_REGION" \
  --function-name "$FUNC_NAME" \
  --action lambda:InvokeFunction \
  --statement-id "apigw-invoke-$(date +%s)" \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT_ID}:${API_ID}/*/*/api*" >/dev/null

echo "== Update CloudFront: route /api/* to this API over HTTPS =="
API_DOMAIN="${API_ID}.execute-api.${AWS_REGION}.amazonaws.com"
ORIGIN_ID="apigw-origin-${AWS_REGION}"
CACHE_POLICY_CACHING_DISABLED="4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
ORIGIN_REQ_ALL_VIEWER_EXCEPT_HOST="b689b0a8-53d0-40ab-baf2-68738e2966ac"

aws cloudfront get-distribution-config --id "$DIST_ID" > /tmp/cf.json
ETAG=$(python3 - <<'PY'
import json; print(json.load(open("/tmp/cf.json"))["ETag"])
PY
)

python3 - <<PY
import json

with open("/tmp/cf.json") as f:
    data = json.load(f)
cfg = data["DistributionConfig"]

API_DOMAIN = "${API_DOMAIN}"
ORIGIN_ID  = "${ORIGIN_ID}"
CACHE_POLICY = "${CACHE_POLICY_CACHING_DISABLED}"
ORIGIN_REQ_POLICY = "${ORIGIN_REQ_ALL_VIEWER_EXCEPT_HOST}"

def ensure_assoc_blocks(beh):
    beh.setdefault("FieldLevelEncryptionId", "")
    beh.setdefault("LambdaFunctionAssociations", {"Quantity": 0, "Items": []})
    beh.setdefault("FunctionAssociations", {"Quantity": 0, "Items": []})
    return beh

# Ensure containers
cfg.setdefault("Origins", {"Quantity":0, "Items":[]})
cfg["Origins"].setdefault("Items", [])
cfg.setdefault("CacheBehaviors", {"Quantity":0, "Items":[]})
cfg["CacheBehaviors"].setdefault("Items", [])

# Default behavior must have assoc blocks and HTTPS redirect
if "DefaultCacheBehavior" in cfg and cfg["DefaultCacheBehavior"]:
    dcb = cfg["DefaultCacheBehavior"]
    ensure_assoc_blocks(dcb)
    dcb["ViewerProtocolPolicy"] = "redirect-to-https"
    cfg["DefaultCacheBehavior"] = dcb

# Upsert API origin (HTTPS-only, include required fields)
new_origin = {
    "Id": ORIGIN_ID,
    "DomainName": API_DOMAIN,
    "OriginPath": "",  # $default stage -> empty path
    "CustomHeaders": { "Quantity": 0, "Items": [] },
    "CustomOriginConfig": {
        "OriginProtocolPolicy": "https-only",
        "HTTPPort": 80,
        "HTTPSPort": 443,
        "OriginSslProtocols": { "Quantity": 1, "Items": ["TLSv1.2"] },
        "OriginReadTimeout": 30,
        "OriginKeepaliveTimeout": 5
    }
}
orig = cfg["Origins"]["Items"]
for i,o in enumerate(list(orig)):
    if o.get("Id")==ORIGIN_ID:
        coc = o.get("CustomOriginConfig") or {}
        new_origin["CustomOriginConfig"]["OriginReadTimeout"] = int(coc.get("OriginReadTimeout", 30))
        new_origin["CustomOriginConfig"]["OriginKeepaliveTimeout"] = int(coc.get("OriginKeepaliveTimeout", 5))
        if not o.get("CustomHeaders"): o["CustomHeaders"]={"Quantity":0,"Items":[]}
        orig[i]=new_origin
        break
else:
    orig.append(new_origin)
cfg["Origins"]["Quantity"]=len(orig)

# Upsert /api/* behavior (no caching, HTTPS redirect, assoc blocks)
items = [b for b in (cfg["CacheBehaviors"]["Items"] or []) if b.get("PathPattern")!="/api/*"]
new_beh = {
    "PathPattern": "/api/*",
    "TargetOriginId": ORIGIN_ID,
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
        "Quantity": 7,
        "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
        "CachedMethods": {"Quantity": 3, "Items": ["GET","HEAD","OPTIONS"]}
    },
    "Compress": True,
    "CachePolicyId": CACHE_POLICY,
    "OriginRequestPolicyId": ORIGIN_REQ_POLICY,
    "SmoothStreaming": False
}
items.append(ensure_assoc_blocks(new_beh))
cfg["CacheBehaviors"]["Items"]=items
cfg["CacheBehaviors"]["Quantity"]=len(items)

with open("/tmp/cf.step3.json","w") as f:
    json.dump(cfg,f)
PY

aws cloudfront update-distribution \
  --id "$DIST_ID" \
  --if-match "$ETAG" \
  --distribution-config file:///tmp/cf.step3.json >/dev/null

echo "== Done. Wait for CloudFront to deploy, then test =="
echo "curl -i https://vkp-consulting.fr/api/"
