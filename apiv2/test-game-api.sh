#!/bin/bash

# Game API Manual Testing Script
# Base URL - Update this to match your deployed API Gateway URL
BASE_URL="https://your-api-gateway-url.amazonaws.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎮 Game API Manual Testing Commands${NC}"
echo "================================================"
echo "Base URL: $BASE_URL"
echo ""

# Function to print section headers
print_section() {
    echo -e "\n${YELLOW}📋 $1${NC}"
    echo "----------------------------------------"
}

# Function to print curl command
print_curl() {
    echo -e "${GREEN}Command:${NC}"
    echo "$1"
    echo ""
}

# Function to print expected response
print_expected() {
    echo -e "${BLUE}Expected Response:${NC}"
    echo "$1"
    echo ""
}

print_section "1. CREATE GAME - Basic Tournament"
print_curl "curl -X POST '$BASE_URL/apiv2/games' \\
  -H 'Content-Type: application/json' \\
  -d '{
    \"id\": \"tournament-2024-01\",
    \"type\": \"tournament\",
    \"usersIds\": [\"player-1\", \"player-2\"],
    \"rounds\": [],
    \"isFinished\": false
  }'"
print_expected "Status: 201 Created
Headers: Location: /apiv2/games/tournament-2024-01, ETag: \"...\"
Body: Game object with metadata"

print_section "2. CREATE GAME - With Initial Rounds and Moves"
print_curl "curl -X POST '$BASE_URL/apiv2/games' \\
  -H 'Content-Type: application/json' \\
  -d '{
    \"id\": \"championship-2024\",
    \"type\": \"championship\",
    \"usersIds\": [\"alice\", \"bob\", \"charlie\"],
    \"rounds\": [
      {
        \"id\": \"round-1\",
        \"moves\": [
          {
            \"id\": \"move-1\",
            \"userId\": \"alice\",
            \"value\": 15,
            \"valueDecorated\": \"fifteen\"
          },
          {
            \"id\": \"move-2\",
            \"userId\": \"bob\",
            \"value\": 20,
            \"valueDecorated\": \"twenty\"
          }
        ],
        \"isFinished\": false
      }
    ],
    \"isFinished\": false
  }'"
print_expected "Status: 201 Created
Body: Game object with initial round and moves"

print_section "3. GET GAME - Retrieve Specific Game"
print_curl "curl -X GET '$BASE_URL/apiv2/games/tournament-2024-01' \\
  -H 'Accept: application/json'"
print_expected "Status: 200 OK
Headers: ETag: \"...\", Cache-Control: private, must-revalidate
Body: Complete game object"

print_section "4. GET GAME METADATA - Check ETag and Size"
print_curl "curl -X GET '$BASE_URL/apiv2/games/tournament-2024-01/meta' \\
  -H 'Accept: application/json'"
print_expected "Status: 200 OK
Headers: ETag: \"...\"
Body: {\"etag\": \"...\", \"size\": 123, \"lastModified\": \"...\"}"

print_section "5. LIST GAMES - Get All Games"
print_curl "curl -X GET '$BASE_URL/apiv2/games' \\
  -H 'Accept: application/json'"
print_expected "Status: 200 OK
Body: {\"names\": [\"tournament-2024-01\", \"championship-2024\", ...]}"

print_section "6. LIST GAMES - With Pagination"
print_curl "curl -X GET '$BASE_URL/apiv2/games?limit=5&prefix=tournament' \\
  -H 'Accept: application/json'"
print_expected "Status: 200 OK
Body: {\"names\": [...], \"nextCursor\": \"...\"}"

print_section "7. UPDATE GAME - Replace Strategy (PUT)"
print_curl "curl -X PUT '$BASE_URL/apiv2/games/tournament-2024-01' \\
  -H 'Content-Type: application/json' \\
  -H 'If-Match: \"your-etag-here\"' \\
  -d '{
    \"type\": \"premium-tournament\",
    \"usersIds\": [\"player-1\", \"player-2\", \"player-3\"],
    \"rounds\": [],
    \"isFinished\": false
  }'"
print_expected "Status: 200 OK
Headers: ETag: \"new-etag\"
Body: Updated game object"

print_section "8. UPDATE GAME - Merge Strategy (PATCH)"
print_curl "curl -X PATCH '$BASE_URL/apiv2/games/tournament-2024-01' \\
  -H 'Content-Type: application/json' \\
  -H 'If-Match: \"your-etag-here\"' \\
  -d '{
    \"isFinished\": true
  }'"
print_expected "Status: 200 OK
Body: Game object with isFinished: true"

print_section "9. ADD ROUND TO GAME"
print_curl "curl -X POST '$BASE_URL/apiv2/games/tournament-2024-01/rounds' \\
  -H 'Content-Type: application/json' \\
  -H 'If-Match: \"your-etag-here\"' \\
  -d '{
    \"id\": \"round-1\",
    \"moves\": [],
    \"isFinished\": false
  }'"
