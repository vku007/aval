#!/usr/bin/env bash
set -euo pipefail

# =========[ FILL THESE ]=========
AWS_REGION="eu-north-1"                   # Region for Lambda & API Gateway
LAMBDA_ARN="arn:aws:lambda:eu-north-1:088455116440:function:vkp-simple-service"
DIST_ID="EJWBLACWDMFAZ"                    # CloudFront distribution ID for vkp-consulting.fr
SITE_HOST_APEX="https://vkp-consulting.fr"
SITE_HOST_WWW="https://www.vkp-consulting.fr"

API_NAME="vkp-http-api-3"
STAGE="\$default"                            # "prod" or "$default"
# If STAGE="$default", set ORIGIN_PATH="" below.
# With "prod", CloudFront origin path must be "/prod".
# =================================

ORIGIN_PATH="/${STAGE}"
if [[ "$STAGE" == "\$default" || "$STAGE" == "\$DEFAULT" || "$STAGE" == "default" ]]; then
  ORIGIN_PATH=""
fi

# Managed CloudFront policy IDs
CACHE_POLICY_CACHING_DISABLED="4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
ORIGIN_REQ_ALL_VIEWER_EXCEPT_HOST="b689b0a8-53d0-40ab-baf2-68738e2966ac"


echo "=== 1) Create HTTP API with CORS ==="
API_ID=$(aws apigatewayv2 create-api \
  --region "$AWS_REGION" \
  --name "$API_NAME" \
  --protocol-type HTTP \
  --cors-configuration "AllowOrigins=['$SITE_HOST_APEX','$SITE_HOST_WWW'],AllowMethods=['GET','POST','PUT','PATCH','DELETE','OPTIONS'],AllowHeaders=['content-type','authorization']" \
  --query ApiId --output text)
echo "API_ID = $API_ID"

echo "=== 2) Create Lambda integration ==="
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --region "$AWS_REGION" \
  --api-id "$API_ID" \
  --integration-type AWS_PROXY \
  --integration-uri "$LAMBDA_ARN" \
  --payload-format-version 2.0 \
  --integration-method POST \
  --query IntegrationId --output text)
echo "INTEGRATION_ID = $INTEGRATION_ID"

echo "=== 3) Create routes (ANY /api and ANY /api/{proxy+}) ==="
aws apigatewayv2 create-route --region "$AWS_REGION" --api-id "$API_ID" \
  --route-key "ANY /api" \
  --target "integrations/$INTEGRATION_ID" >/dev/null

aws apigatewayv2 create-route --region "$AWS_REGION" --api-id "$API_ID" \
  --route-key "ANY /api/{proxy+}" \
  --target "integrations/$INTEGRATION_ID" >/dev/null

echo "=== 4) Deploy stage ($STAGE) ==="
if [[ "$STAGE" == "\$default" || "$STAGE" == "\$DEFAULT" || "$STAGE" == "default" ]]; then
  aws apigatewayv2 create-deployment --region "$AWS_REGION" --api-id "$API_ID" >/dev/null
  aws apigatewayv2 create-stage --region "$AWS_REGION" --api-id "$API_ID" \
    --stage-name '$default' --auto-deploy >/dev/null
else
  aws apigatewayv2 create-deployment --region "$AWS_REGION" --api-id "$API_ID" >/dev/null
  aws apigatewayv2 create-stage --region "$AWS_REGION" --api-id "$API_ID" \
    --stage-name "$STAGE" --auto-deploy >/dev/null
fi

API_ENDPOINT=$(aws apigatewayv2 get-api --region "$AWS_REGION" --api-id "$API_ID" \
  --query 'ApiEndpoint' --output text)
echo "API endpoint (execute-api): $API_ENDPOINT/${STAGE/#\$default/}"

