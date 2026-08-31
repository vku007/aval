#!/usr/bin/env node

/**
 * Extract ID Token from Browser
 * 
 * Usage:
 * 1. Open browser Developer Tools (F12)
 * 2. Go to Console tab
 * 3. Copy and paste this entire script
 * 4. Press Enter
 * 
 * The script will:
 * - Extract idToken from cookies
 * - Decode and display user info
 * - Copy token to clipboard (if possible)
 * - Show how to export for shell scripts
 */

(function() {
  console.clear();
  console.log('🔐 VKP Token Extractor');
  console.log('======================\n');

  // Get idToken from cookies
  const cookies = document.cookie.split('; ');
  const idTokenCookie = cookies.find(c => c.startsWith('idToken='));
  
  if (!idTokenCookie) {
    console.error('❌ Error: No idToken found in cookies');
    console.log('\n💡 Please login first:');
    console.log('   https://vkp-auth.auth.eu-north-1.amazoncognito.com/login?client_id=77e2cmbthjul60ui7guh514u50&response_type=code&redirect_uri=https://vkp-consulting.fr/callback');
    return;
  }

  const idToken = idTokenCookie.split('=')[1];
  
  // Decode token
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    
    console.log('✅ Token found!\n');
    console.log('👤 User Information:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Email:        ', payload.email || 'N/A');
    console.log('   User ID (sub):', payload.sub);
    console.log('   Role:         ', payload['custom:role'] || 'N/A');
    console.log('   Display Name: ', payload['custom:display_name'] || 'N/A');
    console.log('   Groups:       ', payload['cognito:groups']?.join(', ') || 'N/A');
    console.log('   Expires:      ', new Date(payload.exp * 1000).toLocaleString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.warn('⚠️  WARNING: Token is EXPIRED!');
      console.log('   Please logout and login again.\n');
    } else {
      const minutesLeft = Math.floor((payload.exp - now) / 60);
      console.log(`✅ Token is valid (expires in ${minutesLeft} minutes)\n`);
    }
    
    // Show token
    console.log('📋 ID Token (for API requests):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(idToken);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Try to copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(idToken).then(() => {
        console.log('✅ Token copied to clipboard!\n');
      }).catch(() => {
        console.log('⚠️  Could not copy to clipboard automatically\n');
      });
    }
    
    // Show usage examples
    console.log('💡 Usage Examples:\n');
    
    console.log('1️⃣  Export for shell scripts:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`export ID_TOKEN="${idToken}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('2️⃣  Test API endpoint:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`curl -H "Authorization: Bearer ${idToken.substring(0, 50)}..." \\`);
    console.log('  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('3️⃣  Run integration tests:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`export ADMIN_TOKEN="${idToken.substring(0, 50)}..."`);
    console.log('./scripts/test-entity-endpoints.sh "$ADMIN_TOKEN" admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Store in window for easy access
    window.VKP_TOKEN = idToken;
    window.VKP_USER = payload;
    
    console.log('4️⃣  Access in console:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   window.VKP_TOKEN  // Full token string');
    console.log('   window.VKP_USER   // Decoded user info');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Error decoding token:', error.message);
  }
})();

