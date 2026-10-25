import { z } from 'zod';

const nonNegativeInt = z.number().int().nonnegative();

export const GamePlayerInventorySchema = z.object({
  userId: z.string()
    .min(1, 'User ID cannot be empty')
    .max(128, 'User ID must be 128 characters or less')
    .regex(/^[a-zA-Z0-9._-]+$/, 'User ID must contain only alphanumeric characters, dots, hyphens, and underscores'),
  items: z.object({
    stones: nonNegativeInt,
    scissors: nonNegativeInt,
    papers: nonNegativeInt,
    NA_effect_stone: nonNegativeInt,
    NA_effect_scissors: nonNegativeInt,
    NA_effect_papers: nonNegativeInt,
    NT_effect: nonNegativeInt
  }),
  currencies: z.object({
    gold: nonNegativeInt,
    silver: nonNegativeInt,
    copper: nonNegativeInt
  }),
  time: nonNegativeInt
});

export const GamePlayerInventoriesSchema = z.array(GamePlayerInventorySchema).superRefine((items, ctx) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.userId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate inventory for userId '${item.userId}'`,
        path: [index, 'userId']
      });
    }
    seen.add(item.userId);
  });
});
