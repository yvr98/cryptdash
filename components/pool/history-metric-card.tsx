import type { PoolDetailHistoryCard } from "@/lib/page-data/pool-detail";

type HistoryMetricCardProps = {
  card: PoolDetailHistoryCard;
  value: string;
  deltaText: string;
  deltaClassName: string;
  isSectionUnavailable: boolean;
};

function buildSparklinePoints(points: PoolDetailHistoryCard["points"]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return "0,24 100,24";

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = range === 0 ? 24 : 44 - ((point.value - min) / range) * 40;
      return `${x},${y}`;
    })
    .join(" ");
}

export function HistoryMetricCard({
  card,
  value,
  deltaText,
  deltaClassName,
  isSectionUnavailable,
}: HistoryMetricCardProps) {
  const isSparse = !isSectionUnavailable && card.state === "sparse";
  const hasValue = value !== "—";
  const sparklinePoints = card.state === "ready" ? buildSparklinePoints(card.points) : "";

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--muted)]">
        {card.label}
      </p>

      {isSectionUnavailable ? (
        <p className="mt-2 text-sm text-[color:var(--muted)]">History unavailable</p>
      ) : isSparse ? (
        <>
          {hasValue && (
            <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{value}</p>
          )}
          <p className={`${hasValue ? "mt-1" : "mt-2"} text-sm text-[color:var(--muted)]`.trim()}>
            History still building
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{value}</p>
          <p className={`mt-1 text-sm ${deltaClassName}`.trim()}>{deltaText}</p>
          <svg
            aria-hidden="true"
            viewBox="0 0 100 48"
            className="mt-3 h-12 w-full overflow-visible"
            preserveAspectRatio="none"
          >
            <polyline
              fill="none"
              points={sparklinePoints}
              stroke="currentColor"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              className="text-[color:var(--muted)]"
              strokeLinecap="round"
              strokeLinejoin="miter"
            />
          </svg>
        </>
      )}
    </div>
  );
}
