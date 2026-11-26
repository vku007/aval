# Campaign turn caps

Extended games already take `max_stone_per_turn`, `max_scissors_per_turn`, and `max_paper_per_turn` on create. Omit a field and the game uses 9, 4, and 7. The match client reads those three numbers from `payload.gameContext` and refuses a larger throw. Campaign battles never pass them, so every campaign match uses 9, 4, and 7.

This plan stores the same three numbers on the chapter rules, copies them onto the run at start, and passes them into the battle game. The campaign editor shows them. Chapter I writes the current defaults, so a new Chapter I match plays as it does today.

## Decisions

1. **Lobby create stays as it is.** `GameCreateContext` already accepts the three fields for `kind: extended`, defaults an omitted field, and rejects a value that is not an integer >= 1. Classic games still omit them. No new game-create field.

2. **Campaign rules use the same names as the other rule fields.** Stored keys are `maxStonePerTurn`, `maxScissorsPerTurn`, and `maxPaperPerTurn`. The battle builder maps them onto `max_stone_per_turn`, `max_scissors_per_turn`, and `max_paper_per_turn` when it builds `GameCreateContext`.

3. **Each value is an integer >= 1.** No upper bound, same as a lobby game. A cap larger than the stack is legal: the throw is still limited by stock.

4. **A missing value is the current default.** 9 stones, 4 scissors, 7 papers. That covers a run saved before this change, and a chapter file that omits the keys. The next attack on that run builds a game at 9, 4, and 7.

5. **Chapter I writes 9, 4, and 7 and stays on ruleset 2.** The numbers match the engine defaults, so the pace score is the same match. Editing them later is a rules change. The editor's existing warning still fires when `rulesetVersion` stays put.

6. **A run keeps the copy it started with.** Editing `chapter-i.json` does not change an open instance. A match already created keeps the caps on that game's `createContext`.

7. **The map does not grow a new control.** The throw UI already follows `gameContext`. The instance view still publishes the three integers so a client can read the rule before the match exists.

## Where the numbers live

| Place | Shape |
|---|---|
| `chapter-i.json` `rules` | `maxStonePerTurn: 9`, `maxScissorsPerTurn: 4`, `maxPaperPerTurn: 7` |
| Stored instance `rules` | Same three keys, copied at start. Absent on an older save. |
| Instance view `campaign.rules` | The three integers, filled with 9, 4, and 7 when the stored rules omit them. |
| Battle `createContext` and `gameContext` | `max_stone_per_turn`, `max_scissors_per_turn`, `max_paper_per_turn` |

`economyConsumesActionPoint` and `actionPointsPerTurn` stay off the view, as they do now.

## Server

`StoredRules` in `Tile.ts` gains the three optional numbers.

`rulesSchema` in `ChapterSettingsSchema.ts` accepts each as an optional integer >= 1. `0`, a fraction, and a negative number fail the schema. A file that omits them still parses. `ChapterFileSchema` keeps that, including a file that still has the linear score weights.

One reader, used by the view and by battle setup:

```ts
turnCapsOf(rules) -> { maxStonePerTurn: 9, maxScissorsPerTurn: 4, maxPaperPerTurn: 7 }
```

A present integer is kept. Anything else uses the default for that gesture. Put it next to `StoredRules` so the editor, the view, and the battle path share it.

`publishedRules` adds the three resolved integers.

`BattleGameSpec` gains the three numbers. `CampaignService.attack` sets them from `turnCapsOf(begun.rules)` before `createBattle`. `buildBattleGame` passes them into `GameCreateContext`. The processor, the NPC, and autobattle already call `capFor`. They need no new branch.

`SimulationInput` gains the same three numbers. `simulateBattles` puts them on the spec it already builds. The editor simulation then fights under the caps on the document, not under a hardcoded 9, 4, and 7.

Chapter I: add the three keys at the end of `rules` in `chapter-i.json`. `ChapterDefinitionBuilder` clones `settings.rules`, so the definition picks them up. Refresh `chapter-i.definition.json` so `CHAPTER_I` still deep-equals that fixture.

## Editor

`RulesPanel` gets a **Turn caps** group under the action-point fields:

| Label | Key | Start |
|---|---|---|
| Max stone per turn | `maxStonePerTurn` | 9 |
| Max scissors per turn | `maxScissorsPerTurn` | 4 |
| Max paper per turn | `maxPaperPerTurn` | 7 |

Each control is an `IntField` with `min` 1. Commit sends `setRules` with that one key. No new action type.

`writeRules` appends the three keys after `actionPointsPerTurn`, using `turnCapsOf` so an imported file that omitted them exports 9, 4, and 7. Key order of the existing rules stays. A load of today's `chapter-i.json` after this change, exported with no edits, matches the file bytes.

The simulation input in `SimulationPanel` passes `turnCapsOf(settings.rules)`.

## Docs

Update when the code lands:

- `campaigns.md` — Chapter I rules list the three caps and say a stored run without them plays at 9, 4, and 7.
- `campaigns_api.md` — the published `rules` list includes the three integers.
- `API_DOCUMENTATION.md` — the campaign instance view lists them beside the other published rule fields. The game-create table already documents the snake_case fields and stays as it is.

## Tests

- Schema: bundled `chapter-i.json` still parses equal to itself. `maxStonePerTurn: 0` fails at `rules.maxStonePerTurn`. A file with the keys removed still parses.
- `turnCapsOf`: missing keys are 9, 4, and 7. A stored 2 is kept.
- `buildBattleGame`: a spec with stone 2, scissors 3, paper 5 stores those on `createContext`. The existing spec, which omits them, still builds. Give the builder call the defaults so the type stays required on the spec and the defaulting stays in `turnCapsOf`.
- Attack: a Chapter I attack creates an extended game whose `createContext` is 9, 4, and 7. A definition whose rules set stone to 2 creates a game with `max_stone_per_turn` 2.
- View: `campaign.rules` on a new start includes 9, 4, and 7. An instance loaded without the keys still publishes 9, 4, and 7.
- Editor: changing Max stone per turn dispatches `setRules`. Serialize key order ends with `maxStonePerTurn`, `maxScissorsPerTurn`, `maxPaperPerTurn`. The simulation input carries the document's caps.

`npm test` in `apiv2` and the campaign-editor test script. No Terraform, no Lambda deploy, no static-site publish in this change.
