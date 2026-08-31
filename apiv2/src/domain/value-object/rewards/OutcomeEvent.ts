import { ValidationError } from '../../../shared/errors/index.js';
import { OutcomeEventType } from './OutcomeEventType.js';
import { PointOutcomeEvent } from './PointOutcomeEvent.js';
import { CoinOutcomeEvent } from './CoinOutcomeEvent.js';
import { MedalOutcomeEvent } from './MedalOutcomeEvent.js';

/**
 * OutcomeEvent represents an event related to a game outcome.
 */
export class OutcomeEvent {
  public type?: OutcomeEventType;
  public points: PointOutcomeEvent[];
  public coins: CoinOutcomeEvent[];
  public medals: MedalOutcomeEvent[];

  constructor() {
    this.points = [];
    this.coins = [];
    this.medals = [];
  }

  /**
   * Add a point event
   */
  addPointEvent(pointEvent: PointOutcomeEvent): void {
    this.validatePointEvent(pointEvent);
    this.points.push(pointEvent);
  }

  /**
   * Add a coin event
   */
  addCoinEvent(coinEvent: CoinOutcomeEvent): void {
    this.validateCoinEvent(coinEvent);
    this.coins.push(coinEvent);
  }

  /**
   * Add a medal event
   */
  addMedalEvent(medalEvent: MedalOutcomeEvent): void {
    this.validateMedalEvent(medalEvent);
    this.medals.push(medalEvent);
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      type: this.type,
      points: this.points.map(point => point.toJSON()),
      coins: this.coins.map(coin => coin.toJSON()),
      medals: this.medals.map(medal => medal.toJSON())
    };
  }

  /**
   * Create a new OutcomeEvent from JSON data
   */
  static fromJSON(data: any): OutcomeEvent {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid outcome event data: must be an object');
    }

    if (!data.type || typeof data.type !== 'string') {
      throw new ValidationError('OutcomeEvent type is required and must be a string');
    }

    if (!Object.values(OutcomeEventType).includes(data.type as OutcomeEventType)) {
      throw new ValidationError(`Invalid type: ${data.type}. Must be one of: ${Object.values(OutcomeEventType).join(', ')}`);
    }

    if (!Array.isArray(data.points)) {
      throw new ValidationError('OutcomeEvent points must be an array');
    }

    if (!Array.isArray(data.coins)) {
      throw new ValidationError('OutcomeEvent coins must be an array');
    }

    if (!Array.isArray(data.medals)) {
      throw new ValidationError('OutcomeEvent medals must be an array');
    }

    const outcomeEvent = new OutcomeEvent();
    outcomeEvent.type = data.type as OutcomeEventType;
    outcomeEvent.points = data.points.map((pointData: any) => PointOutcomeEvent.fromJSON(pointData));
    outcomeEvent.coins = data.coins.map((coinData: any) => CoinOutcomeEvent.fromJSON(coinData));
    outcomeEvent.medals = data.medals.map((medalData: any) => MedalOutcomeEvent.fromJSON(medalData));

    return outcomeEvent;
  }

  private validateType(type: OutcomeEventType): void {
    if (!type) {
      throw new ValidationError('OutcomeEvent type is required');
    }

    if (!Object.values(OutcomeEventType).includes(type)) {
      throw new ValidationError(`Invalid type: ${type}. Must be one of: ${Object.values(OutcomeEventType).join(', ')}`);
    }
  }

  private validatePointEvent(pointEvent: PointOutcomeEvent): void {
    if (!pointEvent || !(pointEvent instanceof PointOutcomeEvent)) {
      throw new ValidationError('Point event must be an instance of PointOutcomeEvent');
    }
  }

  private validateCoinEvent(coinEvent: CoinOutcomeEvent): void {
    if (!coinEvent || !(coinEvent instanceof CoinOutcomeEvent)) {
      throw new ValidationError('Coin event must be an instance of CoinOutcomeEvent');
    }
  }

  private validateMedalEvent(medalEvent: MedalOutcomeEvent): void {
    if (!medalEvent || !(medalEvent instanceof MedalOutcomeEvent)) {
      throw new ValidationError('Medal event must be an instance of MedalOutcomeEvent');
    }
  }
}
