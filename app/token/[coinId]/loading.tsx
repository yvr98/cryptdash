export default function TokenLoading() {
  const statSkeletons = ["price", "change", "volume", "liquidity"];

  return (
    <main className="flex flex-1">
      <div className="mx-auto flex w-full max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
        <div className="grid w-full gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4 sm:space-y-5">
            <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-panel)] sm:rounded-2xl sm:p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 animate-pulse rounded-full bg-[color:var(--muted)]/20" />
                  <div className="space-y-2">
                    <div className="h-7 w-48 animate-pulse rounded bg-[color:var(--muted)]/20" />
                    <div className="flex gap-2">
                      <div className="h-5 w-16 animate-pulse rounded-full bg-[color:var(--muted)]/20" />
                      <div className="h-5 w-20 animate-pulse rounded-full bg-[color:var(--muted)]/20" />
                      <div className="h-5 w-24 animate-pulse rounded-full bg-[color:var(--muted)]/20" />
                    </div>
                  </div>
                </div>
                <div className="h-10 w-32 animate-pulse rounded-xl bg-[color:var(--muted)]/20" />
              </div>

              <div className="mt-5 space-y-3">
                <div className="h-9 w-40 animate-pulse rounded bg-[color:var(--muted)]/20" />
                <div className="h-6 w-72 max-w-full animate-pulse rounded bg-[color:var(--muted)]/20" />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {statSkeletons.map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3"
                  >
                    <div className="h-3 w-20 animate-pulse rounded bg-[color:var(--muted)]/20" />
                    <div className="mt-2 h-4 w-24 animate-pulse rounded bg-[color:var(--muted)]/20" />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
              <div className="h-5 w-44 animate-pulse rounded bg-[color:var(--muted)]/20" />
              <div className="mt-4 h-64 animate-pulse rounded-xl bg-[color:var(--muted)]/10" />
            </section>
          </div>

          <aside className="space-y-4 sm:space-y-5">
            <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
              <div className="h-3 w-32 animate-pulse rounded bg-[color:var(--muted)]/20" />
              <div className="mt-4 space-y-3">
                <div className="h-11 animate-pulse rounded-xl bg-[color:var(--muted)]/10" />
                <div className="h-11 animate-pulse rounded-xl bg-[color:var(--muted)]/10" />
              </div>
            </section>

            <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
              <div className="h-3 w-28 animate-pulse rounded bg-[color:var(--muted)]/20" />
              <div className="mt-4 h-20 animate-pulse rounded-xl bg-[color:var(--muted)]/10" />
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
