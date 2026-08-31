import { ValidationError } from '../../../shared/errors/index.js';
import { Material } from './Medal.js';

/**
 * CoinDescription represents a coin description in the rewards system.
 */
export class CoinDescription {
  constructor(
    public readonly id: string,
    public readonly nominal: number,
    public readonly material: Material,
    public readonly weight: number,
    public readonly propsId: string
  ) {
    this.validateId(id);
    this.validateNominal(nominal);
    this.validateMaterial(material);
    this.validateWeight(weight);
    this.validatePropsId(propsId);
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): object {
    return {
      id: this.id,
      nominal: this.nominal,
      material: this.material,
      weight: this.weight,
      propsId: this.propsId
    };
  }

  /**
   * Create a new CoinDescription from JSON data
   */
  static fromJSON(data: any): CoinDescription {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid coin description data: must be an object');
    }

    if (!data.id || typeof data.id !== 'string') {
      throw new ValidationError('CoinDescription id is required and must be a string');
    }

    if (typeof data.nominal !== 'number') {
      throw new ValidationError('CoinDescription nominal is required and must be a number');
    }

    if (!data.material || typeof data.material !== 'string') {
      throw new ValidationError('CoinDescription material is required and must be a string');
    }

    if (!Object.values(Material).includes(data.material as Material)) {
      throw new ValidationError(`Invalid material: ${data.material}. Must be one of: ${Object.values(Material).join(', ')}`);
    }

    if (typeof data.weight !== 'number') {
      throw new ValidationError('CoinDescription weight is required and must be a number');
    }

    if (!data.propsId || typeof data.propsId !== 'string') {
      throw new ValidationError('CoinDescription propsId is required and must be a string');
    }

    return new CoinDescription(
      data.id,
      data.nominal,
      data.material as Material,
      data.weight,
      data.propsId
    );
  }

  private validateId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('CoinDescription id is required and must be a string');
    }

    if (id.trim().length === 0) {
      throw new ValidationError('CoinDescription id cannot be empty');
    }
  }

  private validateNominal(nominal: number): void {
    if (typeof nominal !== 'number') {
      throw new ValidationError('CoinDescription nominal must be a number');
    }

    if (!Number.isFinite(nominal)) {
      throw new ValidationError('CoinDescription nominal must be a finite number');
    }

    if (nominal <= 0) {
      throw new ValidationError('CoinDescription nominal must be a positive number');
    }
  }

  private validateMaterial(material: Material): void {
    if (!material) {
      throw new ValidationError('CoinDescription material is required');
    }

    if (!Object.values(Material).includes(material)) {
      throw new ValidationError(`Invalid material: ${material}. Must be one of: ${Object.values(Material).join(', ')}`);
    }
  }

  private validateWeight(weight: number): void {
    if (typeof weight !== 'number') {
      throw new ValidationError('CoinDescription weight must be a number');
    }

    if (!Number.isFinite(weight)) {
      throw new ValidationError('CoinDescription weight must be a finite number');
    }

    if (weight <= 0) {
      throw new ValidationError('CoinDescription weight must be a positive number');
    }
  }

  private validatePropsId(propsId: string): void {
    if (!propsId || typeof propsId !== 'string') {
      throw new ValidationError('CoinDescription propsId is required and must be a string');
    }

    if (propsId.trim().length === 0) {
      throw new ValidationError('CoinDescription propsId cannot be empty');
    }
  }
}
