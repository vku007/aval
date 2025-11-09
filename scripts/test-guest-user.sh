#!/bin/bash

# Test Guest User Creation
# This script tests the guest user creation endpoint and verifies the flow

set -e

API_BASE="https://vkp-consulting.fr"
ENDPOINT="${API_BASE}/apiv2/public/create-guest"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Testing Guest User Creation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📍 Endpoint: ${ENDPOINT}"
echo ""

echo "🔄 Creating guest user..."
RESPONSE=$(curl -s -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}")

# Split response and status code
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
HTTP_BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

echo ""
echo "📊 Response Status: ${HTTP_CODE}"
echo ""

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ Guest user created successfully!"
  echo ""
  echo "📄 Response:"
  echo "$HTTP_BODY" | jq '.'
  echo ""
  
  # Extract tokens
  ID_TOKEN=$(echo "$HTTP_BODY" | jq -r '.tokens.idToken')
  GUEST_EMAIL=$(echo "$HTTP_BODY" | jq -r '.guestEmail')
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔐 Guest User Details"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📧 Email: ${GUEST_EMAIL}"
  echo ""
  
  # Decode JWT token to show user info
  if command -v jq &> /dev/null; then
    echo "🎫 JWT Token Claims:"
    echo "$ID_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '.' || echo "Could not decode token"
    echo ""
  fi
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🧪 Testing Guest User Access"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  # Test accessing /apiv2/external/me with guest token
  echo "🔄 Testing /apiv2/external/me endpoint..."
  ME_RESPONSE=$(curl -s -X GET "${API_BASE}/apiv2/external/me" \
    -H "Authorization: Bearer ${ID_TOKEN}" \
    -w "\nHTTP_STATUS:%{http_code}")
  
  ME_CODE=$(echo "$ME_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
  ME_BODY=$(echo "$ME_RESPONSE" | grep -v "HTTP_STATUS:")
  
  echo "📊 Response Status: ${ME_CODE}"
  echo ""
  
  if [ "$ME_CODE" -eq 200 ]; then
    echo "✅ Guest user can access profile!"
    echo ""
    echo "📄 Profile Data:"
    echo "$ME_BODY" | jq '.'
  elif [ "$ME_CODE" -eq 404 ]; then
    echo "⚠️  Profile not found (expected for new guest users)"
    echo "   Guest users don't have S3 profiles yet"
  else
    echo "❌ Unexpected response"
    echo "$ME_BODY"
  fi
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🧹 Cleanup"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "To delete this guest user:"
  echo "  aws cognito-idp admin-delete-user \\"
  echo "    --user-pool-id eu-north-1_OxGtXG08i \\"
  echo "    --username '${GUEST_EMAIL}'"
  echo ""
  
else
  echo "❌ Failed to create guest user"
  echo ""
  echo "📄 Response:"
  echo "$HTTP_BODY"
  echo ""
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Test Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

