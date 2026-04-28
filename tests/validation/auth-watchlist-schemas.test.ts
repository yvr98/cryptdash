import { describe, expect, test } from "vitest";

import {
  loginRequestSchema,
  registerRequestSchema,
} from "@/lib/validation/auth";
import {
  watchlistDeleteRequestSchema,
  watchlistItemRequestSchema,
} from "@/lib/validation/watchlist";

describe("auth validation schemas", () => {
  test("normalizes login email and accepts valid password", () => {
    const result = loginRequestSchema.parse({
      email: "  DEMO@Example.COM  ",
      password: "password123",
    });

    expect(result.email).toBe("demo@example.com");
    expect(result.password).toBe("password123");
  });

  test("rejects invalid email and short passwords", () => {
    const result = loginRequestSchema.safeParse({
      email: "not-an-email",
      password: "short",
    });

    expect(result.success).toBe(false);
  });

  test("requires matching register password confirmation", () => {
    const result = registerRequestSchema.safeParse({
      email: "demo@example.com",
      password: "password123",
      passwordConfirmation: "different123",
    });

    expect(result.success).toBe(false);
  });
});

describe("watchlist validation schemas", () => {
  test("normalizes valid watchlist item input", () => {
    const result = watchlistItemRequestSchema.parse({
      coinId: "  bitcoin  ",
      name: "  Bitcoin  ",
      symbol: " BTC ",
      thumbUrl: "https://example.com/btc.png",
    });

    expect(result).toEqual({
      coinId: "bitcoin",
      name: "Bitcoin",
      symbol: "BTC",
      thumbUrl: "https://example.com/btc.png",
    });
  });

  test("allows blank optional thumbUrl as undefined", () => {
    const result = watchlistItemRequestSchema.parse({
      coinId: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      thumbUrl: "",
    });

    expect(result.thumbUrl).toBeUndefined();
  });

  test("rejects invalid thumbUrl", () => {
    const result = watchlistItemRequestSchema.safeParse({
      coinId: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      thumbUrl: "not-a-url",
    });

    expect(result.success).toBe(false);
  });

  test("validates delete route params", () => {
    expect(watchlistDeleteRequestSchema.parse({ coinId: " bitcoin " })).toEqual({
      coinId: "bitcoin",
    });
  });
});
