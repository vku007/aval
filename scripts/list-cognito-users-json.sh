#!/bin/bash

# List all users in Cognito User Pool (JSON output)
# Usage: ./scripts/list-cognito-users-json.sh

set -e

# Configuration
USER_POOL_ID="eu-north-1_OxGtXG08i"
REGION="eu-north-1"

# List all users and output as JSON array
aws cognito-idp list-users \
  --user-pool-id "$USER_POOL_ID" \
  --region "$REGION" \
  --output json | jq '.Users | map({
    username: .Username,
    sub: (.Attributes | map(select(.Name == "sub")) | .[0].Value // null),
    email: (.Attributes | map(select(.Name == "email")) | .[0].Value // null),
    displayName: (.Attributes | map(select(.Name == "custom:display_name")) | .[0].Value // null),
    role: (.Attributes | map(select(.Name == "custom:role")) | .[0].Value // null),
    emailVerified: (.Attributes | map(select(.Name == "email_verified")) | .[0].Value // null),
    status: .UserStatus,
    enabled: .Enabled,
    created: .UserCreateDate,
    modified: .UserLastModifiedDate
  })'

