# Attack fee modal

Tapping **Attack** on a fee chapter opens a card before the command is sent. The card says what the attack costs. **ATTACK** sends the command. **BACK** closes the card and leaves the wallet as it is.

No API change. The fee is still 10 copper on Chapter I, read from `rules.attackFee.copper`. The cell sheet, the stall line, and the button label stay.

## When it opens

`CampaignOffers.attack` already builds the attack body. On a fee chapter that action also carries `confirm: 'fee'`. `CampaignMapScene.onOffer` opens the card instead of posting.

| Chapter | First tap on Attack |
|---|---|
| `battleEntry` `fee` | The card. No request yet. |
| `battleEntry` `wager`, or a rules object with no `battleEntry` | The attack posts, as it does today. |

The button is still offered only when the cell is attackable, `actionPoints >= 1`, `cannot_afford_battle` is absent, and the inventory holds at least one Stone, Scissors, or Paper. NA effects and Core do not count. The card is not a second price check. The stall line **You need 10 copper to attack.** stays for a wallet that cannot pay.

## The card

Drawn on `CampaignMapScene`, over the map. A dim layer covers the canvas and takes the taps, so a hex or a sheet button under it does not fire. The card is a white rectangle with a black outline, the same outline language as the map sheets. It is not `ErrorModalScene`. That scene stays the red error window.

One sentence, from the view:

**This attack costs 10 copper.**

The number is `rules.attackFee.copper`. The word is the same **copper** the button already uses. A missing number is not filled in with 10. The button label still reads **Attack · Best of 5 · 10 copper** (Best of 7 on the citadel).

| Control | Result |
|---|---|
| **ATTACK** | Posts the action body that tap already built, `{ type: 'attack', q, r }`. The card closes. The map's busy state is the one it uses for every other command. |
| **BACK** | Closes the card. The cell sheet stays open. Copper, items, and the action point stay as they were. |
| Dim layer | Same as **BACK**. |

A second **ATTACK** while the command is in flight does not post again. A redraw while the card is open draws the card again from the current view. Closing it does not change the selected cell.

## What stays

Leave stays the bottom sheet. Dig, Search, Upgrade, Buy, and End turn still send on the first tap. The wager kit is not copied onto this card.

## Docs and checks

When this is built, add the card to the seen-cell paragraph in `campaigns_ui.md` and to the campaign map row in `site/html5Simple/SCENES.md`.

`node --test site/html5Simple/js/campaign/campaign.test.js` asserts the sentence for a fee view of 10 copper, and that a wager attack action has no fee confirm.

Browser, page on port 8099, API on port 3000:

- A seen neighbor's **Attack** opens the card and the sentence names 10 copper. The wallet is still 16 copper.
- **BACK** and a tap on the dim layer return to the cell sheet. Copper is still 16.
- **ATTACK** spends 10 copper, clears the items into the battle, and shows **PLAY**.
- A wager-shaped view is not on Chapter I. The client test covers that its attack action does not open this card.
