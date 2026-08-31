import { GameOutcome } from '../../domain/value-object/GameOutcome.js';
import { OutcomeEvent } from '../../domain/value-object/rewards/OutcomeEvent.js';
import { PointOutcomeEvent } from '../../domain/value-object/rewards/PointOutcomeEvent.js';
import { RewardPointType } from '../../domain/value-object/rewards/RewardPointType.js';

/**
 * Resolver for simple game outcome (rewards, etc.).
 */
export class SimpleGameOutcomeResolver {
  /**
   * Adds round outcome to the given game outcome.
   * @param outcome - The game outcome to add round outcome to
   */
  addRoundOutcome(outcome: GameOutcome, userId: string, isWinner: boolean): void {
    const event = new OutcomeEvent();
    if (isWinner) {
        event.addPointEvent(new PointOutcomeEvent(1, RewardPointType.Experience));
    } 
  }

  /**
   * Adds game outcome for a user to the given game outcome.
   * @param outcome - The game outcome to add to
   * @param userId - The user identifier
   * @param isWinner - Whether the user won the game
   */
  addGameOutcome(outcome: GameOutcome, userId: string, isWinner: boolean): void {
    const event = new OutcomeEvent();
    //outcome.addReward(userId, new OutcomeEvent(OutcomeEventType.Points, 1, RewardPointType.Wins));
    if (isWinner) {
        event.addPointEvent(new PointOutcomeEvent(1, RewardPointType.Wins));
        event.addPointEvent(new PointOutcomeEvent(30, RewardPointType.Experience));
    } else {
        event.addPointEvent(new PointOutcomeEvent(10, RewardPointType.Experience));
    }
    event.addPointEvent(new PointOutcomeEvent(1, RewardPointType.Games));
    outcome.addReward(userId, event);
  }
}
