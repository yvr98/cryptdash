export default function PoolLoading() {
  return (
    <main className="flex flex-1">
      <div className="mx-auto flex w-full max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
        <section className="flex w-full flex-1 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-10 text-center shadow-[var(--shadow-panel)] sm:rounded-2xl sm:px-6 sm:py-16">
          <div className="max-w-2xl space-y-3">
            <div className="h-3 w-24 mx-auto rounded bg-[color:var(--muted)]/20 animate-pulse" />
            <div className="h-8 w-64 mx-auto rounded bg-[color:var(--muted)]/20 animate-pulse" />
            <div className="h-4 w-48 mx-auto rounded bg-[color:var(--muted)]/20 animate-pulse" />
          </div>
        </section>
      </div>
    </main>
  );
}
