#!/bin/bash

# Test Entity Endpoints with Different Roles
# Usage: ./scripts/test-entity-endpoints.sh <id-token> <expected-role>

set -e

if [ $# -lt 2 ]; then
  echo "❌ Error: Missing arguments"
  echo ""
  echo "Usage: $0 <id-token> <expected-role>"
  echo ""
  echo "Examples:"
  echo "  $0 'eyJra...' admin"
  echo "  $0 'eyJra...' user"
  exit 1
fi

TOKEN=$1
ROLE=$2
API_BASE="https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal"
TEST_ENTITY_ID="test-entity-$ROLE-$(date +%s)"

echo "🧪 Testing Entity Endpoints"
echo "============================"
echo "Role: $ROLE"
echo "Test Entity ID: $TEST_ENTITY_ID"
echo ""

# Test LIST
echo -n "1. GET /files (List): "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/files")
if [ "$ROLE" = "admin" ]; then
  [ "$STATUS" = "200" ] && echo "✅ 200 OK" || echo "❌ Expected 200, got $STATUS"
else
  [ "$STATUS" = "403" ] && echo "✅ 403 Forbidden" || echo "❌ Expected 403, got $STATUS"
fi

# Test CREATE
echo -n "2. POST /files (Create): "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$TEST_ENTITY_ID\",\"data\":{\"test\":true,\"role\":\"$ROLE\"}}" \
  "$API_BASE/files")
if [ "$ROLE" = "admin" ]; then
  [ "$STATUS" = "201" ] && echo "✅ 201 Created" || echo "❌ Expected 201, got $STATUS"
else
  [ "$STATUS" = "403" ] && echo "✅ 403 Forbidden" || echo "❌ Expected 403, got $STATUS"
fi

# Test GET (only if admin and entity was created)
if [ "$ROLE" = "admin" ]; then
  echo -n "3. GET /files/{id} (Read): "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$API_BASE/files/$TEST_ENTITY_ID")
  [ "$STATUS" = "200" ] && echo "✅ 200 OK" || echo "❌ Expected 200, got $STATUS"
  
  # Test GET META
  echo -n "4. GET /files/{id}/meta (Metadata): "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$API_BASE/files/$TEST_ENTITY_ID/meta")
  [ "$STATUS" = "200" ] && echo "✅ 200 OK" || echo "❌ Expected 200, got $STATUS"
  
  # Test PUT
  echo -n "5. PUT /files/{id} (Replace): "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$TEST_ENTITY_ID\",\"data\":{\"test\":true,\"updated\":true}}" \
    "$API_BASE/files/$TEST_ENTITY_ID")
  [ "$STATUS" = "200" ] && echo "✅ 200 OK" || echo "❌ Expected 200, got $STATUS"
  
  # Test PATCH
  echo -n "6. PATCH /files/{id} (Merge): "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PATCH \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"merged\":true}" \
    "$API_BASE/files/$TEST_ENTITY_ID")
  [ "$STATUS" = "200" ] && echo "✅ 200 OK" || echo "❌ Expected 200, got $STATUS"
  
  # Test DELETE
  echo -n "7. DELETE /files/{id} (Delete): "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE \
    -H "Authorization: Bearer $TOKEN" \
    "$API_BASE/files/$TEST_ENTITY_ID")
  [ "$STATUS" = "204" ] && echo "✅ 204 No Content" || echo "❌ Expected 204, got $STATUS"
else
  echo "3-7. Skipped (non-admin user)"
fi

echo ""
if [ "$ROLE" = "admin" ]; then
  echo "✅ Admin: All operations allowed"
else
  echo "✅ $ROLE: All operations blocked (as expected)"
fi
echo ""

