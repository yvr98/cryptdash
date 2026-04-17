# LIB/API KNOWLEDGE BASE

## OVERVIEW
`lib/api/` is the upstream boundary. It owns fetch/parsing policy, cache headers, and the stable error taxonomy used everywhere else.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| CoinGecko search/detail | `coingecko.ts` | canonical identity + platform map |
| GeckoTerminal pools/OHLCV | `geckoterminal.ts` | market data normalization |
| Shared cache policy | `cache.ts` | `CACHE_REVALIDATE`, headers, response helpers |
| Error taxonomy | `upstream-error.ts` | `UpstreamError`, category mapping, user copy |

## CONVENTIONS
- Adapters throw `UpstreamError`, not generic stringly-typed errors, when upstream semantics matter.
- Route handlers should consume `cache.ts` rather than hand-building JSON/cache responses.
- Shared cache defaults are frozen: revalidate 60, `s-maxage=60`, `stale-while-revalidate=120`.
- Canonical token identity remains CoinGecko `coinId`, with platform addresses mapped onto supported chains.
- Numeric parsing and response-shape cleanup happen here before data reaches page-model or UI code.

## ANTI-PATTERNS
- Do not leak raw upstream payload shapes beyond this directory.
- Do not special-case UI copy outside `upstream-error.ts` when the same category already exists.
- Do not change cache policy without updating `tests/data/route-caching.test.ts` and affected handlers.
- Do not silently coerce malformed upstream responses into believable domain data.

## NOTES
- `page-data/token-detail.ts` is the primary consumer of this directory.
- Tests in `tests/data`, `tests/resilience`, and `tests/e2e` rely on these boundaries staying stable.
