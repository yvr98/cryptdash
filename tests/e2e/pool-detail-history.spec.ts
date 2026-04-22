import { execFileSync, spawn, type ChildProcess } from "node:child_process";

import { expect, test } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";
const RAILS_BASE = "http://127.0.0.1:3001";
const RAILS_DIR = "/home/plate/cryptdash2/rails";
const SEEDED_LIQUIDITY_LATEST = "$4.32M";
const SEEDED_LIQUIDITY_DELTA = "+$1.11M";
const SEEDED_VOLUME_LATEST = "$765.4K";
const SEEDED_VOLUME_DELTA = "+$111.1K";
const SEEDED_TXS_LATEST = "222";
const SEEDED_TXS_DELTA = "+111";

function railsEnv() {
  const home = process.env.HOME ?? "";
  const rbenvPath = `${home}/.rbenv/shims:${home}/.rbenv/bin`;

  return {
    ...process.env,
    PATH: `${rbenvPath}:${process.env.PATH ?? ""}`,
    ...(process.env.PGPASSWORD ? { PGPASSWORD: process.env.PGPASSWORD } : {}),
  };
}

function runRailsRunner(script: string) {
  execFileSync("bundle", ["exec", "rails", "runner", script], {
    cwd: RAILS_DIR,
    env: railsEnv(),
    stdio: "pipe",
  });
}

