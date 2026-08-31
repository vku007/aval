# Archived static site pages

Not part of the live tree in [`site/`](../../site/). Next `aws s3 sync site/ --delete` will drop these keys from the bucket.

**inroot.html**, **folder/infolder.html** — S3 path probes (`noindex`).

**test-auth.html** — cookie/API debug. Called `/apiv2/internal/users` a “public” endpoint and sent `accessToken` instead of the ID token.

**simple/** — split-pane auth playground, not linked from `/aval/`.

**html5/** — Phaser + Box2D prototype. Login went to `/login.html`; no `/apiv2/public` guest/login. Live game: [`site/html5Simple/`](../../site/html5Simple/).
