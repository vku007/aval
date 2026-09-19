import { ValidationError } from '../../shared/errors/index.js';

export enum MoveEffectKind {
  NegateSize = 'NegateSize',
  Overpower = 'Overpower',
  Protection = 'Protection',
  SizeOnly = 'SizeOnly'
}

export type MoveEffectCategory = 'size' | 'type';

const SIZE_KINDS = new Set<MoveEffectKind>([
  MoveEffectKind.NegateSize,
  MoveEffectKind.Overpower
]);

const TYPE_KINDS = new Set<MoveEffectKind>([
  MoveEffectKind.Protection,
  MoveEffectKind.SizeOnly
]);

export function moveEffectCategory(kind: MoveEffectKind): MoveEffectCategory {
  if (SIZE_KINDS.has(kind)) {
    return 'size';
  }
  if (TYPE_KINDS.has(kind)) {
    return 'type';
  }
  throw new ValidationError(`Unknown MoveEffect kind: ${kind}`);
}

export class MoveEffect {
  constructor(public readonly kind: MoveEffectKind) {
    this.validateKind(kind);
  }

  get category(): MoveEffectCategory {
    return moveEffectCategory(this.kind);
  }

  toJSON(): object {
    return { kind: this.kind };
  }

  static fromJSON(data: any): MoveEffect {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Invalid move effect data: must be an object');
    }

    if (!data.kind || typeof data.kind !== 'string') {
      throw new ValidationError('MoveEffect kind is required and must be a string');
    }

    if (!Object.values(MoveEffectKind).includes(data.kind as MoveEffectKind)) {
      throw new ValidationError(
        `Invalid MoveEffect kind: ${data.kind}. Must be one of: ${Object.values(MoveEffectKind).join(', ')}`
      );
    }

    return new MoveEffect(data.kind as MoveEffectKind);
  }

  private validateKind(kind: MoveEffectKind): void {
    if (!kind) {
      throw new ValidationError('MoveEffect kind is required');
    }

    if (!Object.values(MoveEffectKind).includes(kind)) {
      throw new ValidationError(
        `Invalid MoveEffect kind: ${kind}. Must be one of: ${Object.values(MoveEffectKind).join(', ')}`
      );
    }
  }
}
