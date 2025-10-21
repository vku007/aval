#!/bin/bash

# Game API Integration Test Script
# This script tests the Game API endpoints to ensure they work correctly

echo "🎮 Testing Game API Integration"
echo "================================"

# Configuration
BASE_URL="https://vkp-consulting.fr/apiv2"
GAME_ID="test-game-$(date +%s)"
GAME_TYPE="tournament"
USER_IDS=("player1" "player2")
ROUND_ID="round-1"
MOVE_ID="move-1"

echo "📍 Base URL: $BASE_URL"
echo "🆔 Test Game ID: $GAME_ID"
echo "👥 Players: ${USER_IDS[*]}"
echo ""

# Test 1: Create Game
echo "1️⃣ Testing Game Creation..."
CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/games" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$GAME_ID\",\"type\":\"$GAME_TYPE\",\"usersIds\":[\"${USER_IDS[0]}\",\"${USER_IDS[1]}\"],\"rounds\":[],\"isFinished\":false}")

CREATE_HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
CREATE_BODY=$(echo "$CREATE_RESPONSE" | sed '$d')

if [ "$CREATE_HTTP_CODE" = "201" ]; then
  echo "✅ Game created successfully"
  echo "📄 Response: $CREATE_BODY"
  
  # Extract ETag for subsequent requests
  ETAG=$(curl -s -I -X GET "$BASE_URL/games/$GAME_ID" | grep -i "etag:" | cut -d' ' -f2 | tr -d '\r\n')
  echo "🏷️ ETag: $ETAG"
else
  echo "❌ Game creation failed with status: $CREATE_HTTP_CODE"
  echo "📄 Response: $CREATE_BODY"
  exit 1
fi

echo ""

# Test 2: Get Game
echo "2️⃣ Testing Game Retrieval..."
GET_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/games/$GAME_ID" \
  -H "Accept: application/json")

GET_HTTP_CODE=$(echo "$GET_RESPONSE" | tail -n1)
GET_BODY=$(echo "$GET_RESPONSE" | sed '$d')

if [ "$GET_HTTP_CODE" = "200" ]; then
  echo "✅ Game retrieved successfully"
  echo "📄 Response: $GET_BODY"
else
  echo "❌ Game retrieval failed with status: $GET_HTTP_CODE"
  echo "📄 Response: $GET_BODY"
fi

echo ""

# Test 3: Get Game Metadata
echo "3️⃣ Testing Game Metadata Retrieval..."
META_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/games/$GAME_ID/meta" \
  -H "Accept: application/json")

META_HTTP_CODE=$(echo "$META_RESPONSE" | tail -n1)
META_BODY=$(echo "$META_RESPONSE" | sed '$d')

if [ "$META_HTTP_CODE" = "200" ]; then
  echo "✅ Game metadata retrieved successfully"
  echo "📄 Response: $META_BODY"
else
  echo "❌ Game metadata retrieval failed with status: $META_HTTP_CODE"
  echo "📄 Response: $META_BODY"
fi

echo ""

# Test 4: Add Round to Game
echo "4️⃣ Testing Round Addition..."
ADD_ROUND_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/games/$GAME_ID/rounds" \
  -H "Content-Type: application/json" \
  -H "If-Match: $ETAG" \
  -d "{\"id\":\"$ROUND_ID\",\"moves\":[],\"isFinished\":false}")

ADD_ROUND_HTTP_CODE=$(echo "$ADD_ROUND_RESPONSE" | tail -n1)
ADD_ROUND_BODY=$(echo "$ADD_ROUND_RESPONSE" | sed '$d')

if [ "$ADD_ROUND_HTTP_CODE" = "200" ]; then
  echo "✅ Round added successfully"
  echo "📄 Response: $ADD_ROUND_BODY"
  
  # Update ETag for subsequent requests
  NEW_ETAG=$(curl -s -I -X GET "$BASE_URL/games/$GAME_ID" | grep -i "etag:" | cut -d' ' -f2 | tr -d '\r\n')
  echo "🏷️ New ETag: $NEW_ETAG"
else
  echo "❌ Round addition failed with status: $ADD_ROUND_HTTP_CODE"
  echo "📄 Response: $ADD_ROUND_BODY"
fi

echo ""

# Test 5: Add Move to Round
echo "5️⃣ Testing Move Addition..."
MOVE_VALUE=25
MOVE_VALUE_DECORATED="twenty-five"

ADD_MOVE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/games/$GAME_ID/rounds/$ROUND_ID/moves" \
  -H "Content-Type: application/json" \
  -H "If-Match: $NEW_ETAG" \
  -d "{\"id\":\"$MOVE_ID\",\"userId\":\"${USER_IDS[0]}\",\"value\":$MOVE_VALUE,\"valueDecorated\":\"$MOVE_VALUE_DECORATED\"}")

ADD_MOVE_HTTP_CODE=$(echo "$ADD_MOVE_RESPONSE" | tail -n1)
ADD_MOVE_BODY=$(echo "$ADD_MOVE_RESPONSE" | sed '$d')

if [ "$ADD_MOVE_HTTP_CODE" = "200" ]; then
  echo "✅ Move added successfully"
  echo "📄 Response: $ADD_MOVE_BODY"
  
  # Update ETag for subsequent requests
  NEW_ETAG=$(curl -s -I -X GET "$BASE_URL/games/$GAME_ID" | grep -i "etag:" | cut -d' ' -f2 | tr -d '\r\n')
  echo "🏷️ New ETag: $NEW_ETAG"
else
  echo "❌ Move addition failed with status: $ADD_MOVE_HTTP_CODE"
  echo "📄 Response: $ADD_MOVE_BODY"
fi

echo ""

