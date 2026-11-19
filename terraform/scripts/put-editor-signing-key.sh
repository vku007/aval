#!/bin/sh
# Store the editor signing private key in SSM. The PEM is not committed.
# Run from the repository root after terraform/editor-signing-private.pem exists.
set -eu
KEY_FILE="${1:-terraform/editor-signing-private.pem}"
aws ssm put-parameter \
  --name /vkp/editor/cloudfront-private-key \
  --type SecureString \
  --tier Standard \
  --overwrite \
  --region eu-north-1 \
  --value "file://${KEY_FILE}"