async function isRailsResponsive(): Promise<boolean> {
  try {
    const response = await fetch(`${RAILS_BASE}/up`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForRailsReady(timeoutMs = 120_000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await isRailsResponsive()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Timed out waiting for Rails server on 127.0.0.1:3001");
}

let startedRailsProcess: ChildProcess | null = null;

test.beforeAll(async () => {
  if (await isRailsResponsive()) {
    return;
  }

  startedRailsProcess = spawn(
    "bash",
    [
      "-lc",
      'export PATH="$HOME/.rbenv/shims:$HOME/.rbenv/bin:$PATH"; exec bin/rails server -b 127.0.0.1 -p 3001',
    ],
    {
      cwd: RAILS_DIR,
      env: railsEnv(),
      detached: true,
      stdio: "ignore",
    },
  );

  startedRailsProcess.unref();
  await waitForRailsReady();
});

test.afterAll(async () => {
  if (!startedRailsProcess?.pid) {
    return;
  }

  try {
    process.kill(-startedRailsProcess.pid, "SIGTERM");
  } catch {
    // Ignore already-stopped processes during cleanup.
  }

  startedRailsProcess = null;
});

function clearPoolSnapshots(networkId: string, poolAddress: string) {
  const escapedNetworkId = JSON.stringify(networkId);
  const escapedPoolAddress = JSON.stringify(poolAddress.toLowerCase());

  runRailsRunner(
    `PoolSnapshot.where(network_id: ${escapedNetworkId}, pool_address: ${escapedPoolAddress}).delete_all`,
  );
}

function seedReadyHistory(networkId: string, poolAddress: string) {
  const escapedNetworkId = JSON.stringify(networkId);
  const escapedPoolAddress = JSON.stringify(poolAddress);

  runRailsRunner(`
network_id = ${escapedNetworkId}
pool_address = ${escapedPoolAddress}
canonical_pool_address = pool_address.downcase
PoolSnapshot.where(network_id: network_id, pool_address: canonical_pool_address).delete_all
now = Time.current.change(usec: 0)
[
  { captured_at: now - 2.hours, liquidity_usd: BigDecimal("3210000"), volume_24h_usd: BigDecimal("654321"), transactions_24h: 111 },
  { captured_at: now - 1.hour, liquidity_usd: BigDecimal("3765000"), volume_24h_usd: BigDecimal("700000"), transactions_24h: 180 },
  { captured_at: now, liquidity_usd: BigDecimal("4321000"), volume_24h_usd: BigDecimal("765432"), transactions_24h: 222 }
].each do |attributes|
  PoolSnapshot.create!(attributes.merge(network_id: network_id, pool_address: pool_address))
end
  `);
}

async function discoverEthereumPoolUrl(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/token/ethereum`, {
    waitUntil: "networkidle",
  });

  await expect(page.getByText("Pool comparison")).toBeVisible();

  const poolLink = page
    .getByRole("table")
    .locator('a[href*="/pool/"][href*="coinId=ethereum"]')
    .first();

  await expect(poolLink).toBeVisible();

  const href = await poolLink.getAttribute("href");
  expect(href).toBeTruthy();

  return new URL(href!, BASE);
}

test.describe("Pool detail — history browser proofs", () => {
  test("ready history renders from stored Rails rows for a valid pool detail page", async ({
    page,
  }) => {
    const poolUrl = await discoverEthereumPoolUrl(page);
    const [, , networkId, poolAddress] = poolUrl.pathname.split("/");

    expect(networkId).toBeTruthy();
    expect(poolAddress).toMatch(/^0x[0-9a-f]+$/i);

    clearPoolSnapshots(networkId, poolAddress);
    seedReadyHistory(networkId, poolAddress);

    try {
      await page.goto(poolUrl.toString(), { waitUntil: "networkidle" });

      await expect(page.getByText("Pool detail")).toBeVisible();
      await expect(page.getByText("Market history")).toBeVisible();
      await expect(
        page.getByText(
          "Last 24 hours of stored liquidity, volume, and transaction activity for this pool.",
        ),
      ).toBeVisible();

      await expect(
        page.getByText(
          "History is still building for this pool. Check back after more snapshots are collected.",
        ),
      ).toHaveCount(0);
      await expect(
        page.getByText(
          "Stored history is temporarily unavailable for this pool. Try refreshing in a moment.",
        ),
      ).toHaveCount(0);

      const historySection = page
        .getByText("Market history")
        .locator("xpath=ancestor::section[1]");

      await expect(page.getByText(SEEDED_LIQUIDITY_LATEST)).toBeVisible();
      await expect(page.getByText(SEEDED_LIQUIDITY_DELTA)).toBeVisible();
      await expect(page.getByText(SEEDED_VOLUME_LATEST)).toBeVisible();
      await expect(page.getByText(SEEDED_VOLUME_DELTA)).toBeVisible();
      await expect(page.getByText(SEEDED_TXS_LATEST)).toBeVisible();
      await expect(page.getByText(SEEDED_TXS_DELTA)).toBeVisible();
      await expect(historySection.locator("svg")).toHaveCount(3);
    } finally {
      clearPoolSnapshots(networkId, poolAddress);
    }
  });

  test("unavailable history keeps a valid live pool detail page usable", async ({
    page,
  }) => {
    const poolUrl = await discoverEthereumPoolUrl(page);
    poolUrl.searchParams.set("historyTestState", "unavailable");

    await page.goto(poolUrl.toString(), { waitUntil: "networkidle" });

    await expect(page.getByText("Pool detail")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "← Back to token" })).toBeVisible();
    await expect(page.getByText("Token prices")).toBeVisible();
    await expect(page.getByText("Market history")).toBeVisible();

    const historySection = page
      .getByText("Market history")
      .locator("xpath=ancestor::section[1]");

    await expect(
      historySection.getByText(
        "Stored history is temporarily unavailable for this pool. Try refreshing in a moment.",
      ),
    ).toBeVisible();
    await expect(historySection.getByText("History unavailable")).toHaveCount(3);
    await expect(historySection.getByText("Liquidity", { exact: true })).toBeVisible();
    await expect(historySection.getByText("24h Vol", { exact: true })).toBeVisible();
    await expect(historySection.getByText("24h Txs", { exact: true })).toBeVisible();
    await expect(historySection.locator("svg")).toHaveCount(0);
  });
});
