# Unavailable tile — barrier

Status: implemented.

A designer marks a hex **unavailable**. The player can see it, cannot attack it, and cannot capture it. The hex is a wall: expansion goes around it, because a captured tile is the only new place an attack can start.

The fight rules for this already exist. `ServerTile.enabled === false` is rejected by attack, dig, search, and upgrade, pays no income, and is not an attack origin. The view is `visibility: "blocked"`. The map already draws that as a gray hex with no Attack button. Chapter settings never write it: `buildChapterDefinition` sets `enabled: true` on every tile, and the editor was built with disabled tiles out of scope (`campaign_editor.md`).

This plan is the authoring flag, the checks that keep a wall from also being a fight, and the words on the map. Chapter I stays as it is until a designer paints a wall. No `rulesetVersion` bump for shipping the flag with zero walls.

## What the player experiences

An unavailable hex is not a fight and not a mine.

- Attack is refused. The sheet has no Attack button. The server answers `That tile is blocked`.
- Dig, search, and upgrade are refused. The hex is never owned, so those commands never apply.
- It pays nothing on End Turn.
- It is never an objective. Capturing the objective still wins; walls are not part of the win.
- It does not become a place you attack from. Taking the hex beside a wall does not let you step onto the wall and strike the far side.

Fog is unchanged. `revealed` is a separate flag.

- A wall that starts revealed is a gray hex from the first look.
- A wall that starts hidden is an empty gray stroke until a capture next to it reveals it. The reveal then shows the wall, not a fight.
- Capturing a neighbor reveals the wall. The wall itself is never captured, so it never reveals the hexes beyond it.

Two hexes that already share a side stay neighbors. A wall does not cut that shared side. It only removes its own hex from the path. To seal a region, the wall hexes have to leave no capturable path from the camp to that region.

The cell mark stays blank. The sheet says **Unavailable**. The attackable outline (the heavy stroke) is only for a seen fight that touches an owned hex, so a wall never gets it.

## Authoring

On a tile in chapter settings, `unavailable: true`. Omit the key when the tile can be fought or is the camp. Same omission rule as `objective`.

Setting the flag clears the fight. One editor action does all of this, as one undo step:

| Field | Unavailable tile |
|---|---|
| `unavailable` | `true` |
| `owner` | omitted (not `player`) |
| `objective` | omitted |
| `difficulty` | `null` |
| `reward`, `stash`, `defenderKit`, `npcAlgorithmId` | omitted |
| `mines`, `maxMines` | `0`, `0` |
| `product` | kept, ignored by the game. The file schema still requires a product. |
| `label`, `revealed` | kept |

Turning the flag off restores a normal neutral fight: difficulty `easy`, mines `1`, max mines `1`, no kit, no reward, no stash. Label, product, and revealed stay.

The definition builder maps the flag onto the tile the game already understands:

- `enabled: false`
- `owner: null`
- `garrison: null`
- `difficulty: null`, `rounds: null`
- `objective: false`
- `mines: 0`, `maxMines: 0`
- `stashes: []`
- `victoryReward` empty
- `product` still stored, never read, because income and dig require `enabled` and a player owner

`validateTile` today requires a garrison on every tile the player does not own. An unavailable tile is the exception: no garrison.

A run already in progress keeps the tiles it started with. The flag applies to the next start.

## Checks

Errors block Export, Save, and the Lambda load. Warnings do not.

| Code | Level | When |
|---|---|---|
| `unavailable-owned` | error | `unavailable` and `owner: "player"` |
| `unavailable-objective` | error | `unavailable` and `objective: true` |
| `unavailable-field` | error | `unavailable` and any of `difficulty` other than `null`, `reward`, `stash`, `defenderKit`, `npcAlgorithmId` |
| `unavailable-mines` | error | `unavailable` and `mines` or `maxMines` is not 0 |
| `difficulty-missing` | error | unchanged, except an unavailable tile is skipped. It has no battle. |
| `mines-range` | error | unchanged for a fight. An unavailable tile is allowed to be `0` / `0`, which the current check rejects (`maxMines` must be at least 1). |
| `objective-sealed` | warning | No path of capturable hexes from an owned tile to an objective. Walk from every owned hex through neighbors that are not unavailable. |
| `tile-sealed` | warning | A fight or a stash that the same walk cannot reach. A pocket behind a wall can never be played. |

`neighbor-hidden` still applies. A wall beside the camp that is not revealed gets that warning, so the opening barrier is visible unless the designer hides it on purpose.

## Editor

`tools/campaign-editor`.

- Tile panel: a checkbox, **Unavailable**. On when every selected tile has the flag, mixed when the selection disagrees. Checking it runs the clear above. Unchecking it restores the neutral fight.
- While the tile is unavailable, hide difficulty, NPC, reward, kit, stash, objective, and the mine numbers. Product, label, and revealed stay.
- Map, design overlay: a solid fill distinct from easy / normal / hard / player (`hex-fill-unavailable`). No mine glyph. No difficulty letter.
- Map, start overlay: a revealed wall uses the same fill; a hidden wall stays the hidden hatch. The start view already comes from the definition, so `visibility: "blocked"` is the source once the builder sets `enabled: false`.
- Brush: **Unavailable**, same gesture as the difficulty brush. Painting a tile that is already unavailable does nothing. Painting the camp is allowed and clears ownership in that same stroke, because a wall cannot be the camp.
- Simulation list skips these tiles (it already skips `difficulty === null`).
- A route step that attacks one fails in `walkRoute` with the server's blocked error. No special case in the walker.

## Game client

`site/html5Simple`. The draw and the Attack offer already key off `visibility`.

- `CampaignOffers.tileSheet` says **Unavailable** where it now says **Blocked**. No actions.
- `CampaignHex.adjacentToOwned` stays false unless `visibility === "seen"`, so the wall gets no attack stroke.
- `CampaignMapScene.drawHex` keeps the gray fill for `blocked`.

No new command. The client still does not decide legality; the server does.

## Files

| Change | Where |
|---|---|
| `unavailable` on the tile schema; the checks in the table | `apiv2/src/domain/campaign/ChapterSettingsSchema.ts` and `ChapterSettingsChecks.test.ts` |
| `enabled: false`, no garrison, mines 0 | `apiv2/src/domain/campaign/ChapterDefinitionBuilder.ts` and its test |
| Attack of an unavailable hex throws; a neighbor capture reveals it as blocked and does not open an attack from it | `apiv2/src/domain/campaign/Campaign.test.ts` |
| Sheet word | `site/html5Simple/js/campaign/offers.js`, `site/html5Simple/js/campaign/campaign.test.js` |
| Checkbox, brush, fill, one-step clear and restore | `tools/campaign-editor/src/model/document.ts`, `serialize.ts`, `panels/TilePanel.tsx`, `map/HexMap.tsx`, `map/useBrush.ts`, `map/MapTools.tsx`, and their tests |
| Settings key and the sheet word | `apiv2/plans/campaigns.md`, `apiv2/plans/campaigns_ui.md` |

Chapter I's JSON is not edited by this work.

## Out of this plan

A wall graphic beyond the gray fill, a wall that blocks a shared side between two other hexes, moving or adding hexes, more than one objective, and placing walls into Chapter I.
