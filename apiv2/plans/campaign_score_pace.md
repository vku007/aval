# Campaign score — pace

Implemented. [campaigns.md](./campaigns.md) and [chapter_i_gameplay.md](./chapter_i_gameplay.md) match. Chapter I `rulesetVersion` is 2.

A run already started keeps the weights copied at its start and the formula those weights name. This page does not rewrite a stored total.

## The number

Eight battle wins in sixteen turns, with no silver or copper kept above the start, score **1000**.

Each victory is 125 points. Sixteen turns is two turns for each of those eight victories, and that pace is the zero line. A turn inside the pace leaves the battle score as it is. A turn past the pace subtracts 50. Silver and copper still in the wallet above the starting wallet add.

```
pace      = victories × 2
extra     = max(0, turns − pace)
resources = silver × 25 + copper × 1
total     = max(0, victories × 125 − extra × 50 + resources)
```

`turns` and `victories` mean what they mean today. `turns` is `turnNumber + 1`, so the turn the citadel falls is counted. `victories` is owned tiles minus the camp. A lost battle adds a turn and no victory. `silver` and `copper` are `max(0, wallet − start)` after the citadel reward is in the inventory. Spending a coin down to the start contributes nothing. The total is an integer, frozen at victory. Leave and an external finish still store no score.

Check the anchor: `8 × 125 − max(0, 16 − 16) × 50 + 0 = 1000`.

## What a turn is for

Two turns are budgeted per victory. One of them is the attack. The other is the economy turn: dig, search, upgrade, buy, or End Turn while a new mine pays. Using that second turn collects the resources that add. Spending a third turn on the same victory is the additional turn, and it costs 50.

A first loss on a clear that was otherwise one attack per turn uses the spare turn. The battle score stays. The loss has already taken the turn that could have been a silver hex. A further loss, or a loss on top of a detour that already used the spare, crosses the pace and is fined 50 per turn.

Finishing faster than the pace does not add a speed bonus. The points for being early are the resources that fit inside the budget, and the victories themselves. Eight victories in fifteen turns score the same 1000 as eight in sixteen, before resources. Eight in seventeen score 950.

## Resources

| Kept above the start | Points | What one additional turn costs |
|---|---|---|
| 1 silver | 25 | 2 silver ties the 50-point fine |
| 1 copper | 1 | 50 copper ties the fine |

Gold, stones, scissors, papers, and effects stay off the score. They are the army that wins the battles. The coins are what a clear keeps.

Copper income is how a stuck run pays the next fee. It is a weak score. The camp pays 2 copper a turn, which is 2 points, against a 50-point fine once the pace is used up. Waiting on the camp to farm a total is a loss on the sheet.

Silver is the collection that can pay for a late turn. Two silver is an exact tie with one additional turn, before the victory those turns may also have taken.

## The sheet

The stored object stays `{ total, turns, victories, silver, copper }`. The amounts are the inputs. The client builds the lines from `rules.scoreWeights` of that run.

New weights, in this order:

```json
"scoreWeights": {
  "perVictory": 125,
  "turnsPerVictory": 2,
  "perExtraTurn": 50,
  "perSilver": 25,
  "perCopper": 1
}
```

There is no base. The 1000 is `8 × perVictory` at zero extra turns.

Lines, top to bottom:

| Line | Text | Amount |
|---|---|---|
| Victories | `Victories {n} × 125` | add `n × perVictory` |
| Turns | `Turns {turns}, pace {victories × turnsPerVictory}, extra {extra} × 50` | subtract `extra × perExtraTurn` |
| Silver gained | `Silver gained {silver} × 25` | add |
| Copper gained | `Copper gained {copper} × 1` | add |
| Total | `Total {total}` | the stored total |

`extra` is `max(0, turns − victories × turnsPerVictory)`. A zero extra line still shows, so a clear on pace can be read as a fine of 0.

## Rows

| Run | Turns | Wins | Extra | Silver | Copper | Total |
|---|---|---|---|---|---|---|
| Anchor | 16 | 8 | 0 | 0 | 0 | 1000 |
| One turn past the pace | 17 | 8 | 1 | 0 | 0 | 950 |
| One turn inside the pace | 15 | 8 | 0 | 0 | 0 | 1000 |
| One turn past, paid by 2 silver | 17 | 8 | 1 | 2 | 0 | 1000 |
| On pace, 5 silver and 10 copper kept | 16 | 8 | 0 | 5 | 10 | 1135 |
| Chapter I rush: gate, citadel | 2 | 2 | 0 | 3 | 0 | 325 |
| South pile, gate, citadel | 3 | 3 | 0 | 5 | 0 | 500 |
| That path plus one more easy hex | 4 | 4 | 0 | 5 | 0 | 625 |
| One lost gate, then the rush | 3 | 2 | 0 | 3 | 0 | 325 |
| Losses that push the rush to 5 turns | 5 | 2 | 1 | 3 | 0 | 275 |

Chapter I silver on the rush is the gate's 1 and the citadel's 2. The south pile adds 2. Copper above the starting 16 stays 0 on these routes, because each attack spends 10 and the rewards do not climb back to 16.

A clear that takes more land, inside two turns per victory, scores higher. The citadel still ends the chapter. The pace is what punishes camping and a second loss. The old ruleset, where a two-fight rush could beat a wider walk, is the formula these weights replace.

## Old runs

`campaignScore` keeps today's formula when the stored weights have `base` and `perTurn`:

```
max(0, base − turns × perTurn + victories × perVictory + silver × perSilver + copper × perCopper)
```

It uses the pace formula when the stored weights have `perExtraTurn` and `turnsPerVictory`. A run started on ruleset 1 never changes formula. A new start of Chapter I copies the pace weights and `rulesetVersion` 2.

Goal text for that new start: "Take the citadel. Each victory is 125. Two turns per victory stay free. Further turns cost 50. Silver and copper you keep are added. Eight victories in sixteen turns score 1000."

## When this is built

- `CampaignScore.ts` branches on the weight shape. The anchor row is a test: 8 victories, 16 turns, 0 silver, 0 copper, total 1000. The next tests are the rows in the table above, including the floor at 0 for a long camp.
- `chapter-i.json`, the Chapter I fixture, and `ChapterSettingsSchema` carry the new weights. The editor serializer writes those five keys and drops `base` and `perTurn`.
- `scoreLines.js` prints the five lines above from the new weights, and still prints today's lines when `perTurn` is present.
- `campaigns.md` and `chapter_i_gameplay.md` replace the ruleset-1 formula and the 200 / 210 / 180 / 150 tuning rows with this table.
- The catalog and the map sheet already show the stored total and the lines from that run's weights. They need no second score.
