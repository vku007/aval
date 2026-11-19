#!/bin/sh
# Publish the campaign editor shell to https://vkp-consulting.fr/editor/
# Run from anywhere. Does not deploy a chapter and does not apply Terraform.
# Prerequisites: the CloudFront /editor/* behavior is already applied, and
# /vkp/editor/cloudfront-private-key is in SSM. See apiv2/plans/campaign_editor_deploy.md.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
BUCKET=vkp-consulting.fr
DISTRIBUTION=EJWBLACWDMFAZ
REGION=eu-north-1

cd "$ROOT/tools/campaign-editor"
npm ci
npm test
npm run build

aws s3 sync dist/ "s3://${BUCKET}/editor/" \
  --region "$REGION" \
  --exclude ".DS_Store" \
  --exclude "session.html" \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable"

aws s3 cp dist/index.html "s3://${BUCKET}/editor/index.html" \
  --region "$REGION" \
  --cache-control "no-cache"

aws s3 cp "$ROOT/site/editor/session.html" "s3://${BUCKET}/editor/session.html" \
  --region "$REGION" \
  --cache-control "no-cache"

aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION" \
  --paths "/editor/*"
