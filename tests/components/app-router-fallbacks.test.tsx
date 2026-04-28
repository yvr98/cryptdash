import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import AppError from "@/app/error";
import NotFound from "@/app/not-found";

import TokenLoading from "@/app/token/[coinId]/loading";
import TokenError from "@/app/token/[coinId]/error";
import PoolLoading from "@/app/pool/[network]/[poolAddress]/loading";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App Router fallback screens", () => {
  it("renders a visible dark-theme not-found screen with primary recovery links", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", {
        name: "We couldn't find that token or pool.",
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/link may be outdated/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /search again/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /browse discovery/i })).toHaveAttribute(
      "href",
      "/discover"
    );
  });

  it("renders a retryable error boundary screen and shows the digest when provided", () => {
    const retry = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AppError
        error={Object.assign(new Error("boom"), { digest: "digest-123" })}
        reset={retry}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "This view couldn't be rendered right now.",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Reference: digest-123")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /return home/i })).toHaveAttribute("href", "/");
  });

  it("renders a token-specific retryable error boundary", () => {
    const retry = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <TokenError
        error={Object.assign(new Error("token boom"), { digest: "token-digest" })}
        reset={retry}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "This token view couldn't load cleanly.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Reference: token-digest")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /search again/i })).toHaveAttribute("href", "/");
  });
});

// ---------------------------------------------------------------------------
// Route-level loading states
// ---------------------------------------------------------------------------

describe("Route loading states", () => {
  it("token loading renders skeleton UI", () => {
    const { container } = render(<TokenLoading />);

    // Should render animate-pulse skeleton elements
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThanOrEqual(12);
    expect(container.querySelector("main")).toBeInTheDocument();
  });

  it("pool loading renders skeleton UI", () => {
    const { container } = render(<PoolLoading />);

    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector("main")).toBeInTheDocument();
  });
});
