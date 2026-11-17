# Campaign battle result scene

A win or a loss opens `CampaignBattleResultScene` before the map. **OK** returns to `CampaignMapScene`. The scene shows who won, which items were spent, and, on a player victory, the victory reward.

Autobattle already returns `battleOutcome`, and the map draws it as a notice with **DISMISS**. Play resolves the match inside `resolveFromGame` and drops that same object, so the map GET has no spent list and no reward. This plan keeps the outcome and gives both paths one scene.

## What the scene shows

Full screen on the 390×844 frame. White ground, black monospace, the same outline language as the catalog. One button, labeled **OK**.

| Line | When |
|---|---|
| **Victory** | `battleOutcome.result` is `victory`. The player won. |
| **Defeat** | `battleOutcome.result` is `defeat`. The defender won. Surrender is a defeat. |
| **Spent** plus the display phrase | `spent.items` has a count above zero. Same words as the inventory strip: Stone, Scissors, Paper, Stone NA, Scissors NA, Paper NA, Core. |
| **Gained** plus the display phrase | Victory only, and `reward` has a count above zero. Items and coins, so a gate can read **Gained 3 Stone, 1 Scissors, 1 Silver, 4 Copper**. |

A defeat has no Gained line. A victory whose reward is empty has no Gained line. A match that spent no items has no Spent line. The 10 copper fee is not in `spent` and is not added here. Leftovers are the items that came back, so they are not listed as spent.

Not on this scene: the round tally, Captured or Held, the defender's remaining stock, and the chapter score. After **OK**, a citadel win still opens the map's score sheet, because that sheet reads `campaign.score`.

## Who opens it

| End | Scene |
|---|---|
| Play move that finishes the match as a win or a loss | `CampaignBattleResultScene` |
| BACK on the play scene (Surrender, a loss) | `CampaignBattleResultScene` |
| Autobattle win or loss | `CampaignBattleResultScene` |
| Broken match, or Cancel attack before a throw | The map, as today. No result scene. |

`BlitzGameScene` is the campaign play scene. `GamePlayScene` still has the same campaign return, and it uses this scene too, so an old caller does not skip the result. A lobby match, `campaignId` absent, still opens `AdvancedGameResultsScene`.

**OK** starts `CampaignMapScene` with `{ instanceId }` and nothing else. The map GETs and draws. It does not open this scene again.

Start data is `{ instanceId, battleOutcome }`. The scene does not fetch. A missing outcome or a missing `instanceId` opens the map with `{ instanceId }` when that id exists, and `CampaignCatalogScene` when it does not.

## Where the outcome comes from

`applyBattle` already builds `battleOutcome` for a win and a loss, and returns `outcome: null` for a broken match. Today `resolveFromGame` and `repairCampaign` keep the campaign and drop the outcome. Autobattle is the only response that sends it.

Store it on the campaign as `lastBattleOutcome`.

- A win or a loss sets it to that outcome. `branch` and `finish` keep it, so a citadel victory still has it after the score is written.
- A broken match, a refund, and a cancel clear it.
- `toJSON` / `fromJSON` round-trip it. A document from before this field loads with it absent.
- The next accepted command clears it: End turn, Dig, Search, Upgrade, Buy, Attack, Leave. Autobattle replaces it with the outcome it just produced.

`GET /apiv2/external/campaigns/{id}` adds `battleOutcome` beside `campaign` when `lastBattleOutcome` is set. The campaign view itself stays unchanged. Repair that resolves a finished game saves the campaign with the outcome, and that GET includes it. A GET does not clear it.

Autobattle keeps its current body: `campaign` plus `battleOutcome`.

## How each path gets there

**Play.** On a campaign match over that is not broken, Blitz (and GamePlay) GET the instance. The body has `battleOutcome`: open the result scene with that object and `instanceId`. The body has none: open the map with `{ instanceId, settledGameId, settledOver: true }`, which is today's return. The map, only when it was started with `settledOver`, GETs, and if that body has `battleOutcome` it opens the result scene instead of drawing. A second GET that still shows `activeBattle` stays as it is. After that GET, the same rule applies.

**Autobattle.** The command response has `battleOutcome`. The map opens the result scene with it and does not draw. The map no longer shows the battle outcome notice or its **DISMISS** button.

**Broken.** No `battleOutcome`. The map opens and draws the refunded chapter.

Search still uses the found notice. That notice is not this scene.

## Docs and checks

Update the battle section in `campaigns_ui.md`, the return section in `campaign_blitz_play.md`, the campaign row in `site/html5Simple/SCENES.md`, and the `battleOutcome` paragraph in `apiv2/API_DOCUMENTATION.md`. GET may now carry `battleOutcome` until the next command. Autobattle is unchanged.

- Domain: a win stores the reward and the spent items, a loss stores spent and a null reward, a broken match clears it, a citadel finish keeps it, the next End turn clears it, and a document without the field reads as absent.
- Service: `resolveFromGame` then GET returns `battleOutcome`. Autobattle still returns it. A broken resolve does not.
- Client: `CampaignLabels.resultLines` is Victory or Defeat, Spent only when an item count is above zero, and Gained only on a victory with a reward. A defeat with a reward object still has no Gained line.
- Browser: win a fight from Play, read Victory, Spent, and Gained, **OK** lands on the map and the wallet includes the reward. Surrender, read Defeat and Spent, no Gained, **OK** lands on the map. Autobattle does the same and does not leave a notice on the map. A broken match opens the map and skips this scene. A citadel win shows this scene first, and **OK** then shows the score sheet.
