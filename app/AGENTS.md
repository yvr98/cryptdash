# APP KNOWLEDGE BASE

## OVERVIEW
`app/` owns App Router entry points, top-level layout, and thin API route handlers.

## STRUCTURE
```text
app/
├── layout.tsx
├── page.tsx
├── token/[coinId]/page.tsx
└── api/
    ├── search/route.ts
    └── token/[coinId]/{route,pools/route,ohlcv/route}.ts
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Global shell | `layout.tsx` | fonts, navbar, globals |
| Homepage | `page.tsx` | minimal wrapper around hero |
| Token page route | `token/[coinId]/page.tsx` | server fetch into page-data |
| Search API | `api/search/route.ts` | token search enrichment |
| Token detail API | `api/token/[coinId]/route.ts` | metadata + platforms |
| Pools API | `api/token/[coinId]/pools/route.ts` | network/address required |
| OHLCV API | `api/token/[coinId]/ohlcv/route.ts` | network/pool/limit validation |

## CONVENTIONS
- Keep route handlers thin; real logic belongs in `lib/`.
- Every API route exports `revalidate = 60`.
- Use `jsonResponse`, `errorResponse`, and `upstreamErrorResponse` from `lib/api/cache.ts`.
- Dynamic token routes always use `[coinId]`, never symbol slugs.
- `layout.tsx` is the only global composition point; avoid scattering app-wide chrome.

## ANTI-PATTERNS
- Do not duplicate adapter parsing inside route handlers.
- Do not build ad hoc token URLs; use route helpers.
- Do not swallow invalid query params; return explicit 400s.
- Do not introduce route-specific cache headers that diverge from shared policy without updating tests.

## NOTES
- `page.tsx` and `token/[coinId]/page.tsx` are server entry points; client UI lives in `components/`.
- `app/globals.css` enforces the dark token-research theme through CSS variables.
- If route behavior changes, update `tests/data/route-caching.test.ts` and relevant e2e specs.
