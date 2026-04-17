# LIB KNOWLEDGE BASE

## OVERVIEW
`lib/` is the core domain layer: upstream adapters, page-model assembly, deterministic recommendation logic, chart helpers, constants, and watchlist state.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| API boundaries | `api/` | CoinGecko, GeckoTerminal, cache, upstream errors |
| Page integration | `page-data/token-detail.ts` | joins adapters + recommendation |
| Recommendation | `recommendation/` | eligibility, scoring, output state |
| Chart helpers | `chart/` | chart market selection, candle shaping |
| Routing + chains | `constants/` | canonical routes + supported chains |
| Shared contracts | `types/index.ts` | all domain types |
| Watchlist state | `watchlist/` | localStorage abstraction |

## CONVENTIONS
- Normalize external data at adapter boundaries once.
- Use shared domain types from `lib/types/index.ts`; do not recreate shapes in UI/tests.
- Recommendation logic stays deterministic and explainable.
- Page data should surface degraded states explicitly through `dataState`, not hidden null paths.
- Constants define the supported chain set; feature code should consume those definitions, not inline chain metadata.

## ANTI-PATTERNS
- Do not let components talk directly to upstream APIs.
- Do not invent fallback data that looks real when upstream failed.
- Do not fork chain metadata or route rules outside `constants/`.
- Do not bypass watchlist storage helpers with direct `localStorage` access.

## NOTES
- Highest-centrality files are `api/*`, `page-data/token-detail.ts`, `recommendation/*`, and `types/index.ts`.
- If you change shared behavior here, expect tests across `tests/data`, `tests/recommendation`, `tests/resilience`, and e2e to move together.
