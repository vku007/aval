#!/bin/bash

# List all users in Cognito User Pool
# Usage: ./scripts/list-cognito-users.sh

set -e

# Configuration
USER_POOL_ID="eu-north-1_OxGtXG08i"
REGION="eu-north-1"

echo "📋 Listing all users in Cognito User Pool"
echo "User Pool ID: $USER_POOL_ID"
echo "Region: $REGION"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# List users with pagination
NEXT_TOKEN=""
USER_COUNT=0

while true; do
  if [ -z "$NEXT_TOKEN" ]; then
    # First request
    RESPONSE=$(aws cognito-idp list-users \
      --user-pool-id "$USER_POOL_ID" \
      --region "$REGION" \
      --output json)
  else
    # Subsequent requests with pagination token
    RESPONSE=$(aws cognito-idp list-users \
      --user-pool-id "$USER_POOL_ID" \
      --region "$REGION" \
      --pagination-token "$NEXT_TOKEN" \
      --output json)
  fi

  # Extract users
  USERS=$(echo "$RESPONSE" | jq -r '.Users')
  
  # Count users in this batch
  BATCH_COUNT=$(echo "$USERS" | jq 'length')
  
  if [ "$BATCH_COUNT" -eq 0 ]; then
    break
  fi

  # Process each user
  for i in $(seq 0 $((BATCH_COUNT - 1))); do
    USERNAME=$(echo "$USERS" | jq -r ".[$i].Username")
    SUB=$(echo "$USERS" | jq -r ".[$i].Attributes[] | select(.Name == \"sub\") | .Value")
    EMAIL=$(echo "$USERS" | jq -r ".[$i].Attributes[] | select(.Name == \"email\") | .Value // \"N/A\"")
    DISPLAY_NAME=$(echo "$USERS" | jq -r ".[$i].Attributes[] | select(.Name == \"custom:display_name\") | .Value // \"N/A\"")
    EMAIL_VERIFIED=$(echo "$USERS" | jq -r ".[$i].Attributes[] | select(.Name == \"email_verified\") | .Value // \"N/A\"")
    ROLE=$(echo "$USERS" | jq -r ".[$i].Attributes[] | select(.Name == \"custom:role\") | .Value // \"N/A\"")
    STATUS=$(echo "$USERS" | jq -r ".[$i].UserStatus")
    ENABLED=$(echo "$USERS" | jq -r ".[$i].Enabled")
    CREATED=$(echo "$USERS" | jq -r ".[$i].UserCreateDate")
    MODIFIED=$(echo "$USERS" | jq -r ".[$i].UserLastModifiedDate")
    
    echo "┌─────────────────────────────────────────────────────────────────────┐"
    echo "│ Username:       $USERNAME"
    echo "│ User ID (sub):  $SUB"
    echo "│ Email:          $EMAIL"
    echo "│ Display Name:   $DISPLAY_NAME"
    echo "│ Role:           $ROLE"
    echo "│ Email Verified: $EMAIL_VERIFIED"
    echo "│ Status:         $STATUS"
    echo "│ Enabled:        $ENABLED"
    echo "│ Created:        $CREATED"
    echo "│ Modified:       $MODIFIED"
    echo "└─────────────────────────────────────────────────────────────────────┘"
    echo ""
  done

  USER_COUNT=$((USER_COUNT + BATCH_COUNT))

  # Check for next page
  NEXT_TOKEN=$(echo "$RESPONSE" | jq -r '.PaginationToken // empty')
  
  if [ -z "$NEXT_TOKEN" ]; then
    break
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Total users found: $USER_COUNT"
echo ""

