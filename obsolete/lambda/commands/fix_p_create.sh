# === Fill me ===
DIST_ID="EJWBLACWDMFAZ"
API_ID="k7y6zl8i1e"
AWS_REGION="eu-north-1"
ORIGIN_PATH=""      # "" for $default stage, or "/prod" for 'prod'

# Managed policy IDs (AWS)
CACHE_POLICY_CACHING_DISABLED="4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
ORIGIN_REQ_ALL_VIEWER_EXCEPT_HOST="b689b0a8-53d0-40ab-baf2-68738e2966ac"

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