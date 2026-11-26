# Finished extended draw is an attacker defeat

A campaign match still ends only when someone reaches the best-of wins, someone surrenders, or the game is broken. This rule does not create a new way to end the match.

`factsFromGame` treats a finished game as an attacker loss when all of these are true:

- `createContext.kind` is `extended`
- `createContext.rounds` is set
- `whoIsWinner` is null, because neither seat reached the best-of wins

The loss is the existing defeat. Remaining kit returns, thrown items stay spent, the fee stays spent, the action point stays spent, the tile is not captured, and the garrison is rewritten and revealed. `battleOutcome.result` stays `defeat`.

A score under the threshold is included even when it is not a tie. A finished best of 5 at 2–1, 2–0, or 0–2 is an attacker defeat, including when the attacker is ahead. A finished 0–0 match is the same defeat.

These stay as they are:

- A tied throw replays inside the same round. The match stays open.
- Both sides empty, or only the attacker empty: the attacker surrenders. That is already a defeat, and the defender is given rounds until the best-of score is filled.
- Only the defender empty: the defender surrenders and the attacker wins.
- A broken game, including the 48-throw autobattle stop: refund.
- Classic, or extended with no rounds length: unresolved. A missing length makes `whoIsWinner` null even when someone won the rounds.
- A winner id outside the two seats that reached the threshold: unresolved.
- A lobby game has no campaign link, so this resolution does not run.
