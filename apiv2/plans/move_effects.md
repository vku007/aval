# Move effects

Implemented. Extended throws can attach up to two `MoveEffect` value objects. Classic and NPC throws stay effect-free.

## Contract

`MoveContext.effects` is `MoveEffect[]` (`kind` only). Omitted JSON is `[]`. `decorId` stays visual-only.

Kinds:

- Size: `NegateSize`, `Overpower` (at most one)
- Type: `Protection`, `SizeOnly` (at most one)

## Extended resolution

Find the single throw with `effects.length > 0`. If none, keep type-then-size.

- **SizeOnly** — treat types as equal; only size decides
- **Protection** — a type loss becomes a draw (does not change a size loss)
- **NegateSize** — when size is compared, treat sizes as equal (draw)
- **Overpower** — when size is compared, treat the actor’s size as bigger (actor wins)

Size effects do nothing unless the sub-round reaches size comparison.

## What landed

- Domain `MoveEffect` + `MoveContext.effects` validation
- Persist through `GameEntity`; player Action JSON and admin DTOs
- `ExtendedGameResolver` applies effects; Classic ignores them
- Extended UI: four toggle buttons, category replace, payload `effects[]`

## Out of scope

- Both players applying effects in the same sub-round
- Two effects of the same category
- Using `decorId` in win logic
