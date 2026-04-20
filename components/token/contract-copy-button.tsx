"use client";

import { useCallback, useState } from "react";

type CopyFeedback = "idle" | "copied" | "failed";

export function ContractCopyButton({ address }: { address: string }) {
  const [feedback, setFeedback] = useState<CopyFeedback>("idle");

  const handleCopy = useCallback(async () => {
    try {
      if (!navigator?.clipboard?.writeText) {
        setFeedback("failed");
        return;
      }
      await navigator.clipboard.writeText(address);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  }, [address]);

  const label =
    feedback === "copied"
      ? "Copied"
      : feedback === "failed"
        ? "Copy failed"
        : "Copy address";

  const colorClass =
    feedback === "copied"
      ? "text-[color:var(--up)]"
      : feedback === "failed"
        ? "text-[color:var(--down)]"
        : "text-[color:var(--muted)] transition hover:text-[color:var(--accent)]";

  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={`copy-contract-${address}`}
      aria-label={label}
      className={`shrink-0 text-[10px] font-medium uppercase tracking-wider ${colorClass}`}
    >
      {feedback === "copied" ? "Copied" : feedback === "failed" ? "Failed" : "Copy"}
    </button>
  );
}
