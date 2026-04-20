// =============================================================================
// TokenScope — Contract Copy Button Tests
// =============================================================================
//
// Focused component tests for the ContractCopyButton and its integration
// into TokenDetailShell contract-address rows.
// =============================================================================

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

import { ContractCopyButton } from "@/components/token/contract-copy-button";
import { TokenDetailShell } from "@/components/token/token-detail-shell";
import type { TokenDetailPageData } from "@/lib/page-data/token-detail";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ETH_ADDRESS = "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2";
const BASE_ADDRESS = "0x4200000000000000000000000000000000000006";

function makeShellData(overrides?: Partial<TokenDetailPageData>): TokenDetailPageData {
  return {
    token: {
      coinId: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      marketCapRank: 1,
      marketData: {
        currentPriceUsd: 3000,
        priceChange24hPercent: 2.5,
        marketCap: 360_000_000_000,
        totalVolume24h: 18_000_000_000,
        circulatingSupply: 120_000_000,
        fullyDilutedValuation: 360_000_000_000,
      },
    },
    marketData: {
      currentPriceUsd: 3000,
      priceChange24hPercent: 2.5,
      marketCap: 360_000_000_000,
      totalVolume24h: 18_000_000_000,
      circulatingSupply: 120_000_000,
      fullyDilutedValuation: 360_000_000_000,
    },
    priceContext: { marketCapRank: 1 },
    supportedChains: [
      {
        chainId: 1,
        name: "Ethereum",
        platformId: "ethereum",
        geckoTerminalNetwork: "eth",
        contractAddress: ETH_ADDRESS,
        isAvailable: true,
      },
      {
        chainId: 8453,
        name: "Base",
        platformId: "base",
        geckoTerminalNetwork: "base",
        contractAddress: BASE_ADDRESS,
        isAvailable: true,
      },
    ],
    availableSupportedChains: [],
    externalLinks: [
      { label: "CoinGecko", href: "https://www.coingecko.com/en/coins/ethereum" },
    ],
    fallback: null,
    eligiblePools: [],
    recommendation: {
      status: "insufficient_data",
      eligiblePools: [],
      confidence: "low",
      rationale: "Not enough data for a suggestion.",
    },
    dataState: { status: "complete", errors: [] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ContractCopyButton — isolated unit tests
// ---------------------------------------------------------------------------

describe("ContractCopyButton", () => {
  it("renders a copy button with idle state", () => {
    render(<ContractCopyButton address={ETH_ADDRESS} />);
    const btn = screen.getByTestId(`copy-contract-${ETH_ADDRESS}`);
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("Copy");
    expect(btn).toHaveAttribute("aria-label", "Copy address");
  });

  it("copies the exact full address and shows success feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    render(<ContractCopyButton address={ETH_ADDRESS} />);
    const btn = screen.getByTestId(`copy-contract-${ETH_ADDRESS}`);

    await fireEvent.click(btn);

    expect(writeText).toHaveBeenCalledExactlyOnceWith(ETH_ADDRESS);
    await waitFor(() => {
      expect(btn).toHaveTextContent("Copied");
      expect(btn).toHaveAttribute("aria-label", "Copied");
    });

    vi.unstubAllGlobals();
  });

  it("shows failure feedback when navigator.clipboard is missing", async () => {
    vi.stubGlobal("navigator", {});

    render(<ContractCopyButton address={ETH_ADDRESS} />);
    const btn = screen.getByTestId(`copy-contract-${ETH_ADDRESS}`);

    await fireEvent.click(btn);

    expect(btn).toHaveTextContent("Failed");
    expect(btn).toHaveAttribute("aria-label", "Copy failed");

    vi.unstubAllGlobals();
  });

  it("shows failure feedback when clipboard.writeText rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("NotAllowed", "NotAllowedError"));
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    render(<ContractCopyButton address={ETH_ADDRESS} />);
    const btn = screen.getByTestId(`copy-contract-${ETH_ADDRESS}`);

    await fireEvent.click(btn);

    expect(writeText).toHaveBeenCalledExactlyOnceWith(ETH_ADDRESS);
    await waitFor(() => {
      expect(btn).toHaveTextContent("Failed");
      expect(btn).toHaveAttribute("aria-label", "Copy failed");
    });

    vi.unstubAllGlobals();
  });

  it("persists feedback until the next click attempt", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    render(<ContractCopyButton address={ETH_ADDRESS} />);
    const btn = screen.getByTestId(`copy-contract-${ETH_ADDRESS}`);

    await fireEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveTextContent("Copied");
    });

    // Revert to failure
    writeText.mockRejectedValue(new Error("fail"));
    await fireEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveTextContent("Failed");
    });

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// TokenDetailShell — contract row integration
// ---------------------------------------------------------------------------

describe("TokenDetailShell — contract copy integration", () => {
  const data = makeShellData({
    availableSupportedChains: [
      {
        chainId: 1,
        name: "Ethereum",
        platformId: "ethereum",
        geckoTerminalNetwork: "eth",
        contractAddress: ETH_ADDRESS,
        isAvailable: true,
      },
      {
        chainId: 8453,
        name: "Base",
        platformId: "base",
        geckoTerminalNetwork: "base",
        contractAddress: BASE_ADDRESS,
        isAvailable: true,
      },
    ],
  });

  it("renders a copy button for each available chain contract", () => {
    render(<TokenDetailShell data={data} />);

    expect(screen.getByTestId(`copy-contract-${ETH_ADDRESS}`)).toBeInTheDocument();
    expect(screen.getByTestId(`copy-contract-${BASE_ADDRESS}`)).toBeInTheDocument();
  });

  it("keeps the full contract address visible alongside the copy button", () => {
    render(<TokenDetailShell data={data} />);

    expect(screen.getByText(ETH_ADDRESS)).toBeInTheDocument();
    expect(screen.getByText(BASE_ADDRESS)).toBeInTheDocument();
  });

  it("keeps the preview address visible alongside the copy button", () => {
    render(<TokenDetailShell data={data} />);

    expect(screen.getByText("0xC02a…6Cc2")).toBeInTheDocument();
    expect(screen.getByText("0x4200…0006")).toBeInTheDocument();
  });
});