print_expected "Status: 200 OK
Body: Game object with new round added"

print_section "10. ADD MOVE TO ROUND"
print_curl "curl -X POST '$BASE_URL/apiv2/games/tournament-2024-01/rounds/round-1/moves' \\
  -H 'Content-Type: application/json' \\
  -H 'If-Match: \"your-etag-here\"' \\
  -d '{
    \"id\": \"move-1\",
    \"userId\": \"player-1\",
    \"value\": 25,
    \"valueDecorated\": \"twenty-five\"
  }'"
print_expected "Status: 200 OK
Body: Game object with move added to round"

print_section "11. FINISH ROUND"
print_curl "curl -X PATCH '$BASE_URL/apiv2/games/tournament-2024-01/rounds/round-1/finish' \\
  -H 'If-Match: \"your-etag-here\"'"
print_expected "Status: 200 OK
Body: Game object with round marked as finished"

print_section "12. FINISH GAME"
print_curl "curl -X PATCH '$BASE_URL/apiv2/games/tournament-2024-01/finish' \\
  -H 'If-Match: \"your-etag-here\"'"
print_expected "Status: 200 OK
Body: Game object with isFinished: true"

print_section "13. DELETE GAME"
print_curl "curl -X DELETE '$BASE_URL/apiv2/games/tournament-2024-01' \\
  -H 'If-Match: \"your-etag-here\"'"
print_expected "Status: 204 No Content"

print_section "14. ERROR SCENARIOS"

echo -e "${RED}❌ Test Error Cases:${NC}"
echo ""

echo -e "${GREEN}Invalid Game Data:${NC}"
print_curl "curl -X POST '$BASE_URL/apiv2/games' \\
  -H 'Content-Type: application/json' \\
  -d '{
    \"id\": \"invalid@game\",
    \"type\": \"\",
    \"usersIds\": [],
    \"rounds\": [],
    \"isFinished\": false
  }'"
print_expected "Status: 400 Bad Request
Body: Validation error details"

echo -e "${GREEN}Game Not Found:${NC}"
print_curl "curl -X GET '$BASE_URL/apiv2/games/non-existent-game'"
print_expected "Status: 404 Not Found
Body: Game not found error"

echo -e "${GREEN}ETag Mismatch (Concurrency):${NC}"
print_curl "curl -X PUT '$BASE_URL/apiv2/games/championship-2024' \\
  -H 'Content-Type: application/json' \\
  -H 'If-Match: \"wrong-etag\"' \\
  -d '{
    \"type\": \"updated-championship\",
    \"usersIds\": [\"alice\", \"bob\"],
    \"rounds\": [],
    \"isFinished\": false
  }'"
print_expected "Status: 412 Precondition Failed
Body: ETag mismatch error"

echo -e "${GREEN}Missing Content-Type:${NC}"
print_curl "curl -X POST '$BASE_URL/apiv2/games' \\
  -d '{\"id\": \"test\", \"type\": \"test\", \"usersIds\": [\"user1\"], \"rounds\": [], \"isFinished\": false}'"
print_expected "Status: 415 Unsupported Media Type
Body: Content-Type must be application/json"

print_section "15. CORS PREFLIGHT TEST"
print_curl "curl -X OPTIONS '$BASE_URL/apiv2/games' \\
  -H 'Origin: https://example.com' \\
  -H 'Access-Control-Request-Method: POST' \\
  -H 'Access-Control-Request-Headers: Content-Type'"
