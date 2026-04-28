import { z } from "zod";

const optionalUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().url().optional()
);

export const watchlistItemRequestSchema = z.object({
  coinId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(160),
  symbol: z.string().trim().min(1).max(32),
  thumbUrl: optionalUrlSchema,
});

export const watchlistDeleteRequestSchema = z.object({
  coinId: z.string().trim().min(1).max(128),
});

export type WatchlistItemRequest = z.infer<typeof watchlistItemRequestSchema>;