# Test 6: Finish Round
echo "6️⃣ Testing Round Finish..."
FINISH_ROUND_RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/games/$GAME_ID/rounds/$ROUND_ID/finish" \
  -H "Content-Type: application/json" \
  -H "If-Match: $NEW_ETAG")

FINISH_ROUND_HTTP_CODE=$(echo "$FINISH_ROUND_RESPONSE" | tail -n1)
FINISH_ROUND_BODY=$(echo "$FINISH_ROUND_RESPONSE" | sed '$d')

if [ "$FINISH_ROUND_HTTP_CODE" = "200" ]; then
  echo "✅ Round finished successfully"
  echo "📄 Response: $FINISH_ROUND_BODY"
  
  # Update ETag for subsequent requests
  NEW_ETAG=$(curl -s -I -X GET "$BASE_URL/games/$GAME_ID" | grep -i "etag:" | cut -d' ' -f2 | tr -d '\r\n')
  echo "🏷️ New ETag: $NEW_ETAG"
else
  echo "❌ Round finish failed with status: $FINISH_ROUND_HTTP_CODE"
  echo "📄 Response: $FINISH_ROUND_BODY"
fi

echo ""

# Test 7: Update Game (PUT)
echo "7️⃣ Testing Game Update (PUT)..."
UPDATED_TYPE="championship"
UPDATED_USER_IDS=("${USER_IDS[0]}" "${USER_IDS[1]}" "player3")

UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/games/$GAME_ID" \
  -H "Content-Type: application/json" \
  -H "If-Match: $NEW_ETAG" \
  -d "{\"type\":\"$UPDATED_TYPE\",\"usersIds\":[\"${UPDATED_USER_IDS[0]}\",\"${UPDATED_USER_IDS[1]}\",\"${UPDATED_USER_IDS[2]}\"],\"rounds\":[{\"id\":\"$ROUND_ID\",\"moves\":[{\"id\":\"$MOVE_ID\",\"userId\":\"${USER_IDS[0]}\",\"value\":$MOVE_VALUE,\"valueDecorated\":\"$MOVE_VALUE_DECORATED\"}],\"isFinished\":true}],\"isFinished\":false}")

UPDATE_HTTP_CODE=$(echo "$UPDATE_RESPONSE" | tail -n1)
UPDATE_BODY=$(echo "$UPDATE_RESPONSE" | sed '$d')

if [ "$UPDATE_HTTP_CODE" = "200" ]; then
  echo "✅ Game updated successfully"
  echo "📄 Response: $UPDATE_BODY"
  
  # Update ETag for subsequent requests
  NEW_ETAG=$(curl -s -I -X GET "$BASE_URL/games/$GAME_ID" | grep -i "etag:" | cut -d' ' -f2 | tr -d '\r\n')
  echo "🏷️ New ETag: $NEW_ETAG"
else
  echo "❌ Game update failed with status: $UPDATE_HTTP_CODE"
  echo "📄 Response: $UPDATE_BODY"
fi

echo ""

# Test 8: Partial Update Game (PATCH)
echo "8️⃣ Testing Game Partial Update (PATCH)..."
PATCH_FINISHED=true

PATCH_RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/games/$GAME_ID" \
  -H "Content-Type: application/json" \
  -H "If-Match: $NEW_ETAG" \
  -d "{\"isFinished\":$PATCH_FINISHED}")

PATCH_HTTP_CODE=$(echo "$PATCH_RESPONSE" | tail -n1)
PATCH_BODY=$(echo "$PATCH_RESPONSE" | sed '$d')

if [ "$PATCH_HTTP_CODE" = "200" ]; then
  echo "✅ Game patched successfully"
  echo "📄 Response: $PATCH_BODY"
  
  # Update ETag for subsequent requests
  NEW_ETAG=$(curl -s -I -X GET "$BASE_URL/games/$GAME_ID" | grep -i "etag:" | cut -d' ' -f2 | tr -d '\r\n')
  echo "🏷️ New ETag: $NEW_ETAG"
else
  echo "❌ Game patch failed with status: $PATCH_HTTP_CODE"
  echo "📄 Response: $PATCH_BODY"
fi

echo ""

# Test 9: List Games
echo "9️⃣ Testing Game List..."
LIST_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/games" \
  -H "Accept: application/json")

LIST_HTTP_CODE=$(echo "$LIST_RESPONSE" | tail -n1)
LIST_BODY=$(echo "$LIST_RESPONSE" | sed '$d')

if [ "$LIST_HTTP_CODE" = "200" ]; then
  echo "✅ Game list retrieved successfully"
  echo "📄 Response: $LIST_BODY"
else
  echo "❌ Game list failed with status: $LIST_HTTP_CODE"
  echo "📄 Response: $LIST_BODY"
fi

echo ""

# Test 10: Delete Game
echo "🔟 Testing Game Deletion..."
DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/games/$GAME_ID" \
  -H "If-Match: $NEW_ETAG")

DELETE_HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)

if [ "$DELETE_HTTP_CODE" = "204" ]; then
  echo "✅ Game deleted successfully"
else
  echo "❌ Game deletion failed with status: $DELETE_HTTP_CODE"
fi

echo ""

# Test 11: Verify Deletion
echo "1️⃣1️⃣ Verifying Game Deletion..."
VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/games/$GAME_ID" \
  -H "Accept: application/json")

VERIFY_HTTP_CODE=$(echo "$VERIFY_RESPONSE" | tail -n1)

if [ "$VERIFY_HTTP_CODE" = "404" ]; then
  echo "✅ Game deletion verified (404 Not Found)"
else
  echo "❌ Game still exists after deletion (status: $VERIFY_HTTP_CODE)"
fi

echo ""
echo "🎉 Game API Integration Test Complete!"
echo "======================================"