echo "=== 5) Allow API Gateway to invoke Lambda ==="
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws lambda add-permission \
  --region "$AWS_REGION" \
  --function-name "$LAMBDA_ARN" \
  --action lambda:InvokeFunction \
  --statement-id "apigw-invoke-$(date +%s)" \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT_ID}:${API_ID}/*/*/api*" >/dev/null

echo "=== 6) Update CloudFront: add API origin + /api/* behavior (HTTPS-only) ==="
API_DOMAIN="${API_ID}.execute-api.${AWS_REGION}.amazonaws.com"
NEW_ORIGIN_ID="apigw-origin-${AWS_REGION}"


# 1) Get current config + ETag
aws cloudfront get-distribution-config --id "$DIST_ID" > /tmp/cf.json
ETAG=$(python3 - <<'PY'
import json; print(json.load(open("/tmp/cf.json"))["ETag"])
PY
)

# 2) Patch config — add required association blocks
python3 - <<PY
import json

with open("/tmp/cf.json") as f:
    data = json.load(f)
cfg = data["DistributionConfig"]

API_DOMAIN = "${API_DOMAIN}"
ORIGIN_ID  = "${NEW_ORIGIN_ID}"
ORIGIN_PATH = "${ORIGIN_PATH}"
CACHE_POLICY = "${CACHE_POLICY_CACHING_DISABLED}"
ORIGIN_REQ_POLICY = "${ORIGIN_REQ_ALL_VIEWER_EXCEPT_HOST}"

def ensure_assoc_blocks(beh):
    # Some accounts require these blocks to exist explicitly
    beh.setdefault("FieldLevelEncryptionId", "")
    beh.setdefault("LambdaFunctionAssociations", {"Quantity": 0, "Items": []})
    beh.setdefault("FunctionAssociations", {"Quantity": 0, "Items": []})
    return beh

# Ensure containers exist
cfg.setdefault("Origins", {"Quantity":0, "Items":[]})
cfg["Origins"].setdefault("Items", [])
cfg.setdefault("CacheBehaviors", {"Quantity":0, "Items":[]})
cfg["CacheBehaviors"].setdefault("Items", [])

# Ensure DefaultCacheBehavior is present and has association blocks
if "DefaultCacheBehavior" in cfg and cfg["DefaultCacheBehavior"]:
    cfg["DefaultCacheBehavior"] = ensure_assoc_blocks(cfg["DefaultCacheBehavior"])

# --- Upsert API origin (HTTPS-only to API Gateway) ---
new_origin = {
    "Id": ORIGIN_ID,
    "DomainName": API_DOMAIN,
    "OriginPath": ORIGIN_PATH,
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

items = cfg["Origins"]["Items"]
for i, o in enumerate(list(items)):
    if o.get("Id") == ORIGIN_ID:
        coc = (o.get("CustomOriginConfig") or {})
        new_origin["CustomOriginConfig"]["OriginReadTimeout"] = int(coc.get("OriginReadTimeout", 30))
        new_origin["CustomOriginConfig"]["OriginKeepaliveTimeout"] = int(coc.get("OriginKeepaliveTimeout", 5))
        if not o.get("CustomHeaders"):
            o["CustomHeaders"] = {"Quantity":0,"Items":[]}
        items[i] = new_origin
        break
else:
    items.append(new_origin)
cfg["Origins"]["Quantity"] = len(items)

# --- Upsert /api/* behavior (no caching, HTTPS redirect) ---
existing = [b for b in (cfg["CacheBehaviors"]["Items"] or []) if b.get("PathPattern") != "/api/*"]

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

existing.append(ensure_assoc_blocks(new_beh))
cfg["CacheBehaviors"]["Items"] = existing
cfg["CacheBehaviors"]["Quantity"] = len(existing)

with open("/tmp/cf.step3.json","w") as f:
    json.dump(cfg, f)
PY

# 3) Update the distribution
aws cloudfront update-distribution \
  --id "$DIST_ID" \
  --if-match "$ETAG" \
  --distribution-config file:///tmp/cf.step3.json