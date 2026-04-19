import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Navbar } from "@/components/navbar";

const pushMock = vi.fn();
const usePathnameMock = vi.fn<() => string>();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("Navbar", () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue("/");
  });

  afterEach(() => {
    cleanup();
    pushMock.mockReset();
    usePathnameMock.mockReset();
  });

  it("keeps the home affordance and exposes a visible Discover link to /discover", () => {
    render(<Navbar />);

    expect(
      screen.getByRole("link", {
        name: /tokenscope/i,
      })
    ).toHaveAttribute("href", "/");

    expect(
      screen.getByRole("link", {
        name: /^discover$/i,
      })
    ).toHaveAttribute("href", "/discover");
  });

  it("preserves navbar search affordances away from the home route", () => {
    usePathnameMock.mockReturnValue("/token/ethereum");

    render(<Navbar />);

    expect(screen.getByPlaceholderText(/search tokens/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /toggle search/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /^discover$/i,
      })
    ).toHaveAttribute("href", "/discover");
  });
});
