import { z } from 'zod';
import { ValidationError } from '../../../shared/errors/index.js';

const coord = z.object({
  q: z.number().int(),
  r: z.number().int()
});

export const StartCampaignSchema = z.object({
  definitionId: z.string().min(1)
});

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
    const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
    throw new ValidationError(message);
  }
  return parsed.data;
}
