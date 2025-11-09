#!/bin/bash

# Create Test User in Cognito
# Usage: ./scripts/create-test-user.sh <role> <email> <display-name> <password>

set -e

if [ $# -lt 4 ]; then
  echo "❌ Error: Missing arguments"
  echo ""
  echo "Usage: $0 <role> <email> <display-name> <password>"
  echo ""
  echo "Examples:"
  echo "  $0 admin test-admin@vkp-test.local 'Test Admin' TestAdmin123!"
  echo "  $0 user test-user@vkp-test.local 'Test User' TestUser123!"
  echo "  $0 guest test-guest@vkp-test.local 'Test Guest' TestGuest123!"
  exit 1
fi

ROLE=$1
EMAIL=$2
DISPLAY_NAME=$3
PASSWORD=$4

USER_POOL_ID="eu-north-1_OxGtXG08i"
REGION="eu-north-1"

echo "🔧 Creating test user in Cognito"
echo "================================="
echo "Email: $EMAIL"
echo "Role: $ROLE"
echo "Display Name: $DISPLAY_NAME"
echo ""

# Create user
echo "📝 Creating user..."
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --user-attributes \
    Name=email,Value="$EMAIL" \
    Name=custom:role,Value="$ROLE" \
    Name=custom:display_name,Value="$DISPLAY_NAME" \
  --message-action SUPPRESS \
  --region "$REGION" > /dev/null

echo "✅ User created"

# Set permanent password
echo "🔑 Setting password..."
aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --password "$PASSWORD" \
  --permanent \
  --region "$REGION" > /dev/null

echo "✅ Password set"

# Add to group
echo "👥 Adding to group '$ROLE'..."
aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --group-name "$ROLE" \
  --region "$REGION" > /dev/null

echo "✅ Added to group"

# Get user details
echo ""
echo "📋 User Details:"
USER_INFO=$(aws cognito-idp admin-get-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$EMAIL" \
  --region "$REGION" \
  --output json)

SUB=$(echo "$USER_INFO" | jq -r '.UserAttributes[] | select(.Name == "sub") | .Value')

echo "   Email: $EMAIL"
echo "   User ID (sub): $SUB"
echo "   Role: $ROLE"
echo "   Display Name: $DISPLAY_NAME"
echo "   Status: $(echo "$USER_INFO" | jq -r '.UserStatus')"
echo ""
echo "✅ Test user created successfully!"
echo ""
echo "💡 Next step: Create User profile entity"
echo "   curl -X POST https://vkp-consulting.fr/apiv2/internal/users \\"
echo "     -H 'Authorization: Bearer <admin-token>' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"id\":\"$SUB\",\"name\":\"$DISPLAY_NAME Profile\",\"externalId\":100}'"
echo ""

