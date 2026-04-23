// =============================================================================
// CryptDash — Route Metadata Helpers
// =============================================================================
//
// Bounded metadata contract for token and pool route pages.
// Produces Metadata objects with exactly: title, description, openGraph.title,
// openGraph.description, twitter.card, and canonical URL.
//
// Metadata is derived from existing page-data sources — never invents data.
// When upstream fails, metadata falls back to generic route-appropriate
// placeholders rather than propagating errors.
// =============================================================================

import type { Metadata } from "next";

import { buildTokenPath, buildPoolPath } from "@/lib/constants/route";

// ---------------------------------------------------------------------------
// App URL resolution
// ---------------------------------------------------------------------------

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://cryptdash.vercel.app";
}

// ---------------------------------------------------------------------------
// Token route metadata
// ---------------------------------------------------------------------------

export interface TokenMetadataInput {
  coinId: string;
  name: string;
  symbol: string;
}

/**
 * Build bounded metadata for /token/[coinId].
 *
 * Uses token name/symbol when available; falls back to coinId when not.
 * Canonical URL is always /token/[coinId] — never includes query params.
 */
export function buildTokenMetadata(input: TokenMetadataInput): Metadata {
  const displayName =
    input.name && input.name !== input.coinId
      ? input.name
      : input.coinId;
  const symbolSuffix = input.symbol ? ` (${input.symbol.toUpperCase()})` : "";

  const title = `${displayName}${symbolSuffix} — CryptDash`;
  const description = `Multi-chain pool comparison, liquidity, and trading data for ${displayName}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: "summary",
    },
    alternates: {
      canonical: `${getAppUrl()}${buildTokenPath(input.coinId)}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Pool route metadata
// ---------------------------------------------------------------------------

export interface PoolMetadataInput {
  network: string;
  poolAddress: string;
  pairLabel?: string;
  dexName?: string;
}

/**
 * Build bounded metadata for /pool/[network]/[poolAddress].
 *
 * Uses pair/dex info when available; falls back to address-based labels.
 * Canonical URL is the pool path only — coinId query context is never
 * promoted to canonical URL state.
 */
export function buildPoolMetadata(input: PoolMetadataInput): Metadata {
  const shortAddress = `${input.poolAddress.slice(0, 6)}…${input.poolAddress.slice(-4)}`;
  const pairPart = input.pairLabel || shortAddress;
  const dexPart = input.dexName ? ` on ${input.dexName}` : "";
  const titleSuffix = `${pairPart}${dexPart}`;

  const title = `${titleSuffix} — CryptDash Pool`;
  const description = `Pool details, liquidity, and trading activity for ${pairPart} on ${input.network}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: "summary",
    },
    alternates: {
      canonical: `${getAppUrl()}${buildPoolPath(input.network, input.poolAddress)}`,
    },
  };
}
