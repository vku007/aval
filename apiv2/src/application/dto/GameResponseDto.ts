import { GameEntity } from '../../domain/entity/GameEntity.js';
import type { EntityMetadata } from '../../shared/types/common.js';

export class GameResponseDto {
  constructor(
    public readonly id: string,
    public readonly type: string,
    public readonly usersIds: string[],
    public readonly rounds: RoundResponseDto[],
    public readonly isFinished: boolean,
    public readonly etag?: string,
    public readonly metadata?: EntityMetadata
  ) {}

  static fromGameEntity(gameEntity: GameEntity): GameResponseDto {
    return new GameResponseDto(
      gameEntity.id,
      gameEntity.type,
      gameEntity.usersIds,
      gameEntity.rounds.map(round => RoundResponseDto.fromRound(round)),
      gameEntity.isFinished,
      gameEntity.internalGetBackingStore().etag,
      gameEntity.metadata
    );
  }

  toJSON(): object {
    return {
      id: this.id,
      type: this.type,
      usersIds: this.usersIds,
      rounds: this.rounds.map(round => round.toJSON()),
      isFinished: this.isFinished,
      etag: this.etag,
      metadata: this.metadata
    };
  }
}

export class RoundResponseDto {
  constructor(
    public readonly id: string,
    public readonly moves: MoveResponseDto[],
    public readonly isFinished: boolean
  ) {}

  static fromRound(round: import('../../domain/entity/Round.js').Round): RoundResponseDto {
    return new RoundResponseDto(
      round.id,
      round.moves.map(move => MoveResponseDto.fromMove(move)),
      round.isFinished
    );
  }

  toJSON(): object {
    return {
      id: this.id,
      moves: this.moves.map(move => move.toJSON()),
      isFinished: this.isFinished
    };
  }
}

export class MoveResponseDto {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly value: number,
    public readonly valueDecorated: string
  ) {}

  static fromMove(move: import('../../domain/entity/Move.js').Move): MoveResponseDto {
    return new MoveResponseDto(
      move.id,
      move.userId,
      move.value,
      move.valueDecorated
    );
  }

  toJSON(): object {
    return {
      id: this.id,
      userId: this.userId,
      value: this.value,
      valueDecorated: this.valueDecorated
    };
  }
}