print_expected "Status: 204 No Content
Headers: Access-Control-Allow-Origin, Access-Control-Allow-Methods, etc."

print_section "16. CONDITIONAL REQUESTS"

echo -e "${GREEN}If-None-Match (Not Modified):${NC}"
print_curl "curl -X GET '$BASE_URL/apiv2/games/championship-2024' \\
  -H 'If-None-Match: \"current-etag\"'"
print_expected "Status: 304 Not Modified (if ETag matches)"

echo -e "${GREEN}If-None-Match (Modified):${NC}"
print_curl "curl -X GET '$BASE_URL/apiv2/games/championship-2024' \\
  -H 'If-None-Match: \"old-etag\"'"
print_expected "Status: 200 OK (if ETag differs)"

print_section "17. COMPLETE GAME FLOW EXAMPLE"

echo -e "${BLUE}🎯 Complete Game Flow Test:${NC}"
echo "1. Create game"
echo "2. Add rounds"
echo "3. Add moves to rounds"
echo "4. Finish rounds"
echo "5. Finish game"
echo "6. Get final game state"
echo ""

echo -e "${GREEN}Step 1 - Create Game:${NC}"
print_curl "curl -X POST '$BASE_URL/apiv2/games' \\
  -H 'Content-Type: application/json' \\
  -d '{
    \"id\": \"flow-test-game\",
    \"type\": \"flow-test\",
    \"usersIds\": [\"user1\", \"user2\"],
    \"rounds\": [],
    \"isFinished\": false
  }'"

echo -e "${GREEN}Step 2 - Add Round:${NC}"
print_curl "curl -X POST '$BASE_URL/apiv2/games/flow-test-game/rounds' \\
  -H 'Content-Type: application/json' \\
  -H 'If-Match: \"ETAG_FROM_STEP_1\"' \\
  -d '{
    \"id\": \"round-1\",
    \"moves\": [],
    \"isFinished\": false
  }'"

echo -e "${GREEN}Step 3 - Add Moves:${NC}"
print_curl "curl -X POST '$BASE_URL/apiv2/games/flow-test-game/rounds/round-1/moves' \\
  -H 'Content-Type: application/json' \\
  -H 'If-Match: \"ETAG_FROM_STEP_2\"' \\
  -d '{
    \"id\": \"move-1\",
    \"userId\": \"user1\",
    \"value\": 10,
    \"valueDecorated\": \"ten\"
  }'"

print_curl "curl -X POST '$BASE_URL/apiv2/games/flow-test-game/rounds/round-1/moves' \\
  -H 'Content-Type: application/json' \\
  -H 'If-Match: \"ETAG_FROM_STEP_3\"' \\
  -d '{
    \"id\": \"move-2\",
    \"userId\": \"user2\",
    \"value\": 15,
    \"valueDecorated\": \"fifteen\"
  }'"

echo -e "${GREEN}Step 4 - Finish Round:${NC}"
print_curl "curl -X PATCH '$BASE_URL/apiv2/games/flow-test-game/rounds/round-1/finish' \\
  -H 'If-Match: \"ETAG_FROM_STEP_3\"'"

echo -e "${GREEN}Step 5 - Finish Game:${NC}"
print_curl "curl -X PATCH '$BASE_URL/apiv2/games/flow-test-game/finish' \\
  -H 'If-Match: \"ETAG_FROM_STEP_4\"'"

echo -e "${GREEN}Step 6 - Get Final State:${NC}"
print_curl "curl -X GET '$BASE_URL/apiv2/games/flow-test-game'"

echo ""
echo -e "${BLUE}📝 Testing Notes:${NC}"
echo "• Replace 'your-etag-here' with actual ETags from responses"
echo "• Update BASE_URL with your actual API Gateway URL"
echo "• ETags are required for PUT, PATCH, DELETE operations"
echo "• Use If-Match header for concurrency control"
echo "• Use If-None-Match header for conditional GET requests"
echo "• All requests should include proper Content-Type headers"
echo ""
echo -e "${GREEN}✅ Happy Testing!${NC}"
