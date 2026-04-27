import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeSearchHero } from "@/components/home/home-search-hero";
import {
  ambiguousSearchResults,
  emptySearchResults,
  exactContractSearchQuery,
  unresolvedContractSearchQuery,
  validSearchResults,
} from "../fixtures/search";

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("HomeSearchHero", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows an explicit result list for ambiguous symbol searches", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(ambiguousSearchResults));

    render(<HomeSearchHero />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /search/i })).toBeEnabled();
    });

    fireEvent.change(screen.getByPlaceholderText(/search by name/i), {
      target: { value: "eth" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    expect(fetchMock).toHaveBeenCalledWith("/api/search?q=eth");

    await waitFor(() => {
      expect(screen.getByText(/results for "eth"/i)).toBeInTheDocument();
    });

    const resultsList = screen.getByRole("list", { name: /search results/i });

    expect(within(resultsList).getAllByText("Ethereum").length).toBeGreaterThanOrEqual(1);
    expect(within(resultsList).getByText("ETH系")).toBeInTheDocument();
    expect(within(resultsList).getByText("Supported")).toBeInTheDocument();
    expect(within(resultsList).getByText("Limited")).toBeInTheDocument();

    // Results are Links in the new design
    const links = within(resultsList).getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links[0]).toHaveAttribute("href", "/token/ethereum");
    expect(links[1]).toHaveAttribute("href", "/token/eth-2");
  });

  it("shows a clear empty state for text queries with no results", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(emptySearchResults));

    render(<HomeSearchHero />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^search$/i })).toBeEnabled();
    });

    fireEvent.change(screen.getByPlaceholderText(/search by name/i), {
      target: { value: "totallymadeuptoken" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(screen.getByText(/no results for "totallymadeuptoken"/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/no tokens matched/i)).toBeInTheDocument();
  });

  it("keeps contract-style input explicit even when CoinGecko returns a matching token", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(validSearchResults));

    render(<HomeSearchHero />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^search$/i })).toBeEnabled();
    });

    fireEvent.change(screen.getByPlaceholderText(/search by name/i), {
      target: { value: exactContractSearchQuery },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(screen.getByText(/results for/i)).toBeInTheDocument();
    });

    // Contract match result should have a link to the token page
    const resultsList = screen.getByRole("list", { name: /search results/i });
    const link = within(resultsList).getByRole("link");
    expect(link).toHaveAttribute("href", "/token/ethereum");
  });

  it("handles unresolved contract-like input honestly instead of guessing", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(validSearchResults));

    render(<HomeSearchHero />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^search$/i })).toBeEnabled();
    });

    fireEvent.change(screen.getByPlaceholderText(/search by name/i), {
      target: { value: unresolvedContractSearchQuery },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(screen.getByText(/no results for/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/no matching token found/i)).toBeInTheDocument();
  });

  it("renders the search-first hero without a discovery CTA", () => {
    render(<HomeSearchHero />);

    // Core search-first elements are present
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Research a token.");
    expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^search$/i })).toBeEnabled();
    expect(screen.getByRole("link", { name: /try eth/i })).toHaveAttribute("href", "/token/ethereum");

    // No discovery CTA link or button is rendered
    expect(screen.queryByRole("link", { name: /discover/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /discover/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/explore tokens/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/browse/i)).not.toBeInTheDocument();
  });

  it("explains the guided demo path and market-history coverage", () => {
    render(<HomeSearchHero />);

    expect(screen.getByText("Multi-chain token research")).toBeInTheDocument();
    expect(screen.getByText("Best demo path")).toBeInTheDocument();
    expect(screen.getByText("Current demo coverage")).toBeInTheDocument();
    expect(screen.getByText("Token search")).toBeInTheDocument();
    expect(screen.getByText("Pool comparison")).toBeInTheDocument();
    expect(screen.getByText("Market history")).toBeInTheDocument();
    expect(screen.getByText(/Stored 24h history is populated for the Base ETH pool today/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open history demo/i })).toHaveAttribute(
      "href",
      "/pool/base/0x6c561b446416e1a00e8e93e221854d6ea4171372?coinId=ethereum"
    );
  });
});
