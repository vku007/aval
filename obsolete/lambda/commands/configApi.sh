# === Fill me ===
DIST_ID="EJWBLACWDMFAZ"                            # your CloudFront distribution id
API_ID="18s0sefz16"                               # from create-api output
AWS_REGION="eu-north-1"                        # region of API Gateway
ORIGIN_PATH=""                              # "/prod" or "" for $default

# === Managed policy IDs (from AWS docs) ===
CACHE_POLICY_CACHING_DISABLED="4135ea2d-6df8-44a3-9df3-4b5a84be39ad"              # CachingDisabled
ORIGIN_REQ_ALL_VIEWER_EXCEPT_HOST="b689b0a8-53d0-40ab-baf2-68738e2966ac"         # AllViewerExceptHostHeader

# === Derived ===
API_DOMAIN="${API_ID}.execute-api.${API_REGION}.amazonaws.com"
NEW_ORIGIN_ID="apigw-origin-${API_REGION}"

echo $API_DOMAIN
echo $NEW_ORIGIN_ID

# Get current config + ETag
aws cloudfront get-distribution-config --id "$DIST_ID" > /tmp/cf.json
ETAG=$(jq -r '.ETag' /tmp/cf.json)
jq -r '.DistributionConfig' /tmp/cf.json > /tmp/cf.config.json

# Add/UPSERT the API origin
jq --arg dom "$API_DOMAIN" --arg id "$NEW_ORIGIN_ID" --arg path "$ORIGIN_PATH" '
  .Origins = (
    .Origins // {Quantity:0,Items:[]} |
    # If origin with same Id exists, replace it; else append
    ( .Items |= (
        (map(select(.Id == $id)) | length) > 0
        ? (map( if .Id == $id then
            .DomainName = $dom |
            .OriginPath = $path |
            .CustomOriginConfig = {
              "OriginProtocolPolicy":"https-only",
              "OriginSSLProtocols":{"Quantity":1,"Items":["TLSv1.2"]},
              "HTTPPort":80,"HTTPSPort":443
            }
          else . end))
        : (. + [{
            "Id": $id,
            "DomainName": $dom,
            "OriginPath": $path,
            "CustomOriginConfig": {
              "OriginProtocolPolicy":"https-only",
              "OriginSSLProtocols":{"Quantity":1,"Items":["TLSv1.2"]},
              "HTTPPort":80,"HTTPSPort":443
            }
          }])
      )
    ) |
    .Quantity = (.Items | length)
  )
' /tmp/cf.config.json > /tmp/cf.step1.json

# Add/UPSERT the /api/* cache behavior
jq --arg id "$NEW_ORIGIN_ID" \
   --arg cache "$CACHE_POLICY_CACHING_DISABLED" \
   --arg orpol "$ORIGIN_REQ_ALL_VIEWER_EXCEPT_HOST" '
  .CacheBehaviors = (
    .CacheBehaviors // {Quantity:0,Items:[]} |
    .Items |= (
      # remove any existing /api/* so we replace it cleanly
      map(select(.PathPattern != "/api/*")) +
      [{
        "PathPattern": "/api/*",
        "TargetOriginId": $id,
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
          "Quantity": 7,
          "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
          "CachedMethods": {"Quantity": 3, "Items": ["GET","HEAD","OPTIONS"]}
        },
        "Compress": true,
        "CachePolicyId": $cache,
        "OriginRequestPolicyId": $orpol,
        "SmoothStreaming": false
      }]
    ) |
    .Quantity = (.Items | length)
  )
' /tmp/cf.step1.json > /tmp/cf.step2.json

# Update the distribution
aws cloudfront update-distribution \
  --id "$DIST_ID" \
  --if-match "$ETAG" \
  --distribution-config file:///tmp/cf.step2.json
