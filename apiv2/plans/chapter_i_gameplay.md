# Chapter I — gameplay

How a run of Chapter I feels in the hand. The rulebook is [campaigns.md](./campaigns.md). The numbers live there and in `ChapterI.ts`. When this page and those disagree, those win.

Goal the player can read: **Take the citadel. Each victory is 125. Two turns per victory stay free. Further turns cost 50. Silver and copper you keep are added. Eight victories in sixteen turns score 1000.**

## The promise

Chapter I is a short hex campaign wrapped around the extended rock-paper-scissors match. The player starts with a camp, a full kit, and sixteen copper. The citadel sits two steps due north, behind one gate. Everything else on the map is a choice about whether that step is worth a turn.

Each fight inside the pace adds 125. The bare rush is two fights and scores 325. The south stash, the gate, and the citadel are three fights and score 500 when the citadel fee can be paid. A turn past two per victory costs 50. The land still offers silver, scissors, and a safer rematch if the gate goes badly.

There is no defeat screen. Land, once taken, stays taken. An empty wallet leaves the run open. The player can wait on the camp's copper, buy what they are short, or leave. Leaving writes no score.

A match started from the lobby is a different game. It does not touch this wallet or this map.

## The board

Nineteen flat-top hexes, radius 2, north up. The camp is the center. A tile shares a side with six others: northeast, north, northwest, southwest, south, southeast. A square diagonal is empty ground.

```
                 (0,-2) citadel, hard
          (-1,-1) stash        (1,-2) stash
    (-2,0) easy   (0,-1) gate       (2,-2) easy
 (-2,1) easy  (-1,0) easy   (1,-1) easy   (2,-1) easy
    (-2,2) easy   (0,0) camp        (2,0) easy
       (-1,1) easy    (1,0) easy
          (-1,2) easy (0,1) south stash  (1,1) easy
                      (0,2) easy
```

At the start the player sees the camp and the six hexes that touch it. The outer twelve are fog: a gray hex, no name, no length, no attack. The citadel is in that fog.

The player attacks only a seen hex that shares a side with land they already own. Taking a hex reveals each of its neighbors. The first time the citadel can appear is the moment the gate falls, because the gate is the only hex that touches both the camp and the citadel. Two stash tiles sit on the citadel's shoulders, `(-1,-1)` and `(1,-2)`. They appear in the same reveal.

The gate is the only normal fight. The citadel is the only hard fight, and the only best of 7. Every other neutral hex is easy and best of 5.

Before a fight, a seen hex tells the player its difficulty and its length. It does not tell them the garrison's stack, the mine, or whether a stash is buried there. Those are learned by owning the hex, and, for a garrison, by losing to it.

On the map the cells stay short: `E`, `N`, `H`, a star on the objective, and on owned land a product mark with mines over the cap (`C 1/3` on the camp). The sheet under the map speaks the full words.

## What the player brings

| | Count | What it is for |
|---|---|---|
| Stones | 14 | Two played-out best-of-5 fights, with a little over. A throw may be as large as 9. |
| Papers | 14 | Same. A throw may be as large as 7. |
| Scissors | 10 | The thin stack. A throw may be as large as 4, and a played-out fight spends about 4. |
| Stone NA, Scissors NA, Paper NA | 2 each | One size effect on a throw of that gesture. |
| Core | 2 | One type effect on a throw. |
| Copper | 16 | The attack fee is 10. What remains pays a dig (4), a search (6), or an upgrade (6). |
| Silver, gold | 0 | Silver is found. Gold is unused in this chapter. |

The whole item stack moves into every attack. The player does not pack a squad. Copper left after the fee, and any silver already found, stay on the campaign. The defender brings that tile's garrison and nothing from the player's stores.

## A turn

The counter on the map starts at 1. That number is the turn the score will charge if the citadel falls now.

The player has one attack for the turn. It is spent only by a committed attack. Dig, search, upgrade, and the shop leave it alone. An unused attack is not saved; End Turn sets the budget back to one.

A quiet turn, the one the score likes, looks like this:

1. Optional work on land already owned: dig a mine, search a stash, raise a mine, or buy the gesture that is short.
2. Attack one neighboring hex, if the wallet has 10 copper.
3. Play the match, or let autobattle play it.
4. Read the result. On a win the new land can be dug or searched on this same turn. On a loss the camp can still be worked.
5. End Turn. Owned mines pay. The attack comes back. The counter advances.

