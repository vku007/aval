import { z } from 'zod';
import { ChapterFileSchema } from '../../../domain/campaign/ChapterSettingsSchema.js';
import { ValidationError } from '../../../shared/errors/index.js';

const coord = z.object({
  q: z.number().int(),
  r: z.number().int()
});

export const StartCampaignSchema = z.union([
  z.object({ definitionId: z.string().min(1) }).strict(),
  z.object({ settings: ChapterFileSchema }).strict()
]);

export const CampaignActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('end_turn') }),
  z.object({ type: z.literal('attack'), q: z.number().int(), r: z.number().int(), from: coord.optional() }),
  z.object({ type: z.literal('autobattle') }),
  z.object({ type: z.literal('cancel_attack') }),
  z.object({ type: z.literal('dig'), q: z.number().int(), r: z.number().int() }),
  z.object({ type: z.literal('search'), q: z.number().int(), r: z.number().int() }),
  z.object({ type: z.literal('increase_mines'), q: z.number().int(), r: z.number().int() }),
  z.object({ type: z.literal('buy'), item: z.string(), amount: z.number().int().positive() }),
  z.object({ type: z.literal('leave') })
]);

export const FinishCampaignSchema = z.object({
  reason: z.literal('external')
});

export type CampaignAction = z.infer<typeof CampaignActionSchema>;

export function parseCampaignBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ValidationError(firstZodMessage(parsed.error));
  }
  return parsed.data;
}

function firstZodMessage(error: z.ZodError): string {
  const messages: string[] = [];
  collectZodMessages(error, messages);
  const specific = messages.filter(message => message !== 'Invalid input');
  return specific[specific.length - 1] ?? messages[messages.length - 1] ?? 'Invalid request body';
}

function collectZodMessages(error: z.ZodError, messages: string[]) {
  for (const issue of error.issues) {
    if (issue.code === 'invalid_union') {
      for (const nested of issue.unionErrors) collectZodMessages(nested, messages);
      continue;
    }
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) messages.push(`Unrecognized key: ${key}`);
      continue;
    }
    messages.push(issue.message);
  }
}
