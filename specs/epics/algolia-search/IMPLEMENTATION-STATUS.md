# algolia-search — implementation status

| Milestone | State | Landed |
|---|---|---|
| AL0 — the spec | ✅ | AL-1 |
| AL1 — the search on Workers and Supabase | ✅ | AL-2 |
| AL2 — a baseline | planned | AL-3 |

## Departures from the upstream template

Everything not listed here is the template as it is upstream at `da3f27b`
(algolia/algolia-supabase-vercel-starter).

| # | What | Why |
|---|---|---|
| 1 | The app lives in `apps/web` of a pnpm workspace (`@app/web`); upstream's `package.json`, `package-lock.json`, `.gitignore`, `.env.example` and README are replaced by the workspace's; `build` adds the OpenNext build, and `preview`, `typecheck`, `wire:fixture` and `db:migrate` are added; the README's screenshot (`docs/screenshot.png`) is not carried | The workspace's shape (postgres-kysely's) |
| 2 | Next 16.3.0 → 16.3.8 with `@opennextjs/cloudflare` 1.20; eslint-config-next 16.2.10 → 16.3.8; `@types/node` 20 → 22; `@cloudflare/workers-types` and `wrangler` added; `instantsearch.js` (^4.122.0, react-instantsearch 7's own) added as a direct dependency | OpenNext's supported Next; pnpm does not hoist `instantsearch.js`, whose types `product-hit.tsx` imports (TS2307 otherwise) |
| 3 | `lib/db.ts`: upstream's `query(text, params)` kept; on the Worker it runs on one `pg.Client` per request over `env.HYPERDRIVE.connectionString` (a WeakMap keyed by the request's ExecutionContext, connected once, a failed connect not kept), with no `ssl` override; without a Cloudflare context, upstream's pool over `POSTGRES_URL` exactly as written | The Workers runtime forbids cross-request sockets (risk AL-A); the Worker talks to Hyperdrive, not to Supabase's pooler |
| 4 | `next.config.ts`: the `env` block (inlining `NEXT_PUBLIC_ALGOLIA_APP_ID` / `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY`, or the bare `ALGOLIA_*` names, into the bundle) removed; `output: standalone`, the monorepo tracing root and `turbopack.root`, `initOpenNextCloudflareForDev()`, and `outputFileTracingIncludes` shipping `pg-cloudflare` whole | No key in a build (risk AL-B); pg-cloudflare's `workerd` export, which OpenNext's bundler resolves and the Node trace omits (risk AL-K) |
| 5 | `lib/algolia.ts` (new): `searchConfig()` reads `ALGOLIA_APP_ID`, `ALGOLIA_SEARCH_API_KEY` and an optional `ALGOLIA_HOST` from the Worker's env per request (the process env without a Cloudflare context); never any other key | The keys are the Worker's secrets |
| 6 | `components/search/search-experience.tsx`: takes `config` as a prop instead of reading `process.env.NEXT_PUBLIC_*`; builds its lite client in a `useMemo` (upstream: a module singleton), with `hosts` from `config.host` when set; the not-connected notice names the Orun secrets and "redeploy" instead of `vercel env pull` | The page hands it the Worker's config; the stand-in host for tests |
| 7 | `app/page.tsx`: `export const dynamic = "force-dynamic"`; reads `searchConfig()` and hands it to `SearchExperience`; wraps the search in `<div data-search="connected|not-connected">`; renders `<Catalogue />` when not connected; "vercel" / "Vercel" in the wordmark, heading, lede and footer → "cloudflare" / "Cloudflare" | Read per request, not frozen at build; the deploy smoke's marker; the host it runs on |
| 8 | `components/catalogue.tsx` (new) and `listProducts()` in `lib/products.ts`: while search is not connected, the products from Postgres (only the fields the connector indexes) in the hit cards' markup, each linking its product page; a missing table says the migrations have not run | A product goes live before its owner has an Algolia application, and still shows its data |
| 9 | `app/layout.tsx`: Geist from the `geist` package (next/font/local) instead of `next/font/google`; `metadataBase` from `NEXT_PUBLIC_SITE_URL`; `title` from `SITE_NAME` (`lib/site.ts`, "Algolia x Supabase starter"; upstream "Algolia × Supabase × Vercel starter"); the description says Cloudflare | Google's font download fails on GitHub's runners; one rename seam (the card's name pattern has no `×`); the origin per environment |
| 10 | `app/globals.css`: `@import "tailwindcss" source(none)` with `@source` for `app/` and `components/` | Tailwind 4 reads .gitignore only inside a git checkout, so a CI job tree would scan the build output |
| 11 | `demo/seed.sql` → `packages/db/src/migrations/010_products` (its CREATE TABLE) and `030_demo_products` (its twenty upserts, byte for byte — tests/db rebuilds upstream's file from the two and checks its sha256); `020_row_level_security` enables RLS with no policy, behind a guard; `demo/transform.js` kept as is | Applied before the Worker serves; the Data API's roles see nothing (risk AL-E) |
| 12 | `scripts/migrate.mjs`, `scripts/app-migrations.mjs` (new): `pnpm db:migrate` applies packages/db's app migrations to a local database in transactions, its ledger (with sha256s) in schema `local_migrations` | Local databases get the same files as the deployed ones |
| 13 | `app/api/health/route.ts` (new): 200 only when the table exists with RLS on; reports `search: connected | not connected` | The deploy's smoke and the bootstrap's probes read it |
| 14 | `wrangler.template.jsonc` → committed `wrangler.jsonc`, `wiring.fixture.json`, `cloudflare-env.d.ts`, `open-next.config.ts`, `component.yaml` (the Algolia secrets as `optionalSecretEnv`, unset for the build and pushed by `tooling/wire/worker-secrets.mjs`) | The Worker's config and deploy contract replace Vercel's |
| 15 | `eslint.config.mjs`: also ignores `.open-next/**`, `.wrangler/**` and `cloudflare-env.d.ts`; upstream's two `no-unused-vars` warnings on `demo/transform.js` (a function pasted into Algolia's dashboard, never called here) are kept | The Workers build and its local state; the file stays byte for byte |
| 16 | Tests: `tests/web` (the per-request client, the Algolia config, `/api/health`, the catalogue, the page's two states, the product queries, InstantSearch rendered in jsdom against an in-process Algolia stand-in — query, facets, the stock toggle — and the wrangler render) and `tests/db` (the manifest, the local migrator, the table's columns, the demo rows held to upstream's seed, the connector's transformation, row-level security, on PGlite) | The template ships none |
| 17 | `tooling/rebrand/rebrand.mjs`: the leftover sweep allows exactly `ALGOLIA_SEARCH_API_KEY` and `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY` | Algolia's names, which share this baseline's env-var prefix (risk AL-F) |

## Verified

- Locally: every contract tier, the component docs, the blueprint's `--status`, the leak gate and placement; the landing checks (typecheck, lint, test, build); the built Worker under `wrangler dev` over a migrated PGlite (the catalogue, the product pages, the 404s, `/api/health`), and with the Algolia secrets as vars, a headless Chrome rendering 20 hits, the facets and the stock toggle from an Algolia stand-in. Worker: 1147 KiB gzipped (Workers Free).
- On the PR's Baseline CI `product` job: the e2e tier on real Postgres (this machine has no `psql`).
