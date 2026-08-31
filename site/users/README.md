# User Manager

Admin UI at https://vkp-consulting.fr/users/. Hub: [../README.md](../README.md).

CRUD against `/apiv2/internal/users` with `Authorization: Bearer` from the `idToken` cookie. Needs Cognito group `admin`. Same pattern as Entity Manager (`/entities/`) and Game Manager (`/games/`).

Body: `{ "id", "name", "externalId" }`. ETag on PUT/PATCH/DELETE.
