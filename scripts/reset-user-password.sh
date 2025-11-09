#!/bin/bash

# Reset password for a Cognito user (admin action)
# Usage: ./scripts/reset-user-password.sh <username-or-email> [new-password]

set -e

# Configuration
USER_POOL_ID="eu-north-1_OxGtXG08i"
REGION="eu-north-1"

# Check arguments
if [ $# -lt 1 ]; then
  echo "❌ Error: Username or email required"
  echo ""
  echo "Usage: $0 <username-or-email> [new-password]"
  echo ""
  echo "Examples:"
  echo "  $0 admin@vkp-consulting.fr                    # Generate temporary password"
  echo "  $0 admin@vkp-consulting.fr MyNewPass123!      # Set specific password"
  echo "  $0 10ccb9cc-e031-70a5-cf21-1dd0d1a25b96       # Using user ID"
  exit 1
fi

USERNAME_OR_EMAIL="$1"
NEW_PASSWORD="${2:-}"

echo "🔐 Resetting password for Cognito user"
echo "User Pool ID: $USER_POOL_ID"
echo "Region: $REGION"
echo ""

# Find user by email or username
echo "🔍 Looking up user..."
if [[ "$USERNAME_OR_EMAIL" == *"@"* ]]; then
  # It's an email, search by email attribute
  USERS=$(aws cognito-idp list-users \
    --user-pool-id "$USER_POOL_ID" \
    --region "$REGION" \
    --filter "email = \"$USERNAME_OR_EMAIL\"" \
    --output json)
  
  USERNAME=$(echo "$USERS" | jq -r '.Users[0].Username // empty')
  
  if [ -z "$USERNAME" ]; then
    echo "❌ Error: User with email '$USERNAME_OR_EMAIL' not found"
    exit 1
  fi
  
  echo "✅ Found user: $USERNAME"
else
  # Assume it's a username/user ID
  USERNAME="$USERNAME_OR_EMAIL"
  
  # Verify user exists
  USER_INFO=$(aws cognito-idp admin-get-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$USERNAME" \
    --region "$REGION" \
    --output json 2>/dev/null || echo "")
  
  if [ -z "$USER_INFO" ]; then
    echo "❌ Error: User '$USERNAME' not found"
    exit 1
  fi
  
  echo "✅ Found user: $USERNAME"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Reset password
if [ -n "$NEW_PASSWORD" ]; then
  # Set specific password (permanent)
  echo "🔒 Setting new password (permanent)..."
  
  aws cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$USERNAME" \
    --password "$NEW_PASSWORD" \
    --permanent \
    --region "$REGION" \
    --output json > /dev/null
  
  echo "✅ Password set successfully!"
  echo ""
  echo "📋 New Password: $NEW_PASSWORD"
  echo "   (permanent - user can login immediately)"
  
else
  # Generate temporary password (user must change on first login)
  echo "🔒 Generating temporary password..."
  
  RESULT=$(aws cognito-idp admin-reset-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$USERNAME" \
    --region "$REGION" \
    --output json 2>&1)
  
  if echo "$RESULT" | grep -q "error"; then
    echo "❌ Error resetting password:"
    echo "$RESULT"
    exit 1
  fi
  
  echo "✅ Temporary password generated!"
  echo ""
  echo "⚠️  User will receive password reset email (if email is configured)"
  echo "⚠️  User MUST change password on first login"
  echo ""
  echo "💡 To set a specific permanent password instead:"
  echo "   $0 $USERNAME_OR_EMAIL YourPassword123!"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show user details
echo "👤 User Details:"
USER_DETAILS=$(aws cognito-idp admin-get-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$USERNAME" \
  --region "$REGION" \
  --output json)

EMAIL=$(echo "$USER_DETAILS" | jq -r '.UserAttributes[] | select(.Name == "email") | .Value // "N/A"')
DISPLAY_NAME=$(echo "$USER_DETAILS" | jq -r '.UserAttributes[] | select(.Name == "custom:display_name") | .Value // "N/A"')
STATUS=$(echo "$USER_DETAILS" | jq -r '.UserStatus')

echo "   Username:     $USERNAME"
echo "   Email:        $EMAIL"
echo "   Display Name: $DISPLAY_NAME"
echo "   Status:       $STATUS"
echo ""
echo "✅ Password reset complete!"
echo ""

