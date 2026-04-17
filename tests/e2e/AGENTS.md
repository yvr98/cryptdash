# TESTS/E2E KNOWLEDGE BASE

## OVERVIEW
`tests/e2e/` verifies real browser flows with Playwright against a production-style Next server.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Smoke wiring | `smoke.spec.ts` | confirms Playwright/browser setup |
| Homepage behavior | `homepage-review.spec.ts` | search ambiguity, empty states, canonical nav |
| Watchlist persistence | `watchlist.spec.ts` | localStorage and reload behavior |
| Chart fallback | `chart-fallback.spec.ts` | chart degradation scenarios |
| Data scarcity | `low-data.spec.ts` | honest insufficient-data states |
| Recommendation tie | `near-tie.spec.ts` | close-alternative UX |
| Full flow | `demo-flow.spec.ts` | integrated happy path |

## CONVENTIONS
- Use `.spec.ts` naming only.
- Specs run from `tests/e2e` under Playwright's single configured project.
- E2E runs against `npm run build && npm run start -- --hostname 127.0.0.1 --port 3000`.
- Prefer route interception and deterministic fixtures when validating edge cases.
- Assert canonical URLs and visible user states, not internal implementation details.

## ANTI-PATTERNS
- Do not rely on dev/HMR-only behavior; the suite is production-style by design.
- Do not leave manual servers running after local verification.
- Do not claim coverage for a flow unless the relevant spec executed.
- Do not use broad e2e checks when a smaller Vitest contract test already proves the behavior.

## NOTES
- Playwright is headless, fully parallel, `reporter: list`, `trace: on-first-retry`.
- `reuseExistingServer: true` means local runs must still avoid stale/conflicting port 3000 processes.
- If route/cache contracts change, pair e2e updates with narrower tests in `tests/data`.
