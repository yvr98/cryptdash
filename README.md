# CryptDash

A multi-chain token research tool that aggregates DEX pool data across Ethereum, Base, Arbitrum, Polygon, and BNB Chain — helping traders quickly identify where a token is most liquid and actively traded.

**[CryptDash →](https://cryptdash.vercel.app/)**

---

## Features

- **Universal Token Search** — Search by name, symbol, or contract address with disambiguation for tokens sharing the same ticker
- **Multi-Chain Pool Comparison** — Side-by-side view of liquidity, volume, transactions, and price change across 5 chains
- **Smart Pool Recommendations** — Deterministic scoring engine that surfaces the best-traded pool with confidence labels and transparent rationale
- **OHLCV Candlestick Charts** — Interactive hourly charts powered by lightweight-charts, defaulting to the recommended market
- **Local Watchlist** — Track tokens across sessions with browser-based persistence
- **Graceful Degradation** — Upstream API failures surface labeled fallback states instead of crashes

## Tech Stack

| | |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Charts** | lightweight-charts v5 |
| **APIs** | CoinGecko + GeckoTerminal |
| **Testing** | Vitest + Testing Library |
| **Deployment** | Vercel |

## Getting Started

```bash
git clone https://github.com/yvr98/cryptdash.git && cd cryptdash
npm install
```

Create a `.env.local` file:

```env
COINGECKO_API_KEY=your_demo_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
RAILS_BASE_URL=http://127.0.0.1:3001
INTERNAL_SNAPSHOT_CAPTURE_SECRET=your_shared_capture_secret
```

> Get a free API key at [coingecko.com/api](https://www.coingecko.com/en/api). GeckoTerminal's public API requires no key.

`RAILS_BASE_URL` points the Next.js app at the sibling Rails API. `INTERNAL_SNAPSHOT_CAPTURE_SECRET` is optional in local development unless you want live snapshot capture enabled, but production requires it on both the Next.js and Rails deployments with the same value.

```bash
npm run dev        # Start dev server
npm run test       # Run 176 unit tests
npm run build      # Production build
```

### Rails API Backend (Optional)

The `rails/` directory contains a Rails 8.1 API backend (Ruby 3.3.11, PostgreSQL). Local development requires PostgreSQL on `127.0.0.1:5432` and the `libpq-dev` package.

```bash
# Install Ruby 3.3.11 (e.g., via rbenv)
cd rails && bundle install && bin/rails db:prepare
bin/rails server -p 3001   # http://127.0.0.1:3001
```

Local Postgres is configured via `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` or a local `DATABASE_URL`. See `rails/config/database.yml` for defaults.

#### Deployment

| Platform | Owns |
|----------|------|
| Neon | Production Postgres database (connection string stays private) |
| Render | Rails API host — stores `DATABASE_URL` (Neon connection string) |
| Vercel | Next.js host — uses `RAILS_BASE_URL` and `INTERNAL_SNAPSHOT_CAPTURE_SECRET`, never DB credentials |

Neon Auth is disabled. Create the Neon project manually (no CLI init flows).

Production config contract:

- **Render (Rails)**: `DATABASE_URL`, `INTERNAL_SNAPSHOT_CAPTURE_SECRET`
- **Vercel (Next.js)**: `RAILS_BASE_URL`, `INTERNAL_SNAPSHOT_CAPTURE_SECRET`

The internal snapshot capture secret must be present on both platforms with the exact same value so Next.js can authenticate internal capture requests and Rails can verify them.

### GitHub Actions-managed production deploys

Production deploy intent is owned by GitHub Actions, not inferred solely from platform-side Git integrations:

- frontend-owned path changes deploy **Vercel only**
- Rails-owned path changes deploy **Render only**
- mixed changes deploy **both** after CI passes

Required GitHub repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `RENDER_API_KEY`
- `RENDER_SERVICE_ID`

For this workflow to be the single source of truth, disable automatic Git-triggered production deploys in the Vercel and Render dashboards after wiring these secrets. Keep `vercel.json` and `render.yaml` path filters as defense-in-depth guardrails.

## How It Works

1. **Search** for any token — the app resolves it via CoinGecko and maps contract addresses across supported chains
2. **Pool data** is fetched from GeckoTerminal for each chain where the token has a contract
3. **Eligibility filtering** removes low-signal pools (minimum $50K liquidity, $5K volume, 20 transactions)
4. **Scoring** ranks eligible pools by weighted composite: 60% liquidity, 30% volume, 10% activity
5. **Recommendation** is displayed with one of four states: clear winner, near tie, comparison unavailable, or insufficient data

All scoring is deterministic — same inputs always produce the same output. No ML, no hidden weights.

## Architecture

```
app/                    Next.js App Router pages and API routes
components/             React components (search, token detail, chart, pools table)
lib/
  api/                  Server-side adapters for CoinGecko & GeckoTerminal
  recommendation/       Scoring engine, eligibility filter, recommendation pipeline
  chart/                Chart data transformation and market selection
  page-data/            Server-side page model assembly
  watchlist/            localStorage abstraction with referential stability
  constants/            Chain definitions, route helpers
  types/                Shared TypeScript type definitions
rails/                  Rails 8.1 API backend (Ruby 3.3.11, PostgreSQL)
tests/                  176 unit tests across all modules
```

**Key design decisions:**
- CoinGecko coin ID as canonical identity (never route by symbol — they're ambiguous)
- All upstream parsing happens once at the server adapter boundary
- `Promise.allSettled` for multi-chain fetching — one chain failing doesn't break the page
- Route handlers set `revalidate = 60` with CDN cache headers

## License

MIT
