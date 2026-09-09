/**
 * KindOfGame enum represents the kind/variant of the game.
 * classic - RPS by MoveType; same types always draw; size unused
 * extended - same MoveType compares size (higher wins, equal draw); different types ignore size
 */
export enum KindOfGame {
  Classic = 'classic',
  Extended = 'extended',
}

