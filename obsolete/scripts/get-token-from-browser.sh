#!/bin/bash

# Extract ID Token from Browser Cookies
# 
# This script helps you get the token from your browser.
# Since we can't directly access browser cookies from shell,
# this provides instructions and a JavaScript snippet.

cat << 'EOF'
🔐 How to Get Your ID Token
============================

Method 1: Browser Console (Easiest)
────────────────────────────────────

1. Open any VKP page: https://vkp-consulting.fr/
2. Press F12 to open Developer Tools
3. Go to "Console" tab
4. Paste this code and press Enter:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const idToken = document.cookie.split('; ').find(c => c.startsWith('idToken=')).split('=')[1];
const payload = JSON.parse(atob(idToken.split('.')[1]));

console.log('\n✅ Token extracted!\n');
console.log('User:', payload.email);
console.log('Role:', payload['custom:role']);
console.log('\nCopy this token:\n');
console.log(idToken);
console.log('\n');

// Copy to clipboard
navigator.clipboard.writeText(idToken);
console.log('✅ Token copied to clipboard!');

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. Token is now in your clipboard!
6. Export it in your terminal:

   export ID_TOKEN="<paste-token-here>"


Method 2: Browser DevTools (Manual)
────────────────────────────────────

1. Open https://vkp-consulting.fr/
2. Press F12 → Go to "Application" tab (Chrome) or "Storage" tab (Firefox)
3. Expand "Cookies" → Click on "https://vkp-consulting.fr"
4. Find "idToken" cookie
5. Copy the entire Value
6. Export in terminal:

   export ID_TOKEN="<paste-token-here>"


Method 3: Use the JavaScript Helper
────────────────────────────────────

1. Open https://vkp-consulting.fr/
2. Press F12 → Console tab
3. Run this command to load the helper:

   fetch('https://vkp-consulting.fr/scripts/get-token.js').then(r => r.text()).then(eval)

4. Follow the on-screen instructions


Quick Test
──────────

After exporting ID_TOKEN, test it:

# Test external endpoint (any authenticated user)
curl -H "Authorization: Bearer $ID_TOKEN" \
  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me

# Test internal endpoint (admin only)
curl -H "Authorization: Bearer $ID_TOKEN" \
  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/internal/files


For Integration Tests
─────────────────────

# Get tokens for different test users:

# 1. Login as test-admin@vkp-test.local
# 2. Get token (Method 1 above)
# 3. Export:
export ADMIN_TOKEN="<admin-token>"

# 4. Login as test-user@vkp-test.local
# 5. Get token
# 6. Export:
export USER_TOKEN="<user-token>"

# 7. Run tests:
./scripts/test-entity-endpoints.sh "$ADMIN_TOKEN" admin
./scripts/test-entity-endpoints.sh "$USER_TOKEN" user


Troubleshooting
───────────────

❌ "Cannot read property 'split' of undefined"
   → You're not logged in. Login first.

❌ "Token is EXPIRED"
   → Logout and login again to get fresh token.

❌ "401 Unauthorized"
   → Token is invalid or expired. Get a new one.

❌ "403 Forbidden"
   → You don't have the required role.
   → For admin endpoints, you need admin role.

EOF

