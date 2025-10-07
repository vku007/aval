import { z } from "zod";

export const nameSchema = z.string().regex(/^[a-zA-Z0-9._-]{1,128}$/);
export const createSchema = z.object({
  name: nameSchema,
  data: z.any()
});
export const listQuerySchema = z.object({
  prefix: z.string().default(""),
  limit: z
    .string()
    .transform((v) => Number(v))
    .refine((n) => Number.isFinite(n) && n > 0 && n <= 1000, "limit must be 1..1000")
    .optional(),
  cursor: z.string().optional()
});
