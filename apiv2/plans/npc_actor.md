# NpcActor

NPC turn-taking and throw generation live in `NpcActor`. `GameProcessor.doNpcAction` only applies the resulting `Action`.

## Why

`doNpcAction` mixed:

1. Whether the NPC may throw (game/round/sub-round guards)
2. What they throw (`MoveType` + Classic `size: 0` vs Extended `0..10`)
3. Applying that throw through `processAction`

(1) and (2) are NPC policy. (3) is the same engine humans use.

## Shape

```ts
class NpcActor {
  nextAction(game: Game): Action | null;
}
```

`null` means skip. `GameProcessor` never lets `NpcActor` call `processAction` (avoids a cycle).

Classic/Extended size stays on the actor, not a second processor.
