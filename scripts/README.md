# Scripts

Cognito helpers and live API checks. Run from the **repository root**. User pool `eu-north-1_OxGtXG08i`, region `eu-north-1`. Needs AWS CLI, `jq`, and `curl`.

Auth walkthrough: [INTEGRATION_TEST_QUICKSTART.md](INTEGRATION_TEST_QUICKSTART.md). Architecture: [AUTH.md](../AUTH.md). Pages: [site/README.md](../site/README.md).

## Cognito users

```bash
./scripts/create-test-user.sh admin test-admin@vkp-test.local "Test Admin" TestAdmin123!
./scripts/create-test-user.sh user test-user@vkp-test.local "Test User" TestUser123!
./scripts/create-test-user.sh guest test-guest@vkp-test.local "Test Guest" TestGuest123!

./scripts/list-cognito-users.sh
./scripts/list-cognito-users-json.sh | jq '.[] | select(.email | contains("vkp-test.local"))'  # first page only

./scripts/reset-user-password.sh user@example.com NewPass123!
./scripts/delete-test-users.sh   # emails containing vkp-test.local
```

`create-test-user.sh` sets a permanent password, `custom:role` / `custom:display_name`, and the matching Cognito group.

## API checks

```bash
# Guest create + /external/me (no Hosted UI)
./scripts/test-guest-user.sh

# Internal file CRUD: admin → 200/201/204, user/guest → 403
./scripts/test-entity-endpoints.sh "$ID_TOKEN" admin
./scripts/test-entity-endpoints.sh "$ID_TOKEN" user
```

ID token: log in at the Hosted UI (`redirect_uri=https://vkp-consulting.fr/callback.html`), then in the browser console:

```javascript
const idToken = document.cookie.split('; ').find(c => c.startsWith('idToken=')).split('=')[1];
const payload = JSON.parse(atob(idToken.split('.')[1]));
console.log(payload.email, payload.role || payload['custom:role']);
console.log(idToken);
```

```bash
export ID_TOKEN='<paste>'
curl -H "Authorization: Bearer $ID_TOKEN" \
  https://wmrksdxxml.execute-api.eu-north-1.amazonaws.com/apiv2/external/me
```
