# TESTS KNOWLEDGE BASE

## OVERVIEW
`tests/` is a centralized test tree. Vitest covers data/domain/component behavior; Playwright covers critical browser flows.

## STRUCTURE
```text
tests/
├── e2e/            # Playwright specs
├── data/           # route, cache, normalization, page-model tests
├── recommendation/ # deterministic engine tests
├── resilience/     # upstream failure handling
├── components/     # React component tests
├── home/           # homepage UI tests
├── watchlist/      # persistence tests
├── chart/          # chart helper tests
├── fixtures/       # reusable scenario data
└── setup.ts        # Vitest setup
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Shared setup | `setup.ts` | jest-dom for Vitest |
| Route/cache rules | `data/route-caching.test.ts` | cache contract guardrail |
| Search route behavior | `data/search-route.test.ts` | canonical identity/search hydration |
| Page-model assembly | `data/page-data.test.ts` | supported-chain and fallback behavior |
| Recommendation engine | `recommendation/recommendation-engine.test.ts` | fixed scoring semantics |
| Resilience | `resilience/upstream-errors.test.ts` | degraded-state guarantees |
| Fixtures | `fixtures/*.ts` | deterministic scenario inputs |

## CONVENTIONS
- Vitest files use `.test.ts` or `.test.tsx` and live under domain folders.
- Fixtures are centralized under `tests/fixtures/` for reuse across suites.
- Data and recommendation tests assert deterministic behavior; avoid probabilistic wording or fuzzy expectations.
- When changing shared contracts, update the narrowest affected suite first before broad e2e.

## ANTI-PATTERNS
- Do not only verify visually when a deterministic unit/data test can lock behavior.
- Do not duplicate fixture shapes inline if an existing named fixture already captures the scenario.
- Do not broaden a test suite when a focused domain test is enough.
- Do not let tests drift from the fixed route/cache/recommendation contracts documented in root AGENTS.

## COMMANDS
```bash
npm run test
npm run test:e2e
```

## NOTES
- Vitest config includes only `tests/**/*.test.ts(x)` with `jsdom` and `tests/setup.ts`.
- `tests/e2e/` has a separate contract and its own local AGENTS doc.
