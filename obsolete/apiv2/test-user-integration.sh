#!/bin/bash

# User API Integration Test Script
# This script tests the User API endpoints to ensure they work correctly

echo "🧪 Testing User API Integration"
echo "================================"

# Configuration
BASE_URL="https://vkp-consulting.fr/apiv2"
USER_ID="test-user-$(date +%s)"
USER_NAME="Test User"
EXTERNAL_ID=12345

echo "📍 Base URL: $BASE_URL"
echo "🆔 Test User ID: $USER_ID"
echo ""

# Test 1: Create User
echo "1️⃣ Testing User Creation..."
CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$USER_ID\",\"name\":\"$USER_NAME\",\"externalId\":$EXTERNAL_ID}")

CREATE_HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
CREATE_BODY=$(echo "$CREATE_RESPONSE" | head -n -1)

if [ "$CREATE_HTTP_CODE" = "201" ]; then
  echo "✅ User created successfully"
  echo "📄 Response: $CREATE_BODY"
  
  # Extract ETag for subsequent requests
  ETAG=$(echo "$CREATE_RESPONSE" | grep -i "etag:" | cut -d' ' -f2 | tr -d '\r')
  echo "🏷️ ETag: $ETAG"
else
  echo "❌ User creation failed with status: $CREATE_HTTP_CODE"
  echo "📄 Response: $CREATE_BODY"
  exit 1
fi

echo ""

# Test 2: Get User
echo "2️⃣ Testing User Retrieval..."
GET_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/users/$USER_ID" \
  -H "Accept: application/json")

GET_HTTP_CODE=$(echo "$GET_RESPONSE" | tail -n1)
GET_BODY=$(echo "$GET_RESPONSE" | head -n -1)

if [ "$GET_HTTP_CODE" = "200" ]; then
  echo "✅ User retrieved successfully"
  echo "📄 Response: $GET_BODY"
else
  echo "❌ User retrieval failed with status: $GET_HTTP_CODE"
  echo "📄 Response: $GET_BODY"
fi

echo ""

# Test 3: Get User Metadata
echo "3️⃣ Testing User Metadata Retrieval..."
META_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/users/$USER_ID/meta" \
  -H "Accept: application/json")

META_HTTP_CODE=$(echo "$META_RESPONSE" | tail -n1)
META_BODY=$(echo "$META_RESPONSE" | head -n -1)

if [ "$META_HTTP_CODE" = "200" ]; then
  echo "✅ User metadata retrieved successfully"
  echo "📄 Response: $META_BODY"
else
  echo "❌ User metadata retrieval failed with status: $META_HTTP_CODE"
  echo "📄 Response: $META_BODY"
fi

echo ""

# Test 4: Update User (PUT)
echo "4️⃣ Testing User Update (PUT)..."
UPDATED_NAME="Updated $USER_NAME"
UPDATED_EXTERNAL_ID=54321

UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/users/$USER_ID" \
  -H "Content-Type: application/json" \
  -H "If-Match: $ETAG" \
  -d "{\"name\":\"$UPDATED_NAME\",\"externalId\":$UPDATED_EXTERNAL_ID}")

UPDATE_HTTP_CODE=$(echo "$UPDATE_RESPONSE" | tail -n1)
UPDATE_BODY=$(echo "$UPDATE_RESPONSE" | head -n -1)

if [ "$UPDATE_HTTP_CODE" = "200" ]; then
  echo "✅ User updated successfully"
  echo "📄 Response: $UPDATE_BODY"
  
  # Update ETag for subsequent requests
  NEW_ETAG=$(echo "$UPDATE_RESPONSE" | grep -i "etag:" | cut -d' ' -f2 | tr -d '\r')
  echo "🏷️ New ETag: $NEW_ETAG"
else
  echo "❌ User update failed with status: $UPDATE_HTTP_CODE"
  echo "📄 Response: $UPDATE_BODY"
fi

echo ""

# Test 5: Partial Update User (PATCH)
echo "5️⃣ Testing User Partial Update (PATCH)..."
PATCH_NAME="Patched $UPDATED_NAME"

PATCH_RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/users/$USER_ID" \
  -H "Content-Type: application/json" \
  -H "If-Match: $NEW_ETAG" \
  -d "{\"name\":\"$PATCH_NAME\"}")

PATCH_HTTP_CODE=$(echo "$PATCH_RESPONSE" | tail -n1)
PATCH_BODY=$(echo "$PATCH_RESPONSE" | head -n -1)

if [ "$PATCH_HTTP_CODE" = "200" ]; then
  echo "✅ User patched successfully"
  echo "📄 Response: $PATCH_BODY"
else
  echo "❌ User patch failed with status: $PATCH_HTTP_CODE"
  echo "📄 Response: $PATCH_BODY"
fi

echo ""

# Test 6: List Users
echo "6️⃣ Testing User List..."
LIST_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/users" \
  -H "Accept: application/json")

LIST_HTTP_CODE=$(echo "$LIST_RESPONSE" | tail -n1)
LIST_BODY=$(echo "$LIST_RESPONSE" | head -n -1)

if [ "$LIST_HTTP_CODE" = "200" ]; then
  echo "✅ User list retrieved successfully"
  echo "📄 Response: $LIST_BODY"
else
  echo "❌ User list failed with status: $LIST_HTTP_CODE"
  echo "📄 Response: $LIST_BODY"
fi

echo ""

# Test 7: Delete User
echo "7️⃣ Testing User Deletion..."
DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/users/$USER_ID" \
  -H "If-Match: $NEW_ETAG")

DELETE_HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)

if [ "$DELETE_HTTP_CODE" = "204" ]; then
  echo "✅ User deleted successfully"
else
  echo "❌ User deletion failed with status: $DELETE_HTTP_CODE"
fi

echo ""

# Test 8: Verify Deletion
echo "8️⃣ Verifying User Deletion..."
VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/users/$USER_ID" \
  -H "Accept: application/json")

VERIFY_HTTP_CODE=$(echo "$VERIFY_RESPONSE" | tail -n1)

if [ "$VERIFY_HTTP_CODE" = "404" ]; then
  echo "✅ User deletion verified (404 Not Found)"
else
  echo "❌ User still exists after deletion (status: $VERIFY_HTTP_CODE)"
fi

echo ""
echo "🎉 User API Integration Test Complete!"
echo "======================================"
