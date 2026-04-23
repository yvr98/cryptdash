// =============================================================================
// CryptDash — CoinGecko Onchain Raw Pool Fixtures
// =============================================================================
//
// Deterministic fixture data for pool normalization tests.
// These represent raw CoinGecko onchain JSON:API pool responses BEFORE
// the adapter boundary parses numeric strings into numbers.
// =============================================================================

// ---------------------------------------------------------------------------
// Raw pool response with string-valued metrics
// ---------------------------------------------------------------------------

export const rawPoolResponse = {
  data: [
    {
      id: "0x1111111111111111111111111111111111111111",
      type: "pool",
      attributes: {
        address: "0x1111111111111111111111111111111111111111",
        name: "WETH / USDC",
        base_token_price_usd: "3500.005",
        quote_token_price_usd: "0.999945",
        reserve_in_usd: "5000000.50",
        volume_usd: { h24: "500000.00" },
        transactions: { h24: "1200" },
        price_change_percentage: { h24: "2.50" },
      },
      relationships: {
        network: { data: { id: "eth" } },
        dex: { data: { id: "uniswap_v3" } },
      },
    },
    {
      id: "0x2222222222222222222222222222222222222222",
      type: "pool",
      attributes: {
        address: "0x2222222222222222222222222222222222222222",
        name: "WETH / USDC",
        base_token_price_usd: "3500.00",
        quote_token_price_usd: "1.00",
        reserve_in_usd: "200000.00",
        volume_usd: { h24: "50000.00" },
        transactions: { h24: "150" },
        price_change_percentage: { h24: "2.40" },
      },
      relationships: {
        network: { data: { id: "base" } },
        dex: { data: { id: "aerodrome" } },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Raw pool with null metrics (adapter must produce number | null)
// ---------------------------------------------------------------------------

export const rawPoolWithNulls = {
  data: [
    {
      id: "0xcccccccccccccccccccccccccccccccccccccccc",
      type: "pool",
      attributes: {
        address: "0xcccccccccccccccccccccccccccccccccccccccc",
        name: "WETH / USDC",
        base_token_price_usd: null,
        quote_token_price_usd: null,
        reserve_in_usd: null,
        volume_usd: { h24: null },
        transactions: { h24: null },
        price_change_percentage: { h24: null },
      },
      relationships: {
        dex: { data: { id: "uniswap_v3" } },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Raw pool with numeric (not string) transaction_count
// (CoinGecko onchain can return numbers instead of strings)
// ---------------------------------------------------------------------------

export const rawPoolWithNumericTxCount = {
  data: [
    {
      id: "0x1111111111111111111111111111111111111111",
      type: "pool",
      attributes: {
        address: "0x1111111111111111111111111111111111111111",
        name: "WETH / USDC",
        base_token_price_usd: "3500.00",
        quote_token_price_usd: "1.00",
        reserve_in_usd: "1000000.00",
        volume_usd: { h24: "200000.00" },
        transactions: { h24: 500 },
        price_change_percentage: { h24: "1.50" },
      },
      relationships: {
        dex: { data: { id: "uniswap_v3" } },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Raw pool with object-shaped transactions.h24 (buys/sells)
// CoinGecko onchain returns this shape: { buys, sells, buyers, sellers }
// ---------------------------------------------------------------------------

export const rawPoolWithObjectTxCount = {
  data: [
    {
      id: "0x3333333333333333333333333333333333333333",
      type: "pool",
      attributes: {
        address: "0x3333333333333333333333333333333333333333",
        name: "WETH / USDT",
        base_token_price_usd: "3500.00",
        quote_token_price_usd: "1.00",
        reserve_in_usd: "3000000.00",
        volume_usd: { h24: "400000.00" },
        transactions: { h24: { buys: 850, sells: 620, buyers: 410, sellers: 305 } },
        price_change_percentage: { h24: "1.80" },
      },
      relationships: {
        dex: { data: { id: "uniswap_v3" } },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Raw pool missing required identity fields (should be filtered to null)
// ---------------------------------------------------------------------------

export const rawPoolMissingIdentity = {
  data: [
    {
      id: "0x...",
      type: "pool",
      attributes: {
        // Missing address and name
        reserve_in_usd: "50000.00",
      },
    },
    {
      id: "0x...",
      type: "pool",
      attributes: {
        address: "0xabcdef",
        // Missing name
      },
    },
    {
      id: "0x...",
      type: "pool",
      attributes: {
        address: "0xdeadbeef",
        name: "SOME / TOKEN",
      },
      relationships: {
        // Missing dex relationship — no dex id anywhere
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Expected normalized results for rawPoolResponse (chainId=1)
// ---------------------------------------------------------------------------

export const expectedNormalizedPools = [
  {
    poolAddress: "0x1111111111111111111111111111111111111111",
    chainId: 1,
    dexName: "uniswap_v3",
    pairLabel: "WETH / USDC",
    baseTokenPriceUsd: 3500.005,
    quoteTokenPriceUsd: 0.999945,
    liquidityUsd: 5000000.5,
    volume24hUsd: 500000.0,
    transactions24h: 1200,
    priceChange24h: 2.5,
  },
  {
    poolAddress: "0x2222222222222222222222222222222222222222",
    chainId: 1,
    dexName: "aerodrome",
    pairLabel: "WETH / USDC",
    baseTokenPriceUsd: 3500.0,
    quoteTokenPriceUsd: 1.0,
    liquidityUsd: 200000.0,
    volume24hUsd: 50000.0,
    transactions24h: 150,
    priceChange24h: 2.4,
  },
];
