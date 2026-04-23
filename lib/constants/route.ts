// =============================================================================
// CryptDash — Route Model Constants
// =============================================================================
//
// The route model determines how the app identifies and navigates to tokens.
//
// CANONICAL IDENTITY: CoinGecko coin ID
// CANONICAL ROUTE:    /token/[coinId]
//
// Why CoinGecko coin ID (not symbol, not address):
//   - Symbols are ambiguous (e.g. "ETH" maps to Ethereum, ETH绷, etc.)
//   - Contract addresses are chain-specific and not globally unique
//   - CoinGecko coin IDs are globally unique and stable across chains
//   - The /token/[coinId] route resolves a single canonical token page
//     that can display data from multiple chains in a unified view
//
// The app NEVER routes by symbol alone. Search results require explicit
// user selection before navigating to a token detail page.
// =============================================================================

/**
 * Base path segment for token detail pages.
 * Used with Next.js dynamic route: /token/[coinId]
 */
export const TOKEN_ROUTE_SEGMENT = "/token" as const;

/**
 * Build a canonical token detail URL from a CoinGecko coin ID.
 *
 * @param coinId - CoinGecko coin ID (e.g. "ethereum", "wrapped-bitcoin")
 * @returns Absolute path to the token detail page (e.g. "/token/ethereum")
 */
export function buildTokenPath(coinId: string): string {
  return `${TOKEN_ROUTE_SEGMENT}/${coinId}`;
}

// =============================================================================
// Pool Detail Routes
// =============================================================================
//
// CANONICAL IDENTITY: GeckoTerminal network + pool address
// CANONICAL ROUTE:    /pool/[network]/[poolAddress]
//
// The pool detail route uses the GeckoTerminal network identifier (e.g. "eth",
// "base") and the on-chain pool address. This pair is unique within
// GeckoTerminal's data model.
//
// UNSUPPORTED NETWORKS:
//   The route helper does NOT validate network against SUPPORTED_CHAINS.
//   Callers that need to gate on supported chains should use isSupportedChain()
//   from ./chains before building the path. The route layer is intentionally
//   permissive so that deep links to any GeckoTerminal network remain resolvable
//   even if the app has not yet added that chain to the supported set.
//
// OPTIONAL TOKEN CONTEXT:
//   coinId may be appended as a query parameter (?coinId=<coinId>) when the
//   caller has deterministic token context (e.g. from a token detail page).
//   Discovery rows and direct-entry URLs may not carry coinId; the query
//   parameter is omitted in those cases, never fabricated.
// =============================================================================

/**
 * Base path segment for pool detail pages.
 * Used with Next.js dynamic route: /pool/[network]/[poolAddress]
 */
export const POOL_ROUTE_SEGMENT = "/pool" as const;

/**
 * Build a canonical pool detail URL path from GeckoTerminal network and
 * pool address.
 *
 * @param network - GeckoTerminal network identifier (e.g. "eth", "base")
 * @param poolAddress - On-chain pool address
 * @param coinId - Optional CoinGecko coin ID for token context (query param)
 * @returns Absolute path to the pool detail page
 *          (e.g. "/pool/eth/0xabc..." or "/pool/eth/0xabc...?coinId=ethereum")
 */
export function buildPoolPath(
  network: string,
  poolAddress: string,
  coinId?: string,
): string {
  const base = `${POOL_ROUTE_SEGMENT}/${network}/${poolAddress}`;
  if (coinId) {
    return `${base}?coinId=${encodeURIComponent(coinId)}`;
  }
  return base;
}
