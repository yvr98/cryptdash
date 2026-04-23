import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getWatchlist,
  isInWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "@/lib/watchlist/storage";

const STORAGE_KEY = "cryptdash_watchlist";

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(store)) delete store[key];
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((_: number) => null),
  };
}

let storage: ReturnType<typeof mockLocalStorage>;

beforeEach(() => {
  storage = mockLocalStorage();
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getWatchlist", () => {
  it("returns empty array when localStorage is empty", () => {
    expect(getWatchlist()).toEqual([]);
  });

  it("returns valid entries from localStorage", () => {
    const entries = [
      { coinId: "bitcoin", name: "Bitcoin", symbol: "btc", addedAt: 1000 },
      { coinId: "ethereum", name: "Ethereum", symbol: "eth", addedAt: 2000 },
    ];
    storage.getItem.mockReturnValue(JSON.stringify(entries));

    const result = getWatchlist();
    expect(result).toHaveLength(2);
    expect(result[0].coinId).toBe("bitcoin");
    expect(result[1].coinId).toBe("ethereum");
  });

  it("recovers from malformed JSON by returning empty array", () => {
    storage.getItem.mockReturnValue("{broken json!!!");
    expect(getWatchlist()).toEqual([]);
  });

  it("recovers from non-array JSON by returning empty array", () => {
    storage.getItem.mockReturnValue(JSON.stringify({ not: "an array" }));
    expect(getWatchlist()).toEqual([]);
  });

  it("filters out entries with missing required fields", () => {
    const entries = [
      { coinId: "bitcoin", name: "Bitcoin", symbol: "btc", addedAt: 1000 },
      { coinId: "", name: "No ID", symbol: "x", addedAt: 2000 },
      { name: "Missing coinId", symbol: "y", addedAt: 3000 },
      { coinId: "valid", name: 123, symbol: "z", addedAt: 4000 },
    ];
    storage.getItem.mockReturnValue(JSON.stringify(entries));

    const result = getWatchlist();
    expect(result).toHaveLength(1);
    expect(result[0].coinId).toBe("bitcoin");
  });

  it("recovers from null localStorage value", () => {
    storage.getItem.mockReturnValue(null);
    expect(getWatchlist()).toEqual([]);
  });

  it("recovers when localStorage.getItem throws", () => {
    storage.getItem.mockImplementation(() => {
      throw new Error("Security error");
    });
    expect(getWatchlist()).toEqual([]);
  });
});

describe("isInWatchlist", () => {
  it("returns false for an empty watchlist", () => {
    expect(isInWatchlist("bitcoin")).toBe(false);
  });

  it("returns true when the coin is present", () => {
    const entries = [
      { coinId: "bitcoin", name: "Bitcoin", symbol: "btc", addedAt: 1000 },
    ];
    storage.getItem.mockReturnValue(JSON.stringify(entries));

    expect(isInWatchlist("bitcoin")).toBe(true);
  });

  it("returns false for a different coinId", () => {
    const entries = [
      { coinId: "bitcoin", name: "Bitcoin", symbol: "btc", addedAt: 1000 },
    ];
    storage.getItem.mockReturnValue(JSON.stringify(entries));

    expect(isInWatchlist("ethereum")).toBe(false);
  });
});

describe("addToWatchlist", () => {
  it("adds a new entry and persists it", () => {
    const result = addToWatchlist({
      coinId: "bitcoin",
      name: "Bitcoin",
      symbol: "btc",
    });

    expect(result).toHaveLength(1);
    expect(result[0].coinId).toBe("bitcoin");
    expect(result[0].addedAt).toBeTypeOf("number");
    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String)
    );
  });

  it("does not duplicate an existing entry", () => {
    const existing = [
      { coinId: "bitcoin", name: "Bitcoin", symbol: "btc", addedAt: 1000 },
    ];
    storage.getItem.mockReturnValue(JSON.stringify(existing));

    const result = addToWatchlist({
      coinId: "bitcoin",
      name: "Bitcoin",
      symbol: "btc",
    });

    expect(result).toHaveLength(1);
    expect(result[0].addedAt).toBe(1000);
  });

  it("appends to existing entries", () => {
    const existing = [
      { coinId: "bitcoin", name: "Bitcoin", symbol: "btc", addedAt: 1000 },
    ];
    storage.getItem.mockReturnValue(JSON.stringify(existing));

    const result = addToWatchlist({
      coinId: "ethereum",
      name: "Ethereum",
      symbol: "eth",
    });

    expect(result).toHaveLength(2);
    expect(result[1].coinId).toBe("ethereum");
  });

  it("recovers from malformed state and writes valid state on add", () => {
    storage.getItem.mockReturnValue("not valid json!!!");

    const result = addToWatchlist({
      coinId: "bitcoin",
      name: "Bitcoin",
      symbol: "btc",
    });

    expect(result).toHaveLength(1);
    expect(result[0].coinId).toBe("bitcoin");

    // Verify the persisted data is valid JSON
    const written = storage.setItem.mock.calls[0][1];
    const parsed = JSON.parse(written);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].coinId).toBe("bitcoin");
  });
});

describe("removeFromWatchlist", () => {
  it("removes an entry by coinId", () => {
    const existing = [
      { coinId: "bitcoin", name: "Bitcoin", symbol: "btc", addedAt: 1000 },
      { coinId: "ethereum", name: "Ethereum", symbol: "eth", addedAt: 2000 },
    ];
    storage.getItem.mockReturnValue(JSON.stringify(existing));

    const result = removeFromWatchlist("bitcoin");
    expect(result).toHaveLength(1);
    expect(result[0].coinId).toBe("ethereum");
  });

  it("returns unchanged list when coinId is not found", () => {
    const existing = [
      { coinId: "bitcoin", name: "Bitcoin", symbol: "btc", addedAt: 1000 },
    ];
    storage.getItem.mockReturnValue(JSON.stringify(existing));

    const result = removeFromWatchlist("solana");
    expect(result).toHaveLength(1);
  });

  it("handles removing from an empty watchlist", () => {
    const result = removeFromWatchlist("bitcoin");
    expect(result).toEqual([]);
  });
});