End Turn is legal with the attack unspent. It is refused while a match is open, so the player cannot collect income with the army still on the field.

Income arrives at End Turn, from tiles owned before that command. A hex taken this turn pays on the next End Turn. The citadel's mine never pays: taking it ends the chapter before another End Turn.

## The fight

Attack debits 10 copper, spends the attack, and opens an extended match against `NPC_1`. The player's row is every campaign item. The defender's row is the garrison.

| Defender | Stones | Scissors | Papers | Effects in the garrison | Length | Rounds to take it |
|---|---|---|---|---|---|---|
| Easy | 6 | 3 | 4 | none | Best of 5 | 3 |
| Gate | 9 | 4 | 7 | 1 Stone NA | Best of 5 | 3 |
| Citadel | 12 | 8 | 8 | one NA of each gesture, 1 Core | Best of 7 | 4 |

The garrison's effects are stock. The Chapter I defender, `npc-v1`, throws a size and no effect. It picks a size from 1 through the smaller of the gesture cap and the stock it has left. The citadel is harder because the match is longer and the stacks are deeper, so the player spends more and the defender lasts longer. An easy garrison is the light fight because it runs out.

A throw is a gesture and a size. Different gestures follow rock-paper-scissors, and the size is ignored. The same gesture goes to the higher size; equal sizes draw. A draw spends both throws and does not give a round to either side. The match ends when one side has the rounds it needs. There is no drawn chapter battle.

The player may put one size effect and one type effect on a throw:

| Effect | Paid with | What it does |
|---|---|---|
| Overpower | the NA of the thrown gesture | On a same-gesture compare, this throw wins. |
| Negate Size | the NA of the thrown gesture | On a same-gesture compare, the throw draws. |
| Protection | a Core | A loss on gesture type becomes a draw. A loss on size stays a loss. |
| Size Only | a Core | Gesture type is set aside and the size decides. |

The defender throws none of these, so a spent effect is always the player's. Autobattle spends them on a fixed cycle a careful hand can beat: stone 3 with Overpower on the first stone, paper 3, scissors 2, stone 3, paper 3 with Protection on the first paper that can pay a Core, scissors 2, then the cycle again. A gesture the stack cannot pay is skipped. No legal gesture is a surrender, and a surrender is a loss.

Before the first throw, the player can step back. The copper, the items, and the attack all return, and the hex is untouched. After a throw has been played, that door is shut. Leaving the match then is a surrender: the battle is lost, the fee stays spent, and whatever was not thrown comes home.

A played-out best of 5, the planning case of a 3–2 with one draw, spends about 6 stones, 4 scissors, 6 papers, and one effect of each kind. A 3–0 spends about half of that and no effect. The citadel, played out, asks for about a third more gestures and one or two effects. The opening kit covers two best-of-5 fights with a margin, and it is tight if the citadel goes the distance after a messy gate.

## After the fight

**Win.** Leftover items come back. The 10 copper stays spent. The hex's reward is added. The hex becomes the player's, its neighbors are revealed, and the garrison is gone. Its leftovers are not loot. The attack stays spent until End Turn.

**Loss.** Leftovers come back. Thrown items stay spent. The reward is withheld. The hex stays neutral, and the fog stays as it was. The garrison keeps what it did not throw, and the player can now see that remainder. The next attack on this hex faces that remainder. An empty garrison can still be attacked; with nothing to throw, the defender surrenders.

**Broken match.** The items, the 10 copper, and the attack return. The hex is unchanged.

Rewards, on top of whatever came back from the match:

| Hex | Reward |
|---|---|
| Easy, gesture mine | 2 of that gesture, 2 copper |
| Easy, copper mine | 4 copper |
| Gate | 3 stones, 1 scissors, 4 copper, 1 silver |
| Citadel | 4 papers, 2 stones, 1 Core, 8 copper, 2 silver |

Taking the citadel ends the run in the same moment. The reward and the leftovers are already in the wallet when the score is written. Buttons for another attack, another dig, or another End Turn are gone. The map remains, with the score in place of the action sheet.

## The land pays

