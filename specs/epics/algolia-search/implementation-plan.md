# algolia-search — implementation plan

Three milestones, one pull request each, squash-merged when green.

## AL0 — the spec (AL-1)

The repository is born (intent with the placeholder workspace, Orun CI byte
for byte turso-starter's, the shared TypeScript and ESLint configuration, the
wrangler renderer, the migrations manifest tool, the spec index), then this
doc set and the three task contracts land.

**Done when** the epic and the contracts are on `main`.

## AL1 — the search on Workers and Supabase (AL-2)

1. The template in `apps/web` on Next.js 16.3.8 with `@opennextjs/cloudflare`:
   `output: standalone`, the monorepo tracing root, `initOpenNextCloudflareForDev()`,
   pg-cloudflare shipped whole through `outputFileTracingIncludes`; Geist from
   the `geist` package; `instantsearch.js` a direct dependency (pnpm does not
   hoist it).
2. `lib/db.ts`: upstream's `query()`, on one `pg` client per request (a
   WeakMap keyed by the request's ExecutionContext, Hyperdrive's connection
   string, connected once), upstream's own pool over `POSTGRES_URL` without a
   context.
3. `lib/algolia.ts` and the search UI: the application id and search-only key
   (and an optional host) read from the Worker per request, handed to
   `SearchExperience` as props; next.config's `env` inlining removed.
4. `components/catalogue.tsx`: the products from Postgres in the hits' cards
   while search is not connected; the page marks its state (`data-search`).
5. The table, row-level security and the demo products as `packages/db`
   migrations (010, 020, 030) with their manifest; `infra/db-migrate` applies
   them; `pnpm db:migrate` applies the same files locally.
6. `/api/health`: 200 only with the table migrated and RLS on; it reports
   whether search is connected.
7. The Algolia secrets as `optionalSecretEnv`, unset for the build and pushed
   to the Worker after it (`tooling/wire/worker-secrets.mjs`).
8. `infra/terraform/supabase` and `infra/terraform/cloudflare-hyperdrive`, the
   wiring template and its committed fixture render, `apps/web/component.yaml`.
9. `tests/web` (InstantSearch in jsdom against an in-process Algolia stand-in)
   and `tests/db` (PGlite; the migrations held to upstream's seed).

**Done when** typecheck, lint, test and build are green and `wrangler dev`
over the build lists the catalogue and serves the product pages from a
migrated database, says search is not connected without the secrets, and with
them a headless Chrome's InstantSearch renders hits from a stand-in.

## AL2 — a baseline (AL-3)

postgres-kysely's machinery on this tree: `blueprint.yaml` (the console card:
Cloudflare and Supabase, five brokered keys, the subdomain read from the
connection, no domain and no Algolia key asked), `repo-blueprint.yaml` (one
landing, `01-product`, then the record, `02-docs`), `.baseline/` (identity,
the product's README with "Connect Algolia", task contracts), the rename
engine (the upstream template's links protected, Algolia's own key names
allowed by the leftover sweep), the bootstrap helpers, the deployment-record
renderer, the phase pages, the context pack, and the baseline's tests — the
e2e tier running the search in a headless Chrome against an Algolia stand-in.

**Done when** Baseline CI is green on the pull request and on `main`, then
`baseline-v1` is tagged.
