import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1">
      <div className="mx-auto flex w-full max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
        <section className="flex w-full flex-1 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-10 text-center shadow-[var(--shadow-panel)] sm:rounded-2xl sm:px-6 sm:py-16">
          <div className="max-w-2xl space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Not found
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-4xl">
                We couldn&apos;t find that token or pool.
              </h1>
              <p className="text-sm text-[color:var(--muted)] sm:text-base">
                The link may be outdated, the identifier may be wrong, or the resource may no
                longer be available from the upstream data source.
              </p>
            </div>

            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[color:var(--accent)] px-5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Search again
              </Link>
              <Link
                href="/discover"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-5 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                Browse discovery
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
