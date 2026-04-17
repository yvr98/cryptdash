import { getChainDef } from "@/lib/constants";
import type { PoolCandidate, Recommendation } from "@/lib/types";

export interface ChartMarket {
  poolAddress: string;
  network: string;
  chainId: PoolCandidate["chainId"];
  chainName: string;
  dexName: string;
  pairLabel: string;
  selectionReason: "recommended" | "highest_liquidity";
}

function pickHighestLiquidityPool(
  eligiblePools: PoolCandidate[]
): PoolCandidate | undefined {
  return eligiblePools.reduce<PoolCandidate | undefined>((highest, pool) => {
    if (!highest) {
      return pool;
    }

    return (pool.liquidityUsd ?? -Infinity) > (highest.liquidityUsd ?? -Infinity)
      ? pool
      : highest;
  }, undefined);
}

export function selectDefaultChartMarket(
  recommendation: Recommendation,
  eligiblePools: PoolCandidate[]
): ChartMarket | null {
  const selectedPool = recommendation.winner ?? pickHighestLiquidityPool(eligiblePools);

  if (!selectedPool) {
    return null;
  }

  const chain = getChainDef(selectedPool.chainId);

  if (!chain) {
    return null;
  }

  return {
    poolAddress: selectedPool.poolAddress,
    network: chain.geckoTerminalNetwork,
    chainId: selectedPool.chainId,
    chainName: chain.name,
    dexName: selectedPool.dexName,
    pairLabel: selectedPool.pairLabel,
    selectionReason: recommendation.winner ? "recommended" : "highest_liquidity",
  };
}
