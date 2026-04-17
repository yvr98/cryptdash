// =============================================================================
// TokenScope — Route Model Constants
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
