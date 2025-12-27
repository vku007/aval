import { z } from 'zod';
import { ValidationError } from '../../shared/errors/index.js';
import { GameTypeLength } from '../../domain/entity/Game.js';

// Schema for creating a new game
const CreateGameSchema = z.object({
  id: z.string()
    .min(1, 'Game ID is required')
    .max(128, 'Game ID must be 128 characters or less')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Game ID must contain only alphanumeric characters, dots, hyphens, and underscores'),
  
  type: z.enum(['BO1', 'BO3', 'BO5', 'BO7', 'BO9', 'BO11', 'BO19'], {
    errorMap: () => ({ message: `Game type must be one of: ${Object.values(GameTypeLength).join(', ')}` })
  }),
  
  usersIds: z.array(z.string()
    .min(1, 'User ID cannot be empty')
    .max(128, 'User ID must be 128 characters or less')
    .regex(/^[a-zA-Z0-9._-]+$/, 'User ID must contain only alphanumeric characters, dots, hyphens, and underscores')
  )
    .min(1, 'Game must have at least one user')
    .max(10, 'Game cannot have more than 10 users')
    .refine((ids) => new Set(ids).size === ids.length, 'Game cannot have duplicate user IDs'),
  
  rounds: z.array(z.object({
    id: z.string()
      .min(1, 'Round ID is required')
      .max(128, 'Round ID must be 128 characters or less')
      .regex(/^[a-zA-Z0-9._-]+$/, 'Round ID must contain only alphanumeric characters, dots, hyphens, and underscores'),
    
    moves: z.array(z.object({
      userId: z.string()
        .min(1, 'User ID is required')
        .max(128, 'User ID must be 128 characters or less')
        .regex(/^[a-zA-Z0-9._-]+$/, 'User ID must contain only alphanumeric characters, dots, hyphens, and underscores'),
      
      context: z.object({
        moveType: z.enum(['Stone', 'Paper', 'Scissors'], {
          errorMap: () => ({ message: 'Move type must be Stone, Paper, or Scissors' })
        }),
        size: z.number()
          .int('Size must be an integer')
          .nonnegative('Size must be non-negative'),
        decorId: z.number()
          .int('DecorId must be an integer')
          .nonnegative('DecorId must be non-negative')
      }),
      
      time: z.number()
        .int('Move time must be an integer (Unix timestamp in milliseconds)')
        .min(0, 'Move time must be a valid Unix timestamp')
        .max(4102444800000, 'Move time must be before year 2100')
        .optional()
    }))
      .default([]),
    
    isFinished: z.boolean()
      .default(false),
    
    startTime: z.number()
      .int('Round startTime must be an integer (Unix timestamp in milliseconds)')
      .min(0, 'Round startTime must be a valid Unix timestamp')
      .max(4102444800000, 'Round startTime must be before year 2100')
      .default(() => Date.now()),
    
    winnerId: z.number()
      .int('Round winnerId must be an integer')
      .nonnegative('Round winnerId must be non-negative')
      .optional(),
    
    endTime: z.number()
      .int('Round endTime must be an integer (Unix timestamp in milliseconds)')
      .min(0, 'Round endTime must be a valid Unix timestamp')
      .max(4102444800000, 'Round endTime must be before year 2100')
      .optional()
  }))
    .default([]),
  
  isFinished: z.boolean()
    .default(false)
});

export type CreateGameDtoType = z.infer<typeof CreateGameSchema>;

export class CreateGameDto {
  constructor(
    public readonly id: string,
    public readonly type: string,
    public readonly usersIds: string[],
    public readonly rounds: RoundDto[],
    public readonly isFinished: boolean
  ) {}

  static fromRequest(body: unknown): CreateGameDto {
    try {
      const validated = CreateGameSchema.parse(body);
      return new CreateGameDto(
        validated.id,
        validated.type,
        validated.usersIds,
        validated.rounds,
        validated.isFinished
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        throw new ValidationError(`Validation failed: ${errorMessage}`);
      }
      throw error;
    }
  }
}

export interface RoundDto {
  id: string;
  moves: MoveDto[];
  isFinished: boolean;
  startTime: number;
  winnerId?: number;
  endTime?: number;
}

export interface MoveDto {
  userId: string;
  context: {
    moveType: 'Stone' | 'Paper' | 'Scissors';
    size: number;
    decorId: number;
  };
  time?: number;
}

export class CreateGameDtoValidator {
  static validate(data: unknown): CreateGameDto {
    try {
      return CreateGameSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        throw new ValidationError(`Validation failed: ${errorMessage}`);
      }
      throw error;
    }
  }

  static validatePartial(data: unknown): Partial<CreateGameDto> {
    try {
      return CreateGameSchema.partial().parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        throw new ValidationError(`Validation failed: ${errorMessage}`);
      }
      throw error;
    }
  }
}
