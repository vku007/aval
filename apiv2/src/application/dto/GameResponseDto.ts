import { GameEntity } from '../../domain/entity/GameEntity.js';
import { Round } from '../../domain/value-object/Round.js';
import { RoundStatus } from '../../domain/value-object/RoundStatus.js';
import { Move } from '../../domain/value-object/Move.js';
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
      gameEntity.isFinished, // Backward compatibility - uses getter that converts status
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

  static fromRound(round: Round): RoundResponseDto {
    // Collect all moves from all subRounds
    const moves: Move[] = [];
    for (const subRound of round.subRounds) {
      moves.push(...subRound.moves);
    }
    
    // Map status to isFinished for backward compatibility
    const isFinished = round.status === RoundStatus.Finished;
    
    return new RoundResponseDto(
      round.id,
      moves.map(move => MoveResponseDto.fromMove(move)),
      isFinished
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
    public readonly userId: string,
    public readonly context: {
      moveType: string;
      size: number;
      decorId: number;
    },
    public readonly time: number
  ) {}

  static fromMove(move: Move): MoveResponseDto {
    return new MoveResponseDto(
      move.userId,
      move.context.toJSON() as { moveType: string; size: number; decorId: number },
      move.time
    );
  }

  toJSON(): object {
    return {
      userId: this.userId,
      context: this.context,
      time: this.time
    };
  }
}
