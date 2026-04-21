# PROJECT KNOWLEDGE BASE

## OVERVIEW
TokenScope is a focused Next.js App Router app for multi-chain token research, with a sibling Rails API backend under `rails/`. Canonical identity is always the CoinGecko `coinId`; GeckoTerminal supplies pools and OHLCV.

## STRUCTURE
```text
./
├── app/            # routes, layouts, route handlers (Next.js)
├── components/     # UI; token detail shell is the main presentational hub
├── lib/            # adapters, page-model assembly, recommendation, chart, watchlist
├── rails/          # Rails 8.1 API backend (Ruby 3.3.11, PostgreSQL)
├── tests/          # centralized Vitest + Playwright coverage
└── public docs     # README, config, CI
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Home route | `app/page.tsx` | renders `HomeSearchHero` only |
| Token page | `app/token/[coinId]/page.tsx` | server route into page-data layer |
| API routes | `app/api/**/route.ts` | thin handlers; shared cache policy |
| Token page model | `lib/page-data/token-detail.ts` | main integration hub |
| CoinGecko adapter | `lib/api/coingecko.ts` | canonical token/search boundary |
| GeckoTerminal adapter | `lib/api/geckoterminal.ts` | pools + OHLCV boundary |
| Recommendation logic | `lib/recommendation/*` | deterministic, fixed weights |
| Chart selection | `lib/chart/*` | chart market + candle shaping |
| Route identity | `lib/constants/route.ts` | never symbol-only routing |
| Shared types | `lib/types/index.ts` | contracts reused everywhere |
| E2E flows | `tests/e2e/*.spec.ts` | production-style server via Playwright |

## RAILS SLICE (rails/)

The `rails/` directory is an independent Rails 8.1 application serving as the API backend. It is **not** coupled to the Next.js runtime.

### Local Toolchain

| Requirement | Value |
|-------------|-------|
| Ruby version | **3.3.11** (pinned in `rails/.ruby-version`)
| Rails version | **8.1.3** (see `rails/Gemfile`)
| Database | **PostgreSQL** (local: `127.0.0.1:5432`; production: Neon) |
| Web server | Puma
| Dev port | **127.0.0.1:3001**

### Setup (agents and developers)

Prerequisites: Ruby 3.3.11, PostgreSQL running locally on `127.0.0.1:5432`, and the `libpq-dev` package (Ubuntu/Debian) or equivalent for building the `pg` gem.

```bash
# Ensure rbenv (or equivalent) resolves Ruby 3.3.11
export PATH="$HOME/.rbenv/bin:$HOME/.rbenv/shims:$PATH" && eval "$(rbenv init - bash)"
cd rails && bundle install && bin/rails db:prepare
bin/rails server -p 3001   # http://127.0.0.1:3001
```

Local Postgres is configured via standard `PG*` environment variables (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) or a local `DATABASE_URL`. See `rails/config/database.yml` for defaults.

### Deployment Contract

| Platform | Role | Owns | Does not own |
|----------|------|------|--------------|
| Neon | Managed Postgres | Production database | No app runtime |
| Render | Rails API host | `DATABASE_URL` (Neon connection string, set via dashboard) | No frontend, no DB credentials on other platforms |
| Vercel | Next.js host | `RAILS_BASE_URL` (Render Rails URL) | No DB credentials, no `DATABASE_URL` |

- Neon Auth is **disabled** and out of scope. Neon is used only as a managed Postgres provider.
- The Neon connection string is **private**. Create the Neon project manually; do not use Neon CLI init flows.
- Render receives the Neon connection string as `DATABASE_URL` and does not share it with Vercel.
- Vercel connects to Rails exclusively via `RAILS_BASE_URL`. No DB credentials should ever reach the Next.js environment.

## CODE MAP
| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| `RootLayout` | component | `app/layout.tsx` | global | top-level shell + navbar |
| `Home` | page | `app/page.tsx` | route | search-first homepage |
| `getTokenDetailPageData` | function | `lib/page-data/token-detail.ts` | high | assembles token page model |
| `getCoinDetail` / `searchCoins` | adapter funcs | `lib/api/coingecko.ts` | high | CoinGecko boundary |
| `fetchPoolsForToken` / `fetchOhlcv` | adapter funcs | `lib/api/geckoterminal.ts` | high | GeckoTerminal boundary |
| `recommend` | function | `lib/recommendation/recommend.ts` | medium | final recommendation output |
| `scorePools` | function | `lib/recommendation/scoring.ts` | medium | weighted scoring |
| `selectDefaultChartMarket` | function | `lib/chart/select-market.ts` | medium | winner/highest-liquidity chart market |
| `TokenDetailShell` | component | `components/token/token-detail-shell.tsx` | medium | main token UI shell |
| `UpstreamError` | class | `lib/api/upstream-error.ts` | high | stable degraded-state taxonomy |

## CONVENTIONS
- `@/*` aliases resolve from repo root, not `src/`.
- App Router only: pages in `app/`, API handlers in `app/api/**/route.ts`.
- Route handlers all export `revalidate = 60` and use `lib/api/cache.ts` helpers.
- Upstream parsing happens once at adapter boundaries, not in UI components.
- Recommendation logic is deterministic: liquidity 60%, volume 30%, transactions 10%.
- Tests are centralized under `tests/`, not colocated with source files.
- E2E runs against a production-style server (`npm run build && npm run start`), not dev/HMR.
- Styling is dark-first through CSS variables in `app/globals.css`.

## ANTI-PATTERNS (THIS PROJECT)
- Never route by token symbol alone; require explicit token selection and `coinId` paths.
- Do not widen scope just because upstream APIs expose more data.
- Do not move parsing/normalization into components or route handlers when an adapter can own it.
- Do not claim Playwright coverage unless the relevant spec actually ran.
- Do not leave dev servers running after verification.
- Do not launch a new dev server if one is already serving the needed app for this task.
- Do not launch multiple Playwright/browser automation sessions for the same task; use one session, finish the check, then close it.
- Do not leave stale Playwright, browser, or test helper processes running after verification or on failure.
- Do not defer all verification to the end; use static checks, narrow tests, then e2e.
- Do not fabricate recommendations or market state when upstream data is partial or failed.

## UNIQUE STYLES
- Product language stays research-first: compare chains, liquidity, volume, activity.
- Error handling prefers stable degraded states over crashes or silent nulls.
- Search UX is honest about ambiguity and contract-address misses.
- Watchlist state goes through a single localStorage abstraction with malformed-state recovery.

## COMMANDS

### Next.js (root)
```bash
npm run dev           # http://127.0.0.1:3000
npm run lint
npm run test
npm run test:e2e
npm run build
npm run start
```

### Rails (rails/)
```bash
cd rails && bin/rails server -p 3001   # http://127.0.0.1:3001
cd rails && bin/rails test              # run Rails tests
```

## NOTES
- `NEXT_PUBLIC_APP_URL` and `COINGECKO_API_KEY` are expected in `.env.local` (Next.js only).
- Rails expects `DATABASE_URL` (or `PG*` env vars) for all environments. See `rails/config/database.yml`.
- CI runs `npm install`, `npm run test`, then `npm run build` on Node 24.
- Next.js dev server: `127.0.0.1:3000`. Rails dev server: `127.0.0.1:3001`.
- Playwright uses `tests/e2e` with `reuseExistingServer: true` on `127.0.0.1:3000`.
- Process hygiene for local verification:
  - Check for an existing app server before starting another one.
  - Keep at most one Playwright/browser automation session open per task.
  - Close Playwright/browser sessions immediately after the check completes.
  - Stop any server started just for verification as soon as verification is done.
  - If verification fails or is interrupted, clean up any server or Playwright process started for that attempt before retrying.
- If you need deeper guidance, read `app/AGENTS.md`, `lib/AGENTS.md`, `lib/api/AGENTS.md`, `tests/AGENTS.md`, and `tests/e2e/AGENTS.md`.