Every hex has one product. A mine pays `mines × unit` of that product at End Turn. A gesture's unit is 1. Copper's unit is 2, so the camp at one mine pays 2 copper.

| Land | Pay per mine each turn | Mines at the start | Cap |
|---|---|---|---|
| Camp | 2 copper | 1 | 3 |
| Gate | 1 stone | 1 | 3 |
| Citadel | 1 paper | 2 | 4 |
| Other stone, scissors, or paper hex | 1 of that gesture | 1 | 2 |
| Other copper hex | 2 copper | 1 | 2 |

The player learns the product by owning the hex. Until then the cell is only a difficulty and a length.

**Dig** costs 4 copper, once per owned hex per turn. It pays two turns of that mine immediately and does not raise the mine. A stone mine at 1 returns 2 stones. The camp returns 4 copper, which is the dig paid back. A copper hex is held for its income. Digging it does not fill the wallet.

**Upgrade** costs 6 copper, once per owned hex per turn, and raises the mine by one up to the cap. Income later that turn uses the new level. The camp can grow to 3 and pay 6 copper a turn. That is a long bet. Two turns per victory stay free. A further turn costs 50, and an upgrade does not take a hex.

**Search** costs 6 copper, once per owned hex per turn, and only on a hex that still has an unfound pile. The sheet does not preview the pile. The player sees it when it lands.

## The three piles

Three hexes hide one pile each. Opening the pile is the search.

| Hex | When it can be owned | What is buried |
|---|---|---|
| South of camp `(0,1)` | Seen on turn 1. Easy. Scissors mine. | 2 silver, 4 scissors, 6 copper |
| West of the citadel `(-1,-1)` | Revealed when the gate falls. Easy. Stone mine. | 4 stones, 1 Stone NA, 4 copper |
| East of the citadel `(1,-2)` | Revealed when the gate falls. Easy. Paper mine. | 1 silver, 4 papers, 1 Paper NA, 4 copper |

The south pile pays its own search back in copper. The prize is 2 silver and a battle's worth of scissors, on a hex the player can take before they ever see the citadel. That hex is another victory. Inside the pace the victory is 125 and the two silver add 50.

The other two piles replace a stack that was spent or lost. One of them also holds a single silver, which is 25. Taking the hex is another victory. They are also the safety the player uses after a bad gate, once that shoulder hex is visible.

## The shop

The shop sells into the campaign wallet for copper. Prices sit above a mine the player already owns. A stone mine returns 2 stones for a dig of 4, which is 2 copper a stone. The shop charges 3. The mine is the refill. The shop covers the gap.

| Item | Copper each |
|---|---|
| Stone, paper | 3 |
| Scissors | 4 |
| Any NA | 8 |
| Core | 12 |

Scissors cost more because the opening stack is the small one and a fight spends them fastest. A Core is most of the starting 16. Replacing a whole played-out fight at these prices is 72 copper, which the opening wallet cannot do. The player buys the few pieces they are short.

A purchase spends no attack and does not advance the turn. It is refused during a battle, on a finished run, and when the copper cannot cover the whole order. One order is one item.

## How a run is scored

Only a citadel victory has a score. Leaving, and a finish from outside the game, store none. A missing score is not a zero.

The total is frozen when the citadel falls. Later changes to the weights do not rewrite it. A run already started on ruleset 1 keeps that run's weights.

```
pace  = victories × 2
extra = max(0, turns − pace)
total = max(0, victories × 125 − extra × 50 + silver × 25 + copper × 1)
```

| Input | What counts |
|---|---|
| Turns | The counter on the map, including the turn the citadel falls. The player does not End Turn after that fight, and the turn still counts. Two turns per victory stay free. Each turn past that costs 50. |
| Victories | Owned hexes, minus the camp. A loss adds none. Each one is 125. |
| Silver | Silver in the wallet above the start. The start is 0, so every silver found counts. 25 each. |
| Copper | Copper in the wallet above the start of 16. 1 each. |

Stones, papers, scissors, effects, and gold are how the run is played. They are not on the score. Eight victories in sixteen turns, with nothing kept, score 1000. A turn inside that pace does not add a speed bonus. Two silver tie one extra turn. A lost battle adds a turn and no victory.

