import { z } from 'zod';
import { ValidationError } from '../../shared/errors/index.js';
import type { CognitoGroupName } from '../../infrastructure/cognito/CognitoAdminClient.js';

const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(256, 'Password is too long (max 256 characters)')
  .refine((value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), {
    message: 'Password must contain at least one letter and one number'
  });

const groupSchema = z.enum(['admin', 'user', 'guest']);

const CreateCognitoUserSchema = z.object({
  email: z.string().email('Invalid email format').max(128),
  password: passwordSchema,
  displayName: z.string().min(2).max(100),
  group: groupSchema,
  createGameProfile: z.boolean().optional().default(false),
  gameName: z.string().min(2).max(100).optional(),
  externalId: z.number().int().min(1).optional()
});

const UpdateCognitoUserSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  group: groupSchema.optional(),
  password: passwordSchema.optional(),
  enabled: z.boolean().optional()
}).refine(
  (data) => data.displayName !== undefined || data.group !== undefined || data.password !== undefined || data.enabled !== undefined,
  { message: 'At least one of displayName, group, password, or enabled is required' }
);

const UpsertGameProfileSchema = z.object({
  name: z.string().min(2).max(100),
  externalId: z.number().int().min(1).optional()
});

const PatchGameProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  externalId: z.number().int().min(1).optional()
}).refine(
  (data) => data.name !== undefined || data.externalId !== undefined,
  { message: 'At least one of name or externalId is required' }
);

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join('.') || 'body'}: ${err.message}`)
        .join(', ');
      throw new ValidationError(`Validation failed: ${errorMessage}`);
    }
    throw error;
  }
}

export type CreateCognitoUserInput = z.infer<typeof CreateCognitoUserSchema>;
export type UpdateCognitoUserInput = z.infer<typeof UpdateCognitoUserSchema>;
export type UpsertGameProfileInput = z.infer<typeof UpsertGameProfileSchema>;
export type PatchGameProfileInput = z.infer<typeof PatchGameProfileSchema>;

export const CognitoUserAdminDto = {
  parseCreate: (body: unknown): CreateCognitoUserInput => parseOrThrow(CreateCognitoUserSchema, body),
  parseUpdate: (body: unknown): UpdateCognitoUserInput => parseOrThrow(UpdateCognitoUserSchema, body),
  parseUpsertGameProfile: (body: unknown): UpsertGameProfileInput => parseOrThrow(UpsertGameProfileSchema, body),
  parsePatchGameProfile: (body: unknown): PatchGameProfileInput => parseOrThrow(PatchGameProfileSchema, body)
};

export interface GameProfileSummary {
  id: string;
  name: string;
  externalId: number;
}

export interface CognitoUserAdminView {
  username: string;
  sub: string;
  email: string;
  displayName: string;
  group: CognitoGroupName | null;
  enabled: boolean;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  gameProfile: GameProfileSummary | null;
}

export interface Actor {
  sub: string;
  email: string;
}
