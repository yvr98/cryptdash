# TokenScope API Backend

Rails 8.1 API backend for [TokenScope](../README.md). Ruby 3.3.11, PostgreSQL.

## Prerequisites

- Ruby 3.3.11 (pinned in `.ruby-version`)
- PostgreSQL running on `127.0.0.1:5432` (or set `PG*` env vars)
- `libpq-dev` (Ubuntu/Debian) or equivalent for building the `pg` gem

## Setup

```bash
cd rails
bundle install
bin/rails db:prepare
bin/rails server -p 3001    # http://127.0.0.1:3001
```

Local Postgres defaults live in `config/database.yml` (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`). You can also set `DATABASE_URL` directly.

## Test Suite

```bash
cd rails && bin/rails test
```

## Deployment

Production uses Neon-managed PostgreSQL. Render hosts this Rails app and stores the Neon connection string as `DATABASE_URL`. Vercel (the frontend) connects to Rails via `RAILS_BASE_URL` only. See the root [README](../README.md#deployment) and [AGENTS.md](../AGENTS.md) for the full deployment contract.
