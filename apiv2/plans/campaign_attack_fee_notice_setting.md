# Hide the attack fee card

The fee card gains a checkbox, **do not show this window**. When that box is checked and the card closes, the player does not see the card again. The flag lives on the user document, beside `name`, `externalId`, and `campaigns`.

```json
"settings": {
  "hideAttackFeeNotice": true
}
```

A document with no `settings`, or with the flag absent or `false`, still opens the card. Only `true` hides it. This change writes `true`. It does not add a screen that turns the flag back off. The route still accepts `false`, so a later screen can.

## Stored on the user

`UserData` gains `settings`. `UserEntity` carries that object through `withCampaigns`, `fromUserProfile`, and `fromJSON`. A campaign save and a name change keep `settings`. A settings save keeps `campaigns`.

`S3UserRepository` and `FileUserRepository` read `settings` off the stored JSON and put it back on the user they return. Today both rebuild with the factory and `withCampaigns`, which would drop a field the constructor does not know.

`GET /apiv2/external/me` adds `settings` to the profile. Campaigns stay off that response. A missing object comes back as `{}`.

**PATCH** `/apiv2/external/me`, same auth as GET. `If-Match` is the user-document ETag. The body is only:

```json
{ "settings": { "hideAttackFeeNotice": true } }
```

The server merges that key into the stored `settings` and leaves every other key. Any other body key, or a non-boolean flag, is a 400. A missing or stale `If-Match` is a 412. The response is the profile plus the new `ETag`.

The map already holds this ETag from the campaign GET. The settings call uses that value. On success the map stores the returned ETag before it posts an attack, so the attack does not lose to its own settings write.

## The checkbox

Drawn on the fee card, under the sentence and above **ATTACK**. It starts unchecked. A tap on the box or its words toggles it. The toggle stays on the scene until the card closes.

| Close | Box checked | What is saved |
|---|---|---|
| **ATTACK** | yes | `hideAttackFeeNotice: true`, then the attack posts with the new ETag |
| **ATTACK** | no | The attack posts. Settings stay as they were. |
| **BACK** or the dim layer | yes | `hideAttackFeeNotice: true`. No attack. |
| **BACK** or the dim layer | no | The card closes. Settings stay as they were. |

A failed settings write does not block the close. **ATTACK** still posts. The card shows again next time. The registry `currentUser` and `gameAPI.user` take the saved profile when the write succeeds, so this session skips the card without a reload.

`CampaignOffers.hidesAttackFeeNotice(user)` is true only when `settings.hideAttackFeeNotice === true`. `onOffer` posts a fee attack directly in that case. The button label stays **Attack · Best of 5 · 10 copper**.

## Docs and checks

Update the current-user section in `apiv2/API_DOCUMENTATION.md` and the fee-card paragraph in `campaigns_ui.md`.

Domain tests: a user round-trip keeps `settings` and `campaigns` together; `withCampaigns` and a name change keep the flag; a stored document with no `settings` reads as show-the-card.

Client test: the helper is true only for a strict `true`.

Browser, after a reload so boot reads `GET /me`:

- The card shows the checkbox. **BACK** with it clear leaves the next **Attack** opening the card, and copper stays 16.
- **BACK** with it checked makes the next **Attack** post with no card.
- A reload still skips the card.
- Confirming **ATTACK** with the box checked spends the 10 copper and later attacks skip the card.
