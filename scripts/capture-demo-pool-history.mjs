const CANONICAL_POOL = Object.freeze({
  networkId: "base",
  poolAddress: "0x6c561b446416e1a00e8e93e221854d6ea4171372",
});

const COINGECKO_ONCHAIN_BASE = "https://api.coingecko.com/api/v3/onchain";
const CAPTURE_TIMEOUT_MS = 15_000;

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function parseFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTxCount(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object") {
    const buys = parseFiniteNumber(value.buys);
    const sells = parseFiniteNumber(value.sells);

    if (buys !== null && sells !== null) {
      return Math.round(buys + sells);
    }

    if (buys !== null) {
      return Math.round(buys);
    }

    if (sells !== null) {
      return Math.round(sells);
    }

    return null;
  }

  const scalar = parseFiniteNumber(value);
  return scalar === null ? null : Math.round(scalar);
}

async function fetchCanonicalPoolMetrics() {
  const apiKey = process.env.COINGECKO_API_KEY?.trim();
  const url = `${COINGECKO_ONCHAIN_BASE}/networks/${CANONICAL_POOL.networkId}/pools/${encodeURIComponent(CANONICAL_POOL.poolAddress)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(apiKey ? { "x-cg-demo-api-key": apiKey } : {}),
    },
    signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`CoinGecko pool fetch failed with ${response.status}`);
  }

  const payload = await response.json();
  const attributes = payload?.data?.attributes;

  if (!attributes || typeof attributes !== "object") {
    throw new Error("CoinGecko pool payload missing data.attributes");
  }

  const liquidityUsd = parseFiniteNumber(attributes.reserve_in_usd);
  const volume24hUsd = parseFiniteNumber(attributes.volume_usd?.h24);
  const transactions24h = parseTxCount(
    attributes.transactions?.h24 ?? attributes.transaction_count?.h24
  );

  if (
    liquidityUsd === null &&
    volume24hUsd === null &&
    transactions24h === null
  ) {
    throw new Error("Canonical pool returned no usable metrics");
  }

  return {
    liquidityUsd,
    volume24hUsd,
    transactions24h,
  };
}

async function captureSnapshot(metrics) {
  const railsBaseUrl = requireEnv("RAILS_BASE_URL");
  const captureSecret = requireEnv("INTERNAL_SNAPSHOT_CAPTURE_SECRET");

  const endpoint = new URL(
    `/api/v1/pools/${CANONICAL_POOL.networkId}/${encodeURIComponent(CANONICAL_POOL.poolAddress)}/snapshots/capture`,
    railsBaseUrl
  );

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-TokenScope-Internal-Capture-Secret": captureSecret,
    },
    body: JSON.stringify({
      liquidity_usd: metrics.liquidityUsd,
      volume_24h_usd: metrics.volume24hUsd,
      transactions_24h: metrics.transactions24h,
    }),
    signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Rails capture failed with ${response.status}: ${text}`);
  }

  return response.json();
}

async function main() {
  const metrics = await fetchCanonicalPoolMetrics();
  const result = await captureSnapshot(metrics);

  console.log(
    JSON.stringify(
      {
        pool: CANONICAL_POOL,
        metrics,
        capture: result,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        pool: CANONICAL_POOL,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