| Run | Turns | Victories | Extra | Silver | Copper above 16 | Total |
|---|---|---|---|---|---|---|
| Eight victories on pace | 16 | 8 | 0 | 0 | 0 | 1000 |
| One turn past that pace | 17 | 8 | 1 | 0 | 0 | 950 |
| Gate, then citadel | 2 | 2 | 0 | 3 | 0 | 325 |
| South pile, then gate, then citadel | 3 | 3 | 0 | 5 | 0 | 500 |
| That path, plus the easy paper hex `(1,0)` | 4 | 4 | 0 | 5 | 0 | 625 |
| One lost gate, then the rush | 3 | 2 | 0 | 3 | 0 | 325 |

Silver on the rush is the gate's 1 plus the citadel's 2. The south pile adds 2. Each of these attacks spends 10 copper, and the rewards and the camp's payday do not climb back to 16, so the copper term is 0. The south-stash routes in the bundled file still stop short of the citadel fee. The bundled lost-gate route waits on the camp and finishes in 6 turns at 225.

The catalog keeps the best victory total, and a history of victories. An abandoned run stays on the player and is omitted from that list.

## The runs worth playing

**The rush.** Turn 1, attack the gate from the camp. It is the northern neighbor, marked normal, best of 5. Win it. The citadel and the two shoulder piles appear. End Turn: the camp pays 2 copper, and the gate does not pay yet. Turn 2, attack the citadel, best of 7. Win it. Score 325 if the silver is the two rewards and the copper finishes at or below 16.

Copper along that line, if nothing else is bought or dug: start 16, fee 10, gate reward 4, camp payday 2, citadel fee 10, citadel reward 8. The wallet ends at 10.

**The south line.** Turn 1, take the south hex and search it. The search returns its 6 copper, and the wallet gains 2 silver and 4 scissors on top of the easy reward (2 scissors and 2 copper). End Turn pays the camp's copper and, next time, the south mine's scissors. Turn 2, the gate. Turn 3, the citadel. Score 500 when the wallet can pay the citadel fee. This is one more victory inside the pace, plus the two silver.

**A wider walk.** Another easy hex is another victory and another turn. Four turns with the south silver score 625. The rim scores higher while the clear stays inside two turns per victory.

**A lost gate.** The fee and the thrown items are gone. The gate's remaining stack is now visible, so the rematch is a smaller defender. The only mine the player owns is still the camp, which pays copper. Digging the camp returns the dig's cost. Gesture income starts when a gesture hex is owned. Until then the player waits on 2 copper a turn, and buys the missing gestures if the wallet can cover them. One loss and then the rush, in 3 turns, still sits inside the pace and scores 325. The bundled route that waits out the fee takes 6 turns and scores 225.

The shoulders are the other recovery. Once the gate has fallen, `(-1,-1)` refills stones and a Stone NA, and `(1,-2)` refills papers, a Paper NA, and one silver. They cost a turn each. They are how a wounded army restocks in sight of the citadel.

## When the player is stuck

The run stays open. The map says why an attack cannot be started:

- The wallet cannot pay 10 copper.
- No neighboring neutral hex remains. With the citadel untaken and the road of hexes intact, this is a broken map, and the client still says so.
- A battle is already open. The battle sheet is the whole explanation until that match ends.

An attack already spent is the counter on the header, not one of those lines. End Turn brings it back.

Recovery that the tuning expects: the opening 16 covers the first fee with 6 left, which is one dig, or one search, or one upgrade. After a loss, digging a gesture hex the player already owns puts two turns of that mine in the wallet immediately. Owning only the camp, the player End Turns until the copper fee is back. Five pays of 2 copper rebuild a fee from nothing.

## Leaving and playing again

Leave asks first. The run finishes with no score, no payday for the open turn, and no refund of items already thrown. The catalog offers a new start.

One run of Chapter I is active at a time. A second start while this one is open is refused. After a victory or a leave, start copies a fresh map and a fresh wallet. The old victory remains in the history with the total it stored.

## What a session is

A first session is the catalog, the goal, and a map that shows seven hexes and hides twelve. The player can read the fee before they pay it. They fight with the army they carried in. They come home to a hex that now has a mine, or to a gate that is weaker than it was. They end the turn, watch the camp pay 2 copper, and decide whether the next step is north or one hex off the road.

The chapter is over when the star hex is theirs. The score then tells them whether the detour was the right one.
