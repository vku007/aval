import { ValidationError } from '../../shared/errors/index.js';
import { OutcomeEvent } from './rewards/OutcomeEvent.js';
import { OutcomeEventType } from './rewards/OutcomeEventType.js';
import { PointOutcomeEvent } from './rewards/PointOutcomeEvent.js';
import { CoinOutcomeEvent } from './rewards/CoinOutcomeEvent.js';
import { MedalOutcomeEvent } from './rewards/MedalOutcomeEvent.js';
import { RewardPointType } from './rewards/RewardPointType.js';

/**
 * GameOutcome represents the outcome of a game.
 */
export class GameOutcome {
  public rewards: Map<string, OutcomeEvent[]>;

  constructor() {
    this.rewards = new Map();
  }

  /**
   * Add a reward for a user
   */
  addReward(userId: string, outcomeEvent: OutcomeEvent): void {
    this.validateUserId(userId);
    this.validateOutcomeEvent(outcomeEvent);

    if (!this.rewards.has(userId)) {
      this.rewards.set(userId, []);
    }

    const userRewards = this.rewards.get(userId)!;
    userRewards.push(outcomeEvent);
  }

  /**
   * Get aggregated rewards for a specific user
   * Aggregates all points, coins, and medals from all OutcomeEvents for the user.
   * Points of the same type are summed, coins with the same coinDescriptionId are summed.
   */
  getRewardsByUserId(userId: string): OutcomeEvent {
    this.validateUserId(userId);

    const userEvents = this.rewards.get(userId);
    if (!userEvents || userEvents.length === 0) {
      // Return empty OutcomeEvent with default type if no events exist
      const empty = new OutcomeEvent();
      empty.type = OutcomeEventType.Points;
      return empty;
    }

    // Use the type from the first event, or default to Points
    const eventType = userEvents[0]?.type || OutcomeEventType.Points;
    const aggregatedEvent = new OutcomeEvent();
    aggregatedEvent.type = eventType;

    // Aggregate points by type
    const pointsMap = new Map<RewardPointType, number>();
    for (const event of userEvents) {
      for (const pointEvent of event.points) {
        const currentAmount = pointsMap.get(pointEvent.type) || 0;
        pointsMap.set(pointEvent.type, currentAmount + pointEvent.amount);
      }
    }
    // Create PointOutcomeEvent for each aggregated point type
    pointsMap.forEach((amount, type) => {
      aggregatedEvent.addPointEvent(new PointOutcomeEvent(amount, type));
    });

    // Aggregate coins by coinDescriptionId
    const coinsMap = new Map<string, number>();
    for (const event of userEvents) {
      for (const coinEvent of event.coins) {
        const currentAmount = coinsMap.get(coinEvent.coinDescriptionId) || 0;
        coinsMap.set(coinEvent.coinDescriptionId, currentAmount + coinEvent.amount);
      }
    }
    // Create CoinOutcomeEvent for each aggregated coin description
    coinsMap.forEach((amount, coinDescriptionId) => {
      aggregatedEvent.addCoinEvent(new CoinOutcomeEvent(amount, coinDescriptionId));
    });

    // Collect all medals (no aggregation needed)
    for (const event of userEvents) {
      for (const medalEvent of event.medals) {
        aggregatedEvent.addMedalEvent(medalEvent);
      }
    }

    return aggregatedEvent;
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    const rewardsObj: Record<string, any[]> = {};
    this.rewards.forEach((events, userId) => {
      rewardsObj[userId] = events.map(event => event.toJSON());
    });

    return {
      rewards: rewardsObj
    };
  }

  /**
   * Create a new GameOutcome from JSON data
   */
  static fromJSON(data: any): GameOutcome {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid game outcome data: must be an object');
    }

    const gameOutcome = new GameOutcome();

    if (data.rewards) {
      if (typeof data.rewards !== 'object' || Array.isArray(data.rewards)) {
        throw new ValidationError('GameOutcome rewards must be an object');
      }

      Object.keys(data.rewards).forEach(userId => {
        if (!Array.isArray(data.rewards[userId])) {
          throw new ValidationError(`GameOutcome rewards for userId ${userId} must be an array`);
        }

        const events = data.rewards[userId].map((eventData: any) => OutcomeEvent.fromJSON(eventData));
        gameOutcome.rewards.set(userId, events);
      });
    }

    return gameOutcome;
  }

  private validateUserId(userId: string): void {
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('GameOutcome userId is required and must be a string');
    }

    if (userId.trim().length === 0) {
      throw new ValidationError('GameOutcome userId cannot be empty');
    }
  }

  private validateOutcomeEvent(outcomeEvent: OutcomeEvent): void {
    if (!outcomeEvent || !(outcomeEvent instanceof OutcomeEvent)) {
      throw new ValidationError('GameOutcome outcomeEvent must be an instance of OutcomeEvent');
    }
  }
}
