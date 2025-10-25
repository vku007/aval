import { z } from 'zod';
import { ValidationError } from '../../shared/errors/index.js';

// Schema for updating a game (all fields optional)
const UpdateGameSchema = z.object({
  type: z.string()
    .min(1, 'Game type is required')
    .max(100, 'Game type must be 100 characters or less')
    .optional(),
  
  usersIds: z.array(z.string()
    .min(1, 'User ID cannot be empty')
    .max(128, 'User ID must be 128 characters or less')
    .regex(/^[a-zA-Z0-9._-]+$/, 'User ID must contain only alphanumeric characters, dots, hyphens, and underscores')
  )
    .min(1, 'Game must have at least one user')
    .max(10, 'Game cannot have more than 10 users')
    .refine((ids) => new Set(ids).size === ids.length, 'Game cannot have duplicate user IDs')
    .optional(),
  
  rounds: z.array(z.object({
    id: z.string()
      .min(1, 'Round ID is required')
      .max(128, 'Round ID must be 128 characters or less')
      .regex(/^[a-zA-Z0-9._-]+$/, 'Round ID must contain only alphanumeric characters, dots, hyphens, and underscores'),
    
    moves: z.array(z.object({
      id: z.string()
        .min(1, 'Move ID is required')
        .max(128, 'Move ID must be 128 characters or less')
        .regex(/^[a-zA-Z0-9._-]+$/, 'Move ID must contain only alphanumeric characters, dots, hyphens, and underscores'),
      
      userId: z.string()
        .min(1, 'User ID is required')
        .max(128, 'User ID must be 128 characters or less')
        .regex(/^[a-zA-Z0-9._-]+$/, 'User ID must contain only alphanumeric characters, dots, hyphens, and underscores'),
      
      value: z.number()
        .finite('Move value must be a finite number'),
      
      valueDecorated: z.string()
        .min(1, 'Move valueDecorated is required')
    }))
      .default([]),
    
    isFinished: z.boolean()
      .default(false)
  }))
    .optional(),
  
  isFinished: z.boolean()
    .optional()
});

export type UpdateGameDtoType = z.infer<typeof UpdateGameSchema>;

export class UpdateGameDto {
  constructor(
    public readonly type?: string,
    public readonly usersIds?: string[],
    public readonly rounds?: RoundDto[],
    public readonly isFinished?: boolean
  ) {}

  static fromRequest(body: unknown, merge: boolean = false): UpdateGameDto {
    try {
      const validated = UpdateGameSchema.parse(body);
      return new UpdateGameDto(
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
  time: number;
}

export interface MoveDto {
  id: string;
  userId: string;
  value: number;
  valueDecorated: string;
}

export class UpdateGameDtoValidator {
  static validate(data: unknown): UpdateGameDto {
    try {
      return UpdateGameSchema.parse(data);
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

  static validatePartial(data: unknown): Partial<UpdateGameDto> {
    try {
      return UpdateGameSchema.partial().parse(data);
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
