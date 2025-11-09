#!/bin/bash

# Delete Test Users from Cognito
# Usage: ./scripts/delete-test-users.sh

set -e

USER_POOL_ID="eu-north-1_OxGtXG08i"
REGION="eu-north-1"

echo "🗑️  Deleting Test Users from Cognito"
echo "====================================="
echo ""

# Get all test users (emails containing vkp-test.local)
TEST_USERS=$(aws cognito-idp list-users \
  --user-pool-id "$USER_POOL_ID" \
  --region "$REGION" \
  --output json | jq -r '.Users[] | select(.Attributes[] | select(.Name == "email" and (.Value | contains("vkp-test.local")))) | .Username')

if [ -z "$TEST_USERS" ]; then
  echo "ℹ️  No test users found"
  exit 0
fi

echo "Found test users:"
echo "$TEST_USERS"
echo ""

for USERNAME in $TEST_USERS; do
  echo -n "Deleting $USERNAME... "
  
  aws cognito-idp admin-delete-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$USERNAME" \
    --region "$REGION" > /dev/null
  
  echo "✅ Deleted"
done

echo ""
echo "✅ All test users deleted"
echo ""
echo "💡 Don't forget to clean up test data from S3:"
echo "   aws s3 rm s3://data-1-088455116440/json/ --recursive --exclude '*' --include '*test-*'"
echo ""

