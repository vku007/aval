# Campaign play uses Blitz

Campaign PLAY opens `BlitzGameScene` on the match Attack already created. The lobby BLITZ GAME button still creates its own extended best-of-5. Tests still open `ExtendedGameScene`.

No API change. Attack already stores an extended PvE game. Blitz already reads that payload: player stacks from `playerContext.inventory`, NPC stacks from `enemyContext.inventory`, the score, the last throw, and `gameContext.initGameContext.rounds`. A gate is best of 5. The citadel is best of 7, and the health bars already size themselves from that string.

## What opens

`CampaignMapScene.onPlay` starts `BlitzGameScene` with `{ gameId, campaignId, returnTo: 'CampaignMapScene' }`. It does not call `createGame`.

`BlitzGameScene.init` keeps those three fields. `startMatch` then branches:

| Start data | What the scene does |
|---|---|
| `gameId` set | `getGame` that id. The scene never calls `createGame`. |
| `gameId` absent | Today's lobby create: PvE, `BO5`, extended, level `Level1`, `campaign.name` `Episode1`. |

The throw stacks still start empty. A resumed battle shows the score, the last stage line, and the inventories that are left. It does not rebuild earlier throws as heat objects.

## How a campaign match ends

When `campaignId` is set, Blitz follows the return rules that `GamePlayScene` already uses.

- BACK sends `Surrender`, then opens `CampaignBattleResultScene`. The match is a loss. Items still in the game inventory return. The 10 copper and the action point stay spent. **OK** opens the map.
- A move that finishes as a win or a loss opens `CampaignBattleResultScene`. A broken match opens the map with `{ instanceId, settledGameId, settledOver: true }`. Neither opens `AdvancedGameResultsScene`. The map GETs, and GETs once more if that battle is still open. When that arrival was `settledOver` and the GET carries `battleOutcome`, the map opens the result scene.
- `created` and `started` stay on the scene. Match over for this path is `SimpleGameSceneUtil.isCampaignMatchOver`, which includes `broken`.

When `campaignId` is absent, nothing here changes. BACK goes to `GameSelectScene`. A finished lobby match opens `AdvancedGameResultsScene`. `isGameFinished` still ignores `broken`.

`GamePlayScene` keeps its campaign return. Tests can still open `ExtendedGameScene` with a `campaignId`. The map no longer does.

## What this switch does not add

Blitz keeps the two effect toggles it has: NEG (`NegateSize`) and SIZE (`SizeOnly`). OVER (`Overpower`) and PROT (`Protection`) stay on the server and on autobattle. They are not added to the heat scene in this change.

The map, the fee, the wager path, and the storage tables stay as they are. A campaign game's human row is the whole campaign item stack, and the NPC row is the garrison. Those counts are what the tables draw after `getGame`.

## Docs and checks

Update the Play sentence in `campaigns_ui.md`, the campaign row in `site/html5Simple/SCENES.md`, and the BACK sentence in `campaign_attack_fee.md`.

Browser check, with the local API and the page on port 8099:

- Choose a game, BLITZ GAME: a new game is created, BACK returns to that menu, and a finished match opens the results scene.
- Campaign PLAY: the request is `getGame` for `activeBattle.gameId`, not `createGame`. The tables show the campaign stacks and the garrison. A best-of-7 tile shows four health bars on each side.
- BACK from that match returns to the map, the battle is gone, and the items are back in the campaign wallet. The fee and the action point stay spent.
- A played win returns to the map with the tile owned. The results scene does not open.
- Tests, EXTENDED GAME, still opens `ExtendedGameScene`.